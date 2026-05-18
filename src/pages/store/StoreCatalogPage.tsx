import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { Product } from '../../types';
import { Package, ArrowRight } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

export function StoreCatalogPage() {
  const { user } = useAuth();
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      const { data: links } = await supabase.from('tenant_products').select('product_id').eq('tenant_id', tenant.id);
      const ids = links?.map((r) => r.product_id) || [];
      if (ids.length === 0) {
        if (!cancel) setProducts([]);
        setLoading(false);
        return;
      }
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .in('id', ids)
        .eq('is_active', true);
      if (!cancel) setProducts((prods as Product[]) || []);
      setLoading(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [tenant.id]);

  const accent = tenant.primary_color || '#ea580c';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="h-56 rounded-2xl bg-stone-200/80 animate-pulse mb-10" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] overflow-hidden shadow-sm">
              <div className="aspect-[4/3] bg-stone-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-stone-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-stone-100 rounded animate-pulse w-full" />
                <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 45%, #1c1917 100%)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20">
          <p className="text-white/90 text-sm font-medium tracking-wide uppercase mb-2">{tenant.store_name}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-xl mb-4">
            Find something you will love
          </h1>
          <p className="text-white/85 max-w-lg mb-8 text-lg">
            Curated products with simple checkout — add to cart, save to your wishlist, or buy in one tap.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`#catalog`}
              className="inline-flex items-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl border-2 border-white font-bold text-base sm:text-lg text-white hover:bg-white/15 transition-colors"
            >
              Shop all products
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              to={`/store/${slug}/cart`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white font-semibold shadow-lg hover:bg-stone-50 transition-colors"
              style={{ color: accent }}
            >
              View cart
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!user ? (
              <Link
                to={`/store/${slug}/signup`}
                className="inline-flex items-center px-5 py-3 rounded-xl border-2 border-white/40 font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Create account
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12" id="catalog">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--sf-fg)]">All products</h2>
            <p className="text-[var(--sf-muted)] mt-1">{products.length} items in this store</p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-[var(--sf-muted)] mb-3" />
            <p className="text-[var(--sf-muted)]">No products listed yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/store/${slug}/product/${p.id}`}
                className="group rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-stone-300" />
                    </div>
                  )}
                  {p.stock <= 0 ? (
                    <span className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-lg bg-stone-900/80 text-white">
                      Out of stock
                    </span>
                  ) : null}
                  {p.mrp > p.price ? (
                    <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white">
                      Sale
                    </span>
                  ) : null}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-[var(--sf-fg)] line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-[var(--sf-fg)]">{formatINR(p.price)}</span>
                    {p.mrp > p.price ? (
                      <span className="text-sm text-[var(--sf-muted)] line-through">{formatINR(p.mrp)}</span>
                    ) : null}
                  </div>
                  <span
                    className="mt-4 inline-flex text-sm font-semibold items-center gap-1"
                    style={{ color: accent }}
                  >
                    View product
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
