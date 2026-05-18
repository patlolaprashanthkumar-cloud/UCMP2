import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { notifyStoreBasketUpdated } from '../../lib/storeEvents';
import type { StoreWishlistItem, Product } from '../../types';
import { Heart, Package, Trash2 } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

export function StoreWishlistPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<StoreWishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const accent = tenant.primary_color || '#ea580c';

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('store_wishlist_items')
        .select('*, product:products(*)')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!cancel) setItems((data as StoreWishlistItem[]) || []);
      setLoading(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [user, tenant.id]);

  async function remove(itemId: string) {
    const { error } = await supabase.from('store_wishlist_items').delete().eq('id', itemId);
    if (error) toast(error.message, 'error');
    else {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      notifyStoreBasketUpdated();
    }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Heart className="w-14 h-14 mx-auto text-[var(--sf-muted)] mb-4" />
        <h1 className="text-xl font-bold text-[var(--sf-fg)] mb-2">Sign in for your wishlist</h1>
        <p className="text-[var(--sf-muted)] mb-6">Save products you love across visits.</p>
        <Link
          to={`/store/${slug}/login?next=${encodeURIComponent(`/store/${slug}/wishlist`)}`}
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
      <div className="max-w-4xl mx-auto px-4 py-12 grid sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-stone-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[var(--sf-fg)] mb-2">Wishlist</h1>
      <p className="text-[var(--sf-muted)] mb-8">{items.length} saved items</p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-14 text-center">
          <Heart className="w-12 h-12 mx-auto text-[var(--sf-muted)] mb-3" />
          <p className="text-[var(--sf-muted)] mb-6">Nothing saved yet.</p>
          <Link to={`/store/${slug}`} className="font-semibold hover:underline" style={{ color: accent }}>
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {items.map((row) => {
            const p = row.product as Product | undefined;
            if (!p) return null;
            return (
              <li
                key={row.id}
                className="flex gap-3 p-4 rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm"
              >
                <Link to={`/store/${slug}/product/${p.id}`} className="w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-stone-300" />
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/store/${slug}/product/${p.id}`}
                    className="font-semibold text-[var(--sf-fg)] line-clamp-2 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="text-sm font-bold mt-2 text-[var(--sf-fg)]">{formatINR(p.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  className="self-start p-2 rounded-lg text-[var(--sf-muted)] hover:text-red-600 hover:bg-red-50"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
