import { useEffect, useState, useCallback } from 'react';
import { Link, Outlet, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { rememberStoreSlug } from '../../lib/postLoginRedirect';
import type { SaasTenant } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Package, ShoppingBag, Heart, User, Store } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

export function StoreLayout() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [tenant, setTenant] = useState<SaasTenant | null | undefined>(undefined);
  const [cartCount, setCartCount] = useState(0);
  const [wishCount, setWishCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    if (!user || !tenant) {
      setCartCount(0);
      setWishCount(0);
      return;
    }
    const [{ count: c }, { count: w }] = await Promise.all([
      supabase.from('store_cart_items').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('user_id', user.id),
      supabase.from('store_wishlist_items').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('user_id', user.id),
    ]);
    setCartCount(c || 0);
    setWishCount(w || 0);
  }, [user, tenant]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!slug) {
        setTenant(null);
        return;
      }
      rememberStoreSlug(slug);
      const { data: t } = await supabase
        .from('saas_tenants')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (!cancel) setTenant(t);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [slug]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!tenant?.id) return;
    try {
      const ref = q.get('ref');
      if (ref) sessionStorage.setItem(`ucmp_store_ref_${tenant.id}`, ref);
      const reseller = q.get('reseller');
      if (reseller) sessionStorage.setItem(`ucmp_store_reseller_${tenant.id}`, reseller);
    } catch {
      /* ignore */
    }
  }, [location.search, tenant?.id]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    const fn = () => void refreshCounts();
    window.addEventListener('ucmp-store-basket-updated', fn);
    return () => window.removeEventListener('ucmp-store-basket-updated', fn);
  }, [refreshCounts]);

  useEffect(() => {
    const onFocus = () => void refreshCounts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshCounts]);

  const accent = tenant?.primary_color || '#ea580c';

  if (tenant === undefined) {
    return (
      <div className="store-front min-h-screen bg-[var(--sf-bg)] flex items-center justify-center">
        <p className="text-[var(--sf-muted)]">Loading store…</p>
      </div>
    );
  }

  if (!tenant || !slug) {
    return (
      <div className="store-front min-h-screen bg-[var(--sf-bg)] flex flex-col items-center justify-center px-4">
        <Package className="w-12 h-12 text-[var(--sf-muted)] mb-4" />
        <p className="text-[var(--sf-fg)] font-medium mb-4">This store is not available.</p>
        <Link to="/" className="text-sm font-semibold hover:underline" style={{ color: accent }}>
          Back to home
        </Link>
      </div>
    );
  }

  const ctx: StoreOutletContext = { tenant, slug };

  return (
    <div
      className="store-front min-h-screen flex flex-col bg-[var(--sf-bg)] text-[var(--sf-fg)]"
      style={
        {
          '--sf-accent': accent,
          '--sf-bg': '#fafaf9',
          '--sf-surface': '#ffffff',
          '--sf-fg': '#1c1917',
          '--sf-muted': '#78716c',
          '--sf-border': '#e7e5e4',
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-40 border-b border-[var(--sf-border)] bg-[var(--sf-surface)]/95 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={`/store/${slug}`} className="flex items-center gap-3 min-w-0">
            {tenant.logo ? (
              <img src={tenant.logo} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 border border-[var(--sf-border)]" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: accent }}
              >
                {tenant.store_name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-[var(--sf-fg)] truncate">{tenant.store_name}</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-wrap justify-end">
            <Link
              to={`/store/${slug}/about`}
              className="hidden sm:inline-flex px-2 py-1.5 rounded-lg text-sm font-medium text-[var(--sf-muted)] hover:text-[var(--sf-fg)] hover:bg-stone-100"
            >
              About
            </Link>
            <Link
              to={`/store/${slug}/terms`}
              className="hidden sm:inline-flex px-2 py-1.5 rounded-lg text-sm font-medium text-[var(--sf-muted)] hover:text-[var(--sf-fg)] hover:bg-stone-100"
            >
              Terms
            </Link>
            <Link
              to={`/store/${slug}#catalog`}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-bold text-white shadow-lg hover:opacity-95 transition-opacity shrink-0 order-first sm:order-none"
              style={{ backgroundColor: accent }}
            >
              <Store className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <span>Shop</span>
            </Link>
            <Link
              to={`/store/${slug}/cart`}
              className="relative p-2.5 rounded-xl text-[var(--sf-fg)] hover:bg-stone-100 transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 ? (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
                  style={{ backgroundColor: accent }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              ) : null}
            </Link>
            <Link
              to={`/store/${slug}/wishlist`}
              className="relative p-2.5 rounded-xl text-[var(--sf-fg)] hover:bg-stone-100 transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishCount > 0 ? (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
                  style={{ backgroundColor: accent }}
                >
                  {wishCount > 99 ? '99+' : wishCount}
                </span>
              ) : null}
            </Link>
            {user ? (
              <Link
                to={`/store/${slug}/account`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--sf-fg)] hover:bg-stone-100 transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </Link>
            ) : (
              <Link
                to={`/store/${slug}/login`}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
                style={{ backgroundColor: accent }}
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet context={ctx} />
      </main>

      <footer className="border-t border-[var(--sf-border)] bg-[var(--sf-surface)] mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--sf-muted)]">
          <p>&copy; {new Date().getFullYear()} {tenant.store_name}</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-2">
            <Link to={`/store/${slug}/about`} className="text-sm font-medium hover:text-[var(--sf-fg)] hover:underline">
              About us
            </Link>
            <Link to={`/store/${slug}/terms`} className="text-sm font-medium hover:text-[var(--sf-fg)] hover:underline">
              Terms &amp; conditions
            </Link>
            <Link
              to={`/store/${slug}#catalog`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-base font-bold text-white shadow-md hover:opacity-95 min-w-[10rem]"
              style={{ backgroundColor: accent }}
            >
              Shop
            </Link>
            {!user ? (
              <Link to={`/store/${slug}/signup`} className="text-sm font-semibold hover:text-[var(--sf-fg)] hover:underline">
                Create account
              </Link>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
