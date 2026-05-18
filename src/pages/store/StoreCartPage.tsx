import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useStoreRole } from '../../hooks/useStoreRole';
import { notifyStoreBasketUpdated } from '../../lib/storeEvents';
import type { StoreCartItem, Product } from '../../types';
import { Package, Trash2, ShoppingBag } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

function productSizeOptions(p: Product): string[] {
  return p.sizes && p.sizes.length > 0 ? p.sizes : [];
}

export function StoreCartPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { hideStockNumbers } = useStoreRole(tenant.id);
  const [lines, setLines] = useState<StoreCartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const accent = tenant.primary_color || '#ea580c';

  async function reloadLines() {
    if (!user) {
      setLines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('store_cart_items')
      .select('*, product:products(*)')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id);
    setLines((data as StoreCartItem[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancel = false;
    void (async () => {
      if (!user) {
        setLines([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('store_cart_items')
        .select('*, product:products(*)')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id);
      if (!cancel) setLines((data as StoreCartItem[]) || []);
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user, tenant.id]);

  async function setQuantity(lineId: string, next: number) {
    if (next < 1) return;
    const line = lines.find((l) => l.id === lineId);
    const prod = line?.product as Product | undefined;
    if (prod && next > prod.stock) {
      toast(
        hideStockNumbers
          ? 'Maximum available quantity reached for this item.'
          : `Only ${prod.stock} in stock for ${prod.name}`,
        'error',
      );
      return;
    }
    const { error } = await supabase.from('store_cart_items').update({ quantity: next }).eq('id', lineId);
    if (error) toast(error.message, 'error');
    else {
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: next } : l)));
      notifyStoreBasketUpdated();
    }
  }

  async function changeLineSize(lineId: string, newSize: string) {
    const line = lines.find((l) => l.id === lineId);
    const prod = line?.product as Product | undefined;
    if (!line || !prod || !user) return;
    const opts = productSizeOptions(prod);
    if (opts.length === 0) return;
    if (!opts.includes(newSize)) return;

    const cur = line.size ?? null;
    if (cur === newSize) return;

    const maxQ = Math.max(1, prod.stock);
    const qty = Math.min(line.quantity, maxQ);

    let existingQ = supabase
      .from('store_cart_items')
      .select('id, quantity')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .eq('product_id', prod.id)
      .eq('size', newSize);
    const { data: existing } = await existingQ.maybeSingle();

    if (existing) {
      const merged = Math.min((existing as { quantity: number }).quantity + qty, maxQ);
      const { error: upErr } = await supabase
        .from('store_cart_items')
        .update({ quantity: merged })
        .eq('id', (existing as { id: string }).id);
      if (upErr) {
        toast(upErr.message, 'error');
        return;
      }
      const { error: delErr } = await supabase.from('store_cart_items').delete().eq('id', lineId);
      if (delErr) {
        toast(delErr.message, 'error');
        return;
      }
    } else {
      const { error } = await supabase.from('store_cart_items').update({ size: newSize, quantity: qty }).eq('id', lineId);
      if (error) {
        toast(error.message, 'error');
        return;
      }
    }

    notifyStoreBasketUpdated();
    await reloadLines();
  }

  async function removeLine(lineId: string) {
    const { error } = await supabase.from('store_cart_items').delete().eq('id', lineId);
    if (error) toast(error.message, 'error');
    else {
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      notifyStoreBasketUpdated();
      toast('Removed from cart');
    }
  }

  const subtotal = lines.reduce((s, l) => {
    const p = l.product as Product | undefined;
    return s + (p ? p.price * l.quantity : 0);
  }, 0);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-14 h-14 mx-auto text-[var(--sf-muted)] mb-4" />
        <h1 className="text-xl font-bold text-[var(--sf-fg)] mb-2">Sign in to view your cart</h1>
        <p className="text-[var(--sf-muted)] mb-6">Your cart is tied to your account for this store.</p>
        <Link
          to={`/store/${slug}/login?next=${encodeURIComponent(`/store/${slug}/cart`)}`}
          className="inline-flex px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: accent }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-stone-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--sf-fg)] mb-2">Your cart</h1>
      <p className="text-[var(--sf-muted)] mb-8">{lines.length} line items</p>

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-14 text-center">
          <Package className="w-12 h-12 mx-auto text-[var(--sf-muted)] mb-3" />
          <p className="text-[var(--sf-muted)] mb-6">Your cart is empty.</p>
          <Link to={`/store/${slug}`} className="font-semibold hover:underline" style={{ color: accent }}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-4 mb-10">
            {lines.map((line) => {
              const p = line.product as Product | undefined;
              if (!p) return null;
              const opts = productSizeOptions(p);
              return (
                <li
                  key={line.id}
                  className="flex gap-4 p-4 rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm"
                >
                  <div className="w-24 h-24 rounded-xl bg-stone-100 shrink-0 overflow-hidden">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/store/${slug}/product/${p.id}`}
                      className="font-semibold text-[var(--sf-fg)] hover:underline line-clamp-2"
                    >
                      {p.name}
                    </Link>
                    <p className="text-sm text-[var(--sf-muted)] mt-1">{formatINR(p.price)} each</p>
                    {opts.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-xs text-[var(--sf-muted)]">Size</label>
                        <select
                          className="text-sm border border-[var(--sf-border)] rounded-lg px-2 py-1 bg-white"
                          value={line.size ?? opts[0]}
                          onChange={(e) => void changeLineSize(line.id, e.target.value)}
                        >
                          {opts.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center border border-[var(--sf-border)] rounded-lg">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-lg leading-none hover:bg-stone-50 rounded-l-lg"
                          onClick={() => void setQuantity(line.id, line.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="px-3 text-sm font-medium w-10 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-lg leading-none hover:bg-stone-50 rounded-r-lg"
                          onClick={() => void setQuantity(line.id, line.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeLine(line.id)}
                        className="p-2 rounded-lg text-[var(--sf-muted)] hover:text-red-600 hover:bg-red-50"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[var(--sf-fg)]">{formatINR(p.price * line.quantity)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--sf-muted)]">Subtotal</p>
              <p className="text-2xl font-bold text-[var(--sf-fg)]">{formatINR(subtotal)}</p>
            </div>
            <Link
              to={`/store/${slug}/checkout`}
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-white font-semibold shadow-md hover:opacity-95"
              style={{ backgroundColor: accent }}
            >
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
