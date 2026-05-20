import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useStoreRole } from '../../hooks/useStoreRole';
import { notifyStoreBasketUpdated } from '../../lib/storeEvents';
import type { Product } from '../../types';
import { Package, Heart, ShoppingBag, Zap } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';
import { storeSellableUnits } from '../../lib/storeInventory';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function lineSizeForDb(sizes: string[], selected: string): string | null {
  if (!sizes.length) return null;
  return selected || sizes[0] || null;
}

export function StoreProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { hideStockNumbers } = useStoreRole(tenant.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [listingQuantity, setListingQuantity] = useState(0);
  const [listing, setListing] = useState<{
    user_id: string;
    margin_amount: number;
    seller_display_name: string;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState('');
  const [inWishlist, setInWishlist] = useState(false);

  const resellerParam = searchParams.get('reseller');

  const sizeOptions = product?.sizes && product.sizes.length > 0 ? product.sizes : [];

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!productId) {
        if (!cancel) setProduct(null);
        return;
      }
      const { data: link } = await supabase
        .from('tenant_products')
        .select('product_id, listing_quantity')
        .eq('tenant_id', tenant.id)
        .eq('product_id', productId)
        .maybeSingle();
      if (!link) {
        if (!cancel) setProduct(null);
        if (!cancel) setListingQuantity(0);
        return;
      }
      const lq = Number((link as { listing_quantity?: number }).listing_quantity);
      if (!cancel) setListingQuantity(Number.isFinite(lq) ? lq : 0);
      const { data: p } = await supabase.from('products').select('*').eq('id', productId).eq('is_active', true).maybeSingle();
      const row = p as Product | null;
      if (!cancel) {
        setProduct(row);
        if (row?.sizes && row.sizes.length > 0) setSelectedSize(row.sizes[0]);
        else setSelectedSize('');
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [productId, tenant.id]);

  useEffect(() => {
    let cancel = false;
    async function loadListing() {
      setListing(null);
      if (!productId || !resellerParam || !isUuid(resellerParam)) return;
      const { data: row } = await supabase
        .from('tenant_store_reseller_product_margins')
        .select('user_id, margin_amount, seller_display_name')
        .eq('tenant_id', tenant.id)
        .eq('product_id', productId)
        .eq('user_id', resellerParam)
        .maybeSingle();
      if (cancel) return;
      const m = row as { user_id: string; margin_amount: number; seller_display_name: string } | null;
      if (m && Number(m.margin_amount) > 0 && m.seller_display_name?.trim()) setListing(m);
      else setListing(null);
    }
    void loadListing();
    return () => {
      cancel = true;
    };
  }, [productId, tenant.id, resellerParam]);

  useEffect(() => {
    let cancel = false;
    async function wish() {
      if (!user || !productId) {
        setInWishlist(false);
        return;
      }
      const { data } = await supabase
        .from('store_wishlist_items')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();
      if (!cancel) setInWishlist(!!data);
    }
    wish();
    return () => {
      cancel = true;
    };
  }, [user, productId, tenant.id]);

  const accent = tenant.primary_color || '#ea580c';
  const lineSize = product ? lineSizeForDb(sizeOptions, selectedSize) : null;
  const unitPrice = product ? product.price + (listing?.margin_amount ?? 0) : 0;
  const showResellerListing = !!listing;
  const storeAvailable = useMemo(
    () => (product ? storeSellableUnits(listingQuantity, product.stock) : 0),
    [product, listingQuantity],
  );

  useEffect(() => {
    if (storeAvailable < 1) return;
    setQty((q) => Math.min(Math.max(1, q), storeAvailable));
  }, [storeAvailable]);

  async function addToCart() {
    if (!user || !product || storeAvailable <= 0) return;
    if (sizeOptions.length > 0 && !selectedSize) {
      toast('Select a size', 'error');
      return;
    }
    const q = Math.min(Math.max(1, qty), Math.max(1, storeAvailable));
    const offeredBy = listing ? listing.user_id : null;

    let existingQuery = supabase
      .from('store_cart_items')
      .select('id, quantity')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .eq('product_id', product.id);
    existingQuery = lineSize == null ? existingQuery.is('size', null) : existingQuery.eq('size', lineSize);
    if (offeredBy) existingQuery = existingQuery.eq('offered_by_reseller_id', offeredBy);
    else existingQuery = existingQuery.is('offered_by_reseller_id', null);
    existingQuery = existingQuery.is('purchase_intent', null);

    const { data: existing } = await existingQuery.maybeSingle();
    const row = existing as { id: string; quantity: number } | null;
    const nextQty = row ? row.quantity + q : q;
    if (nextQty > storeAvailable) {
      toast(
        hideStockNumbers
          ? 'Maximum available quantity reached for this item.'
          : `Only ${storeAvailable} available for this store`,
        'error',
      );
      return;
    }
    if (row) {
      const { error } = await supabase.from('store_cart_items').update({ quantity: nextQty }).eq('id', row.id);
      if (error) toast(error.message, 'error');
      else {
        toast('Updated cart');
        notifyStoreBasketUpdated();
      }
    } else {
      const { error } = await supabase.from('store_cart_items').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        product_id: product.id,
        quantity: q,
        size: lineSize,
        offered_by_reseller_id: offeredBy,
        purchase_intent: null,
      });
      if (error) toast(error.message, 'error');
      else {
        toast('Added to cart');
        notifyStoreBasketUpdated();
      }
    }
  }

  async function toggleWishlist() {
    if (!user || !product) {
      toast('Sign in to use your wishlist', 'info');
      navigate(`/store/${slug}/login?next=${encodeURIComponent(`/store/${slug}/product/${productId}`)}`);
      return;
    }
    if (inWishlist) {
      const { error } = await supabase
        .from('store_wishlist_items')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .eq('product_id', product.id);
      if (error) toast(error.message, 'error');
      else {
        setInWishlist(false);
        toast('Removed from wishlist');
        notifyStoreBasketUpdated();
      }
    } else {
      const { error } = await supabase.from('store_wishlist_items').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        product_id: product.id,
      });
      if (error) toast(error.message.includes('duplicate') ? 'Already in wishlist' : error.message, 'error');
      else {
        setInWishlist(true);
        toast('Saved to wishlist');
        notifyStoreBasketUpdated();
      }
    }
  }

  function buyNow() {
    if (!product || storeAvailable <= 0) return;
    if (sizeOptions.length > 0 && !selectedSize) {
      toast('Select a size', 'error');
      return;
    }
    const q = Math.min(Math.max(1, qty), Math.max(1, storeAvailable));
    const sizeQs = lineSize ? `&size=${encodeURIComponent(lineSize)}` : '';
    const resellerQs = listing ? `&reseller=${encodeURIComponent(listing.user_id)}` : '';
    const checkoutQs = `productId=${product.id}&qty=${q}${sizeQs}${resellerQs}`;
    if (!user) {
      toast('Sign in to complete your purchase', 'info');
      navigate(`/store/${slug}/login?next=${encodeURIComponent(`/store/${slug}/checkout?${checkoutQs}`)}`);
      return;
    }
    navigate(`/store/${slug}/checkout?${checkoutQs}`);
  }

  if (product === undefined) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="aspect-square rounded-2xl bg-stone-200 animate-pulse" />
          <div className="space-y-4">
            <div className="h-10 bg-stone-200 rounded animate-pulse" />
            <div className="h-24 bg-stone-100 rounded animate-pulse" />
            <div className="h-12 bg-stone-100 rounded-xl animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product || !productId) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--sf-muted)] mb-4">Product not found in this store.</p>
        <Link to={`/store/${slug}`} className="font-semibold hover:underline" style={{ color: accent }}>
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <nav className="text-sm text-[var(--sf-muted)] mb-6">
        <Link to={`/store/${slug}`} className="hover:text-[var(--sf-fg)]">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--sf-fg)]">Product</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
        <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] overflow-hidden shadow-sm">
          <div className="aspect-square bg-stone-100">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-20 h-20 text-stone-300" />
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-muted)] mb-2">{product.category}</p>
          <h1 className="text-3xl font-bold text-[var(--sf-fg)] mb-4">{product.name}</h1>
          <div className="flex flex-wrap items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-[var(--sf-fg)]">{formatINR(unitPrice)}</span>
            {showResellerListing ? (
              <span className="text-sm text-[var(--sf-muted)]">Store base {formatINR(product.price)} + margin</span>
            ) : product.mrp > product.price ? (
              <span className="text-lg text-[var(--sf-muted)] line-through">{formatINR(product.mrp)}</span>
            ) : null}
          </div>
          {showResellerListing ? (
            <p className="text-sm font-semibold mb-4 -mt-2" style={{ color: accent }}>
              Sold by {listing!.seller_display_name}
            </p>
          ) : null}
          <p className="text-[var(--sf-muted)] leading-relaxed mb-8 whitespace-pre-line">{product.description}</p>
          {showResellerListing ? (
            <p className="text-sm text-[var(--sf-fg)] mb-6 rounded-xl border border-[var(--sf-border)] bg-stone-50 p-3">
              This listing is credited to a reseller partner. You pay <strong>{tenant.store_name}</strong> at checkout
              (cards, UPI, COD, etc., depending on what the store offers); the store fulfills the order. Any reseller
              margin is settled between the store and the reseller — you are not charged by the reseller separately.
            </p>
          ) : null}

          {storeAvailable <= 0 ? (
            <p className="text-red-600 font-medium mb-6">Currently out of stock</p>
          ) : hideStockNumbers ? (
            <p className="text-sm text-green-700 font-medium mb-6">In stock</p>
          ) : (
            <p className="text-sm text-[var(--sf-muted)] mb-6">{storeAvailable} available for this store</p>
          )}

          {sizeOptions.length > 0 ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--sf-fg)] mb-2">Size</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)]"
              >
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-3 mb-8">
            <label className="sr-only" htmlFor="qty">
              Quantity
            </label>
            <input
              id="qty"
              type="number"
              min={1}
              max={Math.max(1, storeAvailable)}
              value={qty}
              disabled={storeAvailable <= 0}
              onChange={(e) =>
                setQty(
                  Math.min(
                    storeAvailable > 0 ? storeAvailable : 1,
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  ),
                )
              }
              className="w-20 px-3 py-2 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] text-center font-medium"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={storeAvailable <= 0}
              onClick={() => buyNow()}
              className="inline-flex flex-1 items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-white font-semibold shadow-md disabled:opacity-45 hover:opacity-95 transition-opacity"
              style={{ backgroundColor: accent }}
            >
              <Zap className="w-5 h-5" />
              Buy now
            </button>
            <button
              type="button"
              disabled={storeAvailable <= 0}
              onClick={() => {
                if (!user) {
                  toast('Sign in to add items to your cart', 'info');
                  const productPath = `/store/${slug}/product/${product.id}${
                    listing ? `?reseller=${encodeURIComponent(listing.user_id)}` : ''
                  }`;
                  navigate(`/store/${slug}/login?next=${encodeURIComponent(productPath)}`);
                  return;
                }
                void addToCart();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 font-semibold border-[var(--sf-border)] bg-[var(--sf-surface)] hover:bg-stone-50 disabled:opacity-45 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              Add to cart
            </button>
            <button
              type="button"
              onClick={() => void toggleWishlist()}
              className={`inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 font-semibold transition-colors ${
                inWishlist
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-[var(--sf-border)] bg-[var(--sf-surface)] hover:bg-stone-50'
              }`}
              aria-pressed={inWishlist}
            >
              <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{inWishlist ? 'Saved' : 'Wishlist'}</span>
            </button>
          </div>

          {!user ? (
            <p className="text-sm text-[var(--sf-muted)] mt-4">
              <Link to={`/store/${slug}/login`} className="font-semibold" style={{ color: accent }}>
                Sign in
              </Link>{' '}
              or{' '}
              <Link to={`/store/${slug}/signup`} className="font-semibold" style={{ color: accent }}>
                create an account
              </Link>{' '}
              to purchase or save items.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
