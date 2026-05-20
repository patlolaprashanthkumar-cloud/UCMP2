import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { storeSellableUnits } from '../../lib/storeInventory';
import type { Product } from '../../types';
import { Package, ArrowRight, Search } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

const UNCATEGORIZED = 'Uncategorized';

function categoryLabel(p: Product): string {
  const c = p.category?.trim();
  return c || UNCATEGORIZED;
}

function slugifySegment(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'category';
}

function sectionIdForCategory(label: string): string {
  return `catalog-${slugifySegment(label)}`;
}

function catalogDescriptionSnippet(description: string | undefined): string | null {
  const t = (description ?? '').trim();
  return t ? t : null;
}

type SortKey = 'name' | 'price-asc' | 'price-desc';

type PublicResellerMargin = {
  user_id: string;
  product_id: string;
  margin_amount: number;
  seller_display_name: string;
};

export function StoreCatalogPage() {
  const { user } = useAuth();
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [listingByProductId, setListingByProductId] = useState<Record<string, number>>({});
  const [resellerMargins, setResellerMargins] = useState<PublicResellerMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      const { data: links } = await supabase
        .from('tenant_products')
        .select('product_id, listing_quantity')
        .eq('tenant_id', tenant.id);
      const ids = links?.map((r) => r.product_id) || [];
      if (ids.length === 0) {
        if (!cancel) setProducts([]);
        if (!cancel) setListingByProductId({});
        setLoading(false);
        return;
      }
      const listingMap: Record<string, number> = {};
      for (const row of links || []) {
        const pid = (row as { product_id: string }).product_id;
        const lq = Number((row as { listing_quantity?: number }).listing_quantity);
        listingMap[pid] = Number.isFinite(lq) ? lq : 0;
      }
      if (!cancel) setListingByProductId(listingMap);
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .in('id', ids)
        .eq('is_active', true);
      if (!cancel) setProducts((prods as Product[]) || []);

      const { data: mar } = await supabase
        .from('tenant_store_reseller_product_margins')
        .select('user_id, product_id, margin_amount, seller_display_name')
        .eq('tenant_id', tenant.id)
        .gt('margin_amount', 0);
      if (!cancel) {
        const rows = (mar || []) as PublicResellerMargin[];
        setResellerMargins(rows.filter((r) => r.seller_display_name?.trim()));
      }
      setLoading(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [tenant.id]);

  const marginsByProduct = useMemo(() => {
    const m = new Map<string, PublicResellerMargin[]>();
    for (const row of resellerMargins) {
      const list = m.get(row.product_id) ?? [];
      list.push(row);
      m.set(row.product_id, list);
    }
    return m;
  }, [resellerMargins]);

  const categoryLabels = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      set.add(categoryLabel(p));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categoryParam = searchParams.get('category') ?? '';
  const selectedCategory =
    categoryParam && categoryLabels.includes(categoryParam) ? categoryParam : 'all';

  function setCategoryFilter(cat: 'all' | string) {
    const next = new URLSearchParams(searchParams);
    if (cat === 'all') {
      next.delete('category');
    } else {
      next.set('category', cat);
    }
    setSearchParams(next, { replace: true });
  }

  const filteredSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (!q) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description?.toLowerCase().includes(q)) return true;
      return false;
    });
    if (selectedCategory !== 'all') {
      list = list.filter((p) => categoryLabel(p) === selectedCategory);
    }
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'price-asc') return a.price - b.price;
      if (sortKey === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [products, searchQuery, selectedCategory, sortKey]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredSorted) {
      const cat = categoryLabel(p);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return keys.map((category) => ({ category, products: map.get(category)! }));
  }, [filteredSorted]);

  const accent = tenant.primary_color || '#ea580c';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="h-56 rounded-2xl bg-stone-200/80 animate-pulse mb-10" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] overflow-hidden shadow-sm"
            >
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
              href="#catalog"
              className="inline-flex items-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl border-2 border-white font-bold text-base sm:text-lg text-white hover:bg-white/15 transition-colors"
            >
              Shop all products
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              to={`/store/${slug}/about`}
              className="inline-flex items-center px-5 py-3 rounded-xl border-2 border-white/40 font-semibold text-white hover:bg-white/10 transition-colors"
            >
              About us
            </Link>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--sf-fg)]">Browse catalog</h2>
          <p className="text-[var(--sf-muted)] mt-1">
            {filteredSorted.length} of {products.length} items
            {selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-8 p-4 rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--sf-muted)]" />
            <input
              type="search"
              placeholder="Search by name or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] text-[var(--sf-fg)] placeholder:text-[var(--sf-muted)] focus:ring-2 focus:ring-stone-400 focus:outline-none"
              aria-label="Search products"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <label className="text-sm font-medium text-[var(--sf-fg)] shrink-0">Category</label>
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'text-white shadow-sm'
                    : 'bg-[var(--sf-bg)] text-[var(--sf-muted)] border border-[var(--sf-border)] hover:border-[var(--sf-muted)]'
                }`}
                style={selectedCategory === 'all' ? { backgroundColor: accent } : undefined}
              >
                All
              </button>
              {categoryLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCategoryFilter(label)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors max-w-[14rem] truncate ${
                    selectedCategory === label
                      ? 'text-white shadow-sm'
                      : 'bg-[var(--sf-bg)] text-[var(--sf-muted)] border border-[var(--sf-border)] hover:border-[var(--sf-muted)]'
                  }`}
                  style={selectedCategory === label ? { backgroundColor: accent } : undefined}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="store-sort" className="text-sm font-medium text-[var(--sf-fg)] whitespace-nowrap">
                Sort
              </label>
              <select
                id="store-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-sm rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-[var(--sf-fg)] focus:ring-2 focus:ring-stone-400 focus:outline-none min-w-[10rem]"
              >
                <option value="name">Name (A–Z)</option>
                <option value="price-asc">Price (low to high)</option>
                <option value="price-desc">Price (high to low)</option>
              </select>
            </div>
          </div>
          {selectedCategory === 'all' && groupedByCategory.length > 1 ? (
            <div className="pt-1 border-t border-[var(--sf-border)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-muted)] mb-2">Jump to</p>
              <div className="flex flex-wrap gap-2">
                {groupedByCategory.map(({ category }) => (
                  <a
                    key={category}
                    href={`#${sectionIdForCategory(category)}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: accent }}
                  >
                    {category}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-[var(--sf-muted)] mb-3" />
            <p className="text-[var(--sf-muted)]">No products listed yet. Check back soon.</p>
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-[var(--sf-muted)] mb-3" />
            <p className="text-[var(--sf-muted)]">No products match your search or filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
              }}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{ color: accent }}
            >
              Clear search &amp; filters
            </button>
          </div>
        ) : (
          <div className="space-y-14">
            {groupedByCategory.map(({ category, products: catProducts }) => {
              const resellerExtraCount = catProducts.reduce(
                (s, p) => s + (marginsByProduct.get(p.id)?.length ?? 0),
                0,
              );
              return (
              <section key={category} id={sectionIdForCategory(category)} className="scroll-mt-24">
                <h3 className="text-xl font-bold text-[var(--sf-fg)] mb-6 pb-2 border-b border-[var(--sf-border)]">
                  {category}
                  <span className="ml-2 text-base font-normal text-[var(--sf-muted)]">
                    ({catProducts.length}
                    {resellerExtraCount > 0 ? ` + ${resellerExtraCount} reseller` : ''})
                  </span>
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catProducts.flatMap((p) => {
                    const extras = marginsByProduct.get(p.id) ?? [];
                    const sellable = storeSellableUnits(listingByProductId[p.id] ?? 0, p.stock);
                    const baseCard = (
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
                          {sellable <= 0 ? (
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
                          {catalogDescriptionSnippet(p.description) ? (
                            <p className="text-sm text-[var(--sf-muted)] line-clamp-3 mt-2 leading-relaxed">
                              {catalogDescriptionSnippet(p.description)}
                            </p>
                          ) : null}
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
                    );
                    const resellerCards = extras.map((m) => {
                      const sellPrice = p.price + m.margin_amount;
                      return (
                        <Link
                          key={`${p.id}-r-${m.user_id}`}
                          to={`/store/${slug}/product/${p.id}?reseller=${m.user_id}`}
                          className="group rounded-2xl border-2 border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
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
                            {sellable <= 0 ? (
                              <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-1 rounded-lg bg-stone-900/80 text-white">
                                Out of stock
                              </span>
                            ) : null}
                            <span
                              className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-lg text-white max-w-[90%] truncate"
                              style={{ backgroundColor: accent }}
                              title={`Sold by ${m.seller_display_name}`}
                            >
                              Sold by {m.seller_display_name}
                            </span>
                          </div>
                          <div className="p-5">
                            <h3 className="font-semibold text-[var(--sf-fg)] line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                            {catalogDescriptionSnippet(p.description) ? (
                              <p className="text-sm text-[var(--sf-muted)] line-clamp-3 mt-2 leading-relaxed">
                                {catalogDescriptionSnippet(p.description)}
                              </p>
                            ) : null}
                            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                              <span className="text-xl font-bold text-[var(--sf-fg)]">{formatINR(sellPrice)}</span>
                              <span className="text-xs text-[var(--sf-muted)]">incl. reseller margin; you pay the store</span>
                            </div>
                            <span
                              className="mt-4 inline-flex text-sm font-semibold items-center gap-1"
                              style={{ color: accent }}
                            >
                              View listing
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </Link>
                      );
                    });
                    return [baseCard, ...resellerCards];
                  })}
                </div>
              </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
