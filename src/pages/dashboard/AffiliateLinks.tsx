import { useState, useEffect, useCallback } from 'react';
import { Link2, Copy, Search, Share2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate, getStatusColor } from '../../lib/format';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Product, Order } from '../../types';

const PER_PAGE = 20;

export function AffiliateLinks() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('name');

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const from = (page - 1) * PER_PAGE;
    const { data, count, error } = await query.range(from, from + PER_PAGE - 1);

    if (error) {
      toast('Failed to load products');
    } else {
      setProducts(data || []);
      setTotalPages(Math.ceil((count || 0) / PER_PAGE));
    }
    setLoading(false);
  }, [search, page, toast]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, product:products(name)')
      .eq('affiliate_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setOrdersLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [search]);

  const generateLink = (productId: string) => {
    const link = `${window.location.origin}/buy/${productId}?ref=${user?.id}`;
    setGeneratedLinks((prev) => ({ ...prev, [productId]: link }));
  };

  const copyLink = async (productId: string) => {
    const link = generatedLinks[productId];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied to clipboard!');
    } catch {
      toast('Failed to copy link');
    }
  };

  const shareWhatsApp = (product: Product) => {
    const link = generatedLinks[product.id] ||
      `${window.location.origin}/buy/${product.id}?ref=${user?.id}`;
    const msg = encodeURIComponent(`Check out ${product.name}! ${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Affiliate Links</h1>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
        />
      </div>

      {/* Product Grid */}
      {loading ? (
        <TableSkeleton />
      ) : products.length === 0 ? (
        <EmptyState icon={<Link2 className="w-8 h-8 text-navy-300" />} title="No products found" description="Try a different search term." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {products.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-xs text-orange-500 font-medium uppercase">{p.category}</p>
                <h3 className="text-navy-900 font-semibold truncate">{p.name}</h3>
                <p className="text-navy-900 font-bold mb-3">{formatINR(p.price)}</p>

                {!generatedLinks[p.id] ? (
                  <button
                    onClick={() => generateLink(p.id)}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                  >
                    Generate Link
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      readOnly
                      value={generatedLinks[p.id]}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-gray-50 text-gray-600 truncate"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => copyLink(p.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-navy-900 text-white rounded text-xs hover:bg-navy-800 transition">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button onClick={() => shareWhatsApp(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition">
                        <Share2 className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
        </>
      )}

      {/* My Earnings */}
      <h2 className="text-xl font-bold text-navy-900 mt-10 mb-4">My Earnings</h2>
      {ordersLoading ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState icon={<Link2 className="w-8 h-8 text-navy-300" />} title="No earnings yet" description="Share your affiliate links to start earning commissions." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-navy-900">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-left px-4 py-3 font-semibold">Order Date</th>
                <th className="text-right px-4 py-3 font-semibold">Amount</th>
                <th className="text-right px-4 py-3 font-semibold">Commission (10%)</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-navy-900">{(o as any).product?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-right text-navy-900">{formatINR(o.total_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-500">{formatINR(o.total_amount * 0.1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(o.status)}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
