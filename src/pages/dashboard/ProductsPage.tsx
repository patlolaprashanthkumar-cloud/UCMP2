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
import type { Product } from '../../types';

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

  async function handleOrder(product: Product) {
    if (!user) return;
    const { data: linkRow } = await supabase
      .from('tenant_products')
      .select('tenant_id')
      .eq('product_id', product.id)
      .limit(1)
      .maybeSingle();
    const row: { tenant_id?: string } | null = linkRow;
    const { error } = await supabase.from('orders').insert({
      buyer_id: user.id,
      product_id: product.id,
      quantity: 1,
      total_amount: product.price,
      status: 'confirmed',
      payment_timing: 'prepaid',
      payment_status: 'paid',
      ...(row?.tenant_id ? { tenant_id: row.tenant_id } : {}),
    });
    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Order placed successfully!');
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="page-header">{isShop ? 'Shop' : 'Product Catalog'}</h1>
        <p className="text-sm text-navy-500">{total} products available</p>
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
                  className="btn-outline text-sm py-2 px-3"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
