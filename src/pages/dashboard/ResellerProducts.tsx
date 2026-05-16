import { useState, useEffect, useCallback } from 'react';
import { Search, Share2, ShoppingBag, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, getStatusColor } from '../../lib/format';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Product, Order } from '../../types';

const PER_PAGE = 20;

export function ResellerProducts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('name');

    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    if (category) query = query.eq('category', category);

    const from = (page - 1) * PER_PAGE;
    const { data, count, error } = await query.range(from, from + PER_PAGE - 1);

    if (error) {
      toast('Failed to load products');
    } else {
      setProducts(data || []);
      setTotalPages(Math.ceil((count || 0) / PER_PAGE));
    }
    setLoading(false);
  }, [search, category, page, toast]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true);
    if (data) {
      const unique = [...new Set(data.map((d) => d.category).filter(Boolean))];
      setCategories(unique.sort());
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, product:products(name, price), buyer:profiles!orders_buyer_id_fkey(name)')
      .eq('reseller_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setOrdersLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [search, category]);

  const shareWhatsApp = (product: Product) => {
    const link = `${window.location.origin}/buy/${product.id}?reseller=${user?.id}`;
    const margin = margins[product.id] || 0;
    const sellingPrice = product.price + margin;
    const msg = encodeURIComponent(
      `${product.name} - only ${formatINR(sellingPrice)}! Order here: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Reseller Products</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-navy-900"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {loading ? (
        <TableSkeleton />
      ) : products.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8 text-navy-300" />} title="No products found" description="Adjust your search or category filter." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {products.map((p) => {
              const margin = margins[p.id] || 0;
              return (
                <div key={p.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-xs text-orange-500 font-medium uppercase">{p.category}</p>
                  <h3 className="text-navy-900 font-semibold truncate">{p.name}</h3>
                  <p className="text-navy-900 font-bold">Base: {formatINR(p.price)}</p>

                  <div className="mt-3">
                    <label className="text-xs text-gray-500">Your margin (INR)</label>
                    <input
                      type="number"
                      min={0}
                      value={margin || ''}
                      placeholder="0"
                      onChange={(e) => setMargins((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                      className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                    <p className="text-sm mt-1 font-semibold text-orange-500">
                      You earn {formatINR(margin)} per sale
                    </p>
                  </div>

                  <button
                    onClick={() => shareWhatsApp(p)}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                  >
                    <Share2 className="w-4 h-4" /> Share on WhatsApp
                  </button>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
        </>
      )}

      {/* My Orders */}
      <h2 className="text-xl font-bold text-navy-900 mt-10 mb-4">My Orders</h2>
      {ordersLoading ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="w-8 h-8 text-navy-300" />} title="No orders yet" description="Share products to start earning from reselling." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-navy-900">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Buyer</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-center px-4 py-3 font-semibold">Qty</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">My Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const prod = (o as any).product;
                const earning = o.total_amount - (prod?.price || 0) * (o.quantity || 1);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-navy-900">{(o as any).buyer?.name || '—'}</td>
                    <td className="px-4 py-3 text-navy-900">{prod?.name || '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{o.quantity || 1}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-500">{formatINR(Math.max(earning, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
