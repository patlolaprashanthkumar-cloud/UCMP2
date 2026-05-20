import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Filter, ShoppingCart, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../lib/format';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import { invokeEdgeFunction } from '../../lib/edgeFunctions';
import { loadRazorpayScript, openRazorpayModal } from '../../lib/razorpayCheckout';
import type { Product, Role } from '../../types';

const categories = ['All', 'Electronics', 'Fashion', 'Home', 'Health', 'Food', 'Books', 'Other'];
const PAGE_SIZE = 20;

export function ProductsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isShop = location.pathname.includes('/shop');
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadProducts();
  }, [page, category]);

  async function loadProducts() {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category !== 'All') query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setProducts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  function handleSearch() {
    setPage(1);
    loadProducts();
  }

  /** Multiple stores can list the same product — never use maybeSingle() here. */
  async function resolveTenantIdForBuyNow(productId: string, role: Role, userId: string): Promise<string | null> {
    const { data: links, error } = await supabase.from('tenant_products').select('tenant_id').eq('product_id', productId);
    if (error || !links?.length) return null;
    const rows = links as { tenant_id: string }[];
    if (role === 'SAAS_OWNER') {
      const { data: myTenant } = await supabase.from('saas_tenants').select('id').eq('owner_id', userId).maybeSingle();
      if (myTenant?.id) {
        const own = rows.find((r) => r.tenant_id === myTenant.id);
        if (own) return own.tenant_id;
      }
    }
    return rows[0].tenant_id;
  }

  async function handleOrder(product: Product) {
    if (!user) return;
    const tenantId = await resolveTenantIdForBuyNow(product.id, user.role, user.id);
    if (!tenantId) {
      toast('This product is not listed on any store yet, or your store does not list it.', 'error');
      return;
    }
    const { data: trow } = await supabase
      .from('saas_tenants')
      .select('store_name')
      .eq('id', tenantId)
      .maybeSingle();
    const storeName = (trow as { store_name?: string } | null)?.store_name || 'Store';

    try {
      const idempotencyKey = crypto.randomUUID();
      const created = await invokeEdgeFunction<{
        session_id: string;
        razorpay_order_id: string;
        key_id: string;
        amount: number;
      }>('create-razorpay-order', {
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        lines: [
          {
            product_id: product.id,
            quantity: 1,
            size: null,
            offered_by_reseller_id: null,
            purchase_intent: null,
            cart_line_id: null,
          },
        ],
      });

      await loadRazorpayScript();
      openRazorpayModal({
        keyId: created.key_id,
        orderId: created.razorpay_order_id,
        name: storeName,
        description: `Pay ${formatINR(created.amount / 100)}`,
        themeColor: '#0f766e',
        onSuccess: async (resp) => {
          try {
            await invokeEdgeFunction('verify-razorpay-payment', {
              session_id: created.session_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast('Order placed successfully!');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Verification failed', 'error');
          }
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start payment', 'error');
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">{isShop ? 'Shop' : 'Product Catalog'}</h1>
          {user?.role === 'SAAS_OWNER' ? (
            <p className="text-xs text-navy-500 mt-1 max-w-xl">
              Buy Now uses Razorpay and uses <strong>your</strong> store when this product is in your catalog; otherwise
              it uses another store that lists it.
            </p>
          ) : null}
        </div>
        <p className="text-sm text-navy-500 shrink-0">{total} products available</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search products..."
            className="input-field pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="input-field pl-10 pr-8 appearance-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : products.length === 0 ? (
        <EmptyState title="No products found" description="Try adjusting your search or filters" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id} className="card p-4 hover:shadow-md transition-shadow group">
              <div className="aspect-video bg-navy-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingCart className="w-8 h-8 text-navy-300" />
                )}
              </div>
              <span className="text-xs font-medium text-accent-500">{product.category}</span>
              <h3 className="font-semibold text-navy-900 mt-1 line-clamp-1">{product.name}</h3>
              <p className="text-xs text-navy-500 line-clamp-2 mt-1">{product.description}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-lg font-bold text-navy-900">{formatINR(product.price)}</span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-sm text-navy-400 line-through">{formatINR(product.mrp)}</span>
                    <span className="text-xs font-medium text-success-600 bg-success-50 px-1.5 py-0.5 rounded">
                      {Math.round((1 - product.price / product.mrp) * 100)}% off
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {user?.role !== 'VENDOR' ? (
                  <>
                    <button onClick={() => handleOrder(product)} className="btn-primary text-sm flex-1 py-2">
                      <ShoppingCart className="w-4 h-4" />
                      Buy Now
                    </button>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/buy/${product.id}?ref=${user?.id}`;
                        navigator.clipboard.writeText(link);
                        toast('Link copied!');
                      }}
                      className="btn-outline text-sm py-2 px-3 shrink-0"
                      title="Copy share link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/buy/${product.id}?ref=${user?.id}`;
                      navigator.clipboard.writeText(link);
                      toast('Link copied!');
                    }}
                    className="btn-outline text-sm w-full py-2 px-3 inline-flex items-center justify-center gap-2"
                    title="Copy share link"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Copy link
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
