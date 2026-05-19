import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useStoreRole } from '../../hooks/useStoreRole';
import { notifyStoreBasketUpdated } from '../../lib/storeEvents';
import { storeSellableUnits } from '../../lib/storeInventory';
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
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [listingByProductId, setListingByProductId] = useState<Record<string, number>>({});

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

  useEffect(() => {
    let cancel = false;
    void (async () => {
      if (!lines.length) {
        if (!cancel) setUnitPrices({});
        return;
      }
      const ids = [...new Set(lines.map((r) => r.product_id))];
      const { data: marginRows } = ids.length
        ? await supabase
            .from('tenant_store_reseller_product_margins')
            .select('product_id, user_id, margin_amount')
            .eq('tenant_id', tenant.id)
            .in('product_id', ids)
        : { data: [] as { product_id: string; user_id: string; margin_amount: number }[] };
      if (cancel) return;
      const marginMap = new Map<string, number>();
      for (const m of marginRows || []) {
        marginMap.set(`${m.product_id}:${m.user_id}`, Number(m.margin_amount));
      }
      const next: Record<string, number> = {};
      for (const line of lines) {
        const p = line.product as Product | undefined;
        if (!p) continue;
        let unit = p.price;
        if (line.offered_by_reseller_id) {
          const add = marginMap.get(`${p.id}:${line.offered_by_reseller_id}`) ?? 0;
          unit = p.price + add;
        }
        next[line.id] = unit;
      }
      setUnitPrices(next);
    })();
    return () => {
      cancel = true;
    };
  }, [lines, tenant.id]);

  function maxQtyForLine(prod: Product, purchaseIntent: string | null | undefined): number {
    if (purchaseIntent === 'resale_stock') return Math.max(0, Math.floor(Number(prod.stock)) || 0);
    return storeSellableUnits(listingByProductId[prod.id] ?? 0, prod.stock);
  }

  useEffect(() => {
    let cancel = false;
    void (async () => {
      if (!lines.length) {
        if (!cancel) setListingByProductId({});
        return;
      }
      const ids = [...new Set(lines.map((r) => r.product_id))];
      const { data: rows } = await supabase
        .from('tenant_products')
        .select('product_id, listing_quantity')
        .eq('tenant_id', tenant.id)
        .in('product_id', ids);
      if (cancel) return;
      const map: Record<string, number> = {};
      for (const row of rows || []) {
        const pid = (row as { product_id: string }).product_id;
        const lq = Number((row as { listing_quantity?: number }).listing_quantity);
        map[pid] = Number.isFinite(lq) ? lq : 0;
      }
      setListingByProductId(map);
    })();
    return () => {
      cancel = true;
    };
  }, [lines, tenant.id]);

  async function setQuantity(lineId: string, next: number) {
    if (next < 1) return;
    const line = lines.find((l) => l.id === lineId);
    const prod = line?.product as Product | undefined;
    const cap = prod ? maxQtyForLine(prod, line?.purchase_intent) : 0;
    if (prod && next > cap) {
      toast(
        hideStockNumbers
          ? 'Maximum available quantity reached for this item.'
          : `Only ${cap} available for ${prod.name}`,
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

    const maxQ = maxQtyForLine(prod, line.purchase_intent);
    if (maxQ < 1) {
      toast(
        hideStockNumbers
          ? 'This item is no longer available.'
          : `${prod.name} is out of stock for this store.`,
        'error',
      );
      return;
    }
    const qty = Math.min(line.quantity, maxQ);

    let existingQ = supabase
      .from('store_cart_items')
      .select('id, quantity')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .eq('product_id', prod.id)
      .eq('size', newSize);
    if (line.offered_by_reseller_id) {
      existingQ = existingQ.eq('offered_by_reseller_id', line.offered_by_reseller_id);
    } else {
      existingQ = existingQ.is('offered_by_reseller_id', null);
    }
    if (line.purchase_intent === 'resale_stock') {
      existingQ = existingQ.eq('purchase_intent', 'resale_stock');
    } else {
      existingQ = existingQ.is('purchase_intent', null);
    }
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
      const { error } = await supabase
        .from('store_cart_items')
        .update({ size: newSize, quantity: qty })
        .eq('id', lineId);
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
    if (!p) return s;
    const u = unitPrices[l.id] ?? p.price;
    return s + u * l.quantity;
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
                      to={
                        line.offered_by_reseller_id
                          ? `/store/${slug}/product/${p.id}?reseller=${line.offered_by_reseller_id}`
                          : `/store/${slug}/product/${p.id}`
                      }
                      className="font-semibold text-[var(--sf-fg)] hover:underline line-clamp-2"
                    >
                      {p.name}
                    </Link>
                    {line.purchase_intent === 'resale_stock' ? (
                      <p className="text-xs text-amber-800 font-medium mt-0.5">For resale stock (base price)</p>
                    ) : null}
                    {line.offered_by_reseller_id ? (
                      <p className="text-xs text-[var(--sf-muted)] mt-0.5">Reseller listing</p>
                    ) : null}
                    <p className="text-sm text-[var(--sf-muted)] mt-1">
                      {formatINR(unitPrices[line.id] ?? p.price)} each
                    </p>
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
                    <p className="font-bold text-[var(--sf-fg)]">
                      {formatINR((unitPrices[line.id] ?? p.price) * line.quantity)}
                    </p>
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
