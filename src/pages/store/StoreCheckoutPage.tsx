import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { notifyStoreBasketUpdated } from '../../lib/storeEvents';
import type { Product, StoreCartItem, OrderPaymentTiming, StoreDeliveryAddress } from '../../types';
import type { StoreOutletContext } from './storeTypes';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type CheckoutLine = {
  product_id: string;
  quantity: number;
  product: Product;
  size: string | null;
  fromCartLineId?: string;
};

export function StoreCheckoutPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accent = tenant.primary_color || '#ea580c';

  const [lines, setLines] = useState<CheckoutLine[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [paymentTiming, setPaymentTiming] = useState<OrderPaymentTiming>('prepaid');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState<StoreDeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setCustomerEmail((e) => e || user.email);
  }, [user?.email]);

  useEffect(() => {
    let cancel = false;
    async function loadAddresses() {
      if (!user) {
        setAddresses([]);
        setSelectedAddressId(null);
        return;
      }
      const { data } = await supabase
        .from('store_delivery_addresses')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancel) return;
      const rows = (data as StoreDeliveryAddress[]) || [];
      setAddresses(rows);
      const def = rows.find((a) => a.is_default);
      setSelectedAddressId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        if (def) return def.id;
        return rows[0]?.id ?? null;
      });
    }
    void loadAddresses();
    return () => {
      cancel = true;
    };
  }, [user, tenant.id]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!user) {
        setLines([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const productId = searchParams.get('productId');
      const qtyRaw = searchParams.get('qty');
      const sizeParam = searchParams.get('size');

      if (productId && qtyRaw) {
        const q = Math.max(1, parseInt(qtyRaw, 10) || 1);
        const { data: link } = await supabase
          .from('tenant_products')
          .select('product_id')
          .eq('tenant_id', tenant.id)
          .eq('product_id', productId)
          .maybeSingle();
        if (!link) {
          if (!cancel) setLines([]);
          setLoading(false);
          return;
        }
        const { data: p } = await supabase.from('products').select('*').eq('id', productId).eq('is_active', true).maybeSingle();
        const prod = p as Product | null;
        if (!prod || prod.stock < 1) {
          if (!cancel) setLines([]);
          setLoading(false);
          return;
        }
        const opts = prod.sizes && prod.sizes.length > 0 ? prod.sizes : [];
        let lineSize: string | null = null;
        if (opts.length > 0) {
          const picked = sizeParam && opts.includes(sizeParam) ? sizeParam : opts[0];
          lineSize = picked;
        }
        const quantity = Math.min(q, prod.stock);
        if (!cancel) setLines([{ product_id: prod.id, quantity, product: prod, size: lineSize }]);
      } else {
        const { data: cart } = await supabase
          .from('store_cart_items')
          .select('*, product:products(*)')
          .eq('tenant_id', tenant.id)
          .eq('user_id', user.id);
        const rows = (cart || []) as StoreCartItem[];
        const out: CheckoutLine[] = [];
        for (const r of rows) {
          const p = r.product as Product | undefined;
          if (!p || p.stock < 1) continue;
          const quantity = Math.min(r.quantity, p.stock);
          const opts = p.sizes && p.sizes.length > 0 ? p.sizes : [];
          let sz: string | null = r.size ?? null;
          if (opts.length > 0 && (!sz || !opts.includes(sz))) {
            sz = opts[0] ?? null;
          }
          out.push({
            product_id: p.id,
            quantity,
            product: p,
            size: opts.length ? sz : null,
            fromCartLineId: r.id,
          });
        }
        if (!cancel) setLines(out);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [user, tenant.id, searchParams]);

  const subtotal = useMemo(
    () => lines?.reduce((s, l) => s + l.product.price * l.quantity, 0) ?? 0,
    [lines],
  );

  const selectedAddress = selectedAddressId ? addresses.find((a) => a.id === selectedAddressId) : undefined;

  function shippingSnapshotFromAddress(a: StoreDeliveryAddress) {
    return {
      label: a.label,
      full_name: a.full_name,
      phone: a.phone,
      address_line1: a.address_line1,
      address_line2: a.address_line2,
      city: a.city,
      state: a.state,
      postal_code: a.postal_code,
      country: a.country,
    };
  }

  async function placeOrder() {
    if (!user || !lines || lines.length === 0) return;
    setPlacing(true);

    let affiliateId: string | null = null;
    try {
      const raw = sessionStorage.getItem(`ucmp_store_ref_${tenant.id}`);
      if (raw && isUuid(raw) && raw !== user.id) affiliateId = raw;
    } catch {
      /* ignore */
    }

    let resellerId: string | null = null;
    try {
      const r = sessionStorage.getItem(`ucmp_store_reseller_${tenant.id}`);
      if (r && isUuid(r) && r !== user.id) resellerId = r;
    } catch {
      /* ignore */
    }
    const { data: member } = await supabase
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!resellerId && member?.role === 'RESELLER') resellerId = user.id;

    const payStatus = paymentTiming === 'prepaid' ? 'paid' : 'pending';
    const snapshot = selectedAddress ? shippingSnapshotFromAddress(selectedAddress) : null;

    for (const line of lines) {
      const { error } = await supabase.from('orders').insert({
        buyer_id: user.id,
        product_id: line.product_id,
        quantity: line.quantity,
        total_amount: line.product.price * line.quantity,
        status: 'confirmed',
        tenant_id: tenant.id,
        affiliate_id: affiliateId,
        reseller_id: resellerId,
        payment_timing: paymentTiming,
        payment_status: payStatus,
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        shipping_snapshot: snapshot,
        size: line.size,
      });
      if (error) {
        toast(error.message, 'error');
        setPlacing(false);
        return;
      }
      if (line.fromCartLineId) {
        await supabase.from('store_cart_items').delete().eq('id', line.fromCartLineId);
      }
    }

    notifyStoreBasketUpdated();
    toast('Order placed successfully!');
    setPlacing(false);
    navigate(`/store/${slug}/account`);
  }

  if (!user) {
    const qs = searchParams.toString();
    const nextPath = `/store/${slug}/checkout${qs ? `?${qs}` : ''}`;
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-[var(--sf-muted)] mb-4">Sign in to complete checkout.</p>
        <Link
          to={`/store/${slug}/login?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: accent }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading || lines === undefined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="h-48 rounded-2xl bg-stone-200 animate-pulse" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-[var(--sf-muted)] mb-4">Nothing to checkout.</p>
        <Link to={`/store/${slug}`} className="font-semibold hover:underline" style={{ color: accent }}>
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--sf-fg)] mb-2">Checkout</h1>
      <p className="text-[var(--sf-muted)] mb-8">Review your order and payment preference.</p>

      <ul className="space-y-3 mb-8">
        {lines.map((line) => (
          <li
            key={`${line.product_id}|${line.size ?? ''}|${line.fromCartLineId || 'd'}`}
            className="flex justify-between gap-4 text-sm border border-[var(--sf-border)] rounded-xl p-4 bg-[var(--sf-surface)]"
          >
            <span className="text-[var(--sf-fg)] font-medium">
              {line.product.name}
              {line.size ? ` · ${line.size}` : ''} × {line.quantity}
            </span>
            <span className="font-bold shrink-0">{formatINR(line.product.price * line.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 mb-6 space-y-4">
        <div>
          <span className="block text-sm font-medium text-[var(--sf-fg)] mb-2">Address</span>
          {addresses.length === 0 ? (
            <p className="text-xs text-[var(--sf-muted)]">
              No saved address.{' '}
              <Link to={`/store/${slug}/account`} className="font-semibold underline" style={{ color: accent }}>
                Add one in your account
              </Link>{' '}
              or continue — we will only store contact details below.
            </p>
          ) : (
            <ul className="space-y-2">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label
                    className={`flex gap-3 items-start cursor-pointer rounded-lg p-3 border-2 transition-colors ${
                      selectedAddressId === a.id ? '' : 'border-[var(--sf-border)]'
                    }`}
                    style={selectedAddressId === a.id ? { borderColor: accent } : undefined}
                  >
                    <input
                      type="radio"
                      name="ship-addr"
                      checked={selectedAddressId === a.id}
                      onChange={() => setSelectedAddressId(a.id)}
                      className="mt-1"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-[var(--sf-fg)]">{a.label}</span>
                      {a.is_default ? (
                        <span className="ml-2 text-xs text-[var(--sf-muted)]">Default</span>
                      ) : null}
                      <span className="block text-[var(--sf-muted)] mt-0.5">
                        {a.full_name}
                        {a.phone ? ` · ${a.phone}` : ''}
                        <br />
                        {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <span className="block text-sm font-medium text-[var(--sf-fg)] mb-2">Payment</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentTiming('prepaid')}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentTiming === 'prepaid'
                  ? 'border-[var(--sf-accent)] bg-stone-50'
                  : 'border-[var(--sf-border)] hover:bg-stone-50'
              }`}
              style={
                paymentTiming === 'prepaid' ? ({ borderColor: accent, color: accent } as CSSProperties) : undefined
              }
            >
              Prepaid
            </button>
            <button
              type="button"
              onClick={() => setPaymentTiming('postpaid')}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentTiming === 'postpaid'
                  ? 'border-[var(--sf-accent)] bg-stone-50'
                  : 'border-[var(--sf-border)] hover:bg-stone-50'
              }`}
              style={
                paymentTiming === 'postpaid' ? ({ borderColor: accent, color: accent } as CSSProperties) : undefined
              }
            >
              Postpaid (e.g. COD)
            </button>
          </div>
          <p className="text-xs text-[var(--sf-muted)] mt-2">
            Prepaid marks payment as received. Postpaid keeps payment pending until you confirm (e.g. cash on delivery).
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Contact email</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--sf-border)] bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Phone (optional)</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--sf-border)] bg-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className="text-[var(--sf-muted)]">Total</span>
        <span className="text-xl font-bold text-[var(--sf-fg)]">{formatINR(subtotal)}</span>
      </div>

      <button
        type="button"
        disabled={placing}
        onClick={() => void placeOrder()}
        className="w-full py-3.5 rounded-xl text-white font-semibold shadow-md disabled:opacity-50 hover:opacity-95"
        style={{ backgroundColor: accent }}
      >
        {placing ? 'Placing order…' : 'Place order'}
      </button>

      <Link to={`/store/${slug}/cart`} className="block text-center mt-4 text-sm text-[var(--sf-muted)] hover:text-[var(--sf-fg)]">
        Back to cart
      </Link>
    </div>
  );
}
