import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ShoppingBag, Truck, PackageCheck, RotateCcw, DollarSign, PieChart, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, getStatusColor } from '../../lib/format';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import { StatCard } from '../../components/ui/StatCard';
import type { Order } from '../../types';

const STATUSES = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
const PER_PAGE = 20;

export function VendorOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  const totalPages = Math.ceil(total / PER_PAGE);

  const earnings = useMemo(() => {
    const delivered = allOrders.filter((o) => o.status === 'delivered');
    const totalSales = delivered.reduce((s, o) => s + o.total_amount, 0);
    return { totalSales, platformCut: totalSales * 0.3, netReceived: totalSales * 0.7 };
  }, [allOrders]);

  /* Fetch all orders once for earnings summary */
  const fetchAllOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('total_amount, status, product:products!inner(vendor_id)')
      .eq('product.vendor_id', user.id);
    setAllOrders((data as unknown as Order[]) || []);
  }, [user]);

  /* Fetch paginated orders */
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, product:products!inner(*), buyer:profiles!orders_buyer_id_fkey(*)', { count: 'exact' })
      .eq('product.vendor_id', user.id)
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search.trim()) query = query.ilike('id', `%${search.trim()}%`);
    const from = (page - 1) * PER_PAGE;
    query = query.range(from, from + PER_PAGE - 1);
    const { data, count, error } = await query;
    if (error) toast(error.message, 'error');
    setOrders((data as unknown as Order[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [user, statusFilter, search, page, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchAllOrders(); }, [fetchAllOrders]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) { toast(error.message, 'error'); return; }
    toast(`Order marked as ${status}`, 'success');
    fetchOrders();
    fetchAllOrders();
  };

  const truncateId = (id: string) => id.length > 8 ? id.slice(0, 8) + '...' : id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Orders Received</h1>

      {/* Earnings summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Sales" value={formatINR(earnings.totalSales)} icon={<DollarSign className="w-5 h-5" />} color="accent" />
        <StatCard title="Platform Cut (30%)" value={formatINR(earnings.platformCut)} icon={<PieChart className="w-5 h-5" />} color="navy" />
        <StatCard title="Net Received (70%)" value={formatINR(earnings.netReceived)} icon={<Wallet className="w-5 h-5" />} color="success" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input type="text" placeholder="Search by Order ID..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder:text-navy-400 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-700 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={7} /></div>
        ) : orders.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="w-8 h-8 text-navy-300" />} title="No orders found" description="Orders for your products will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 text-left text-navy-600">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-navy-600" title={o.id}>{truncateId(o.id)}</td>
                    <td className="px-4 py-3 text-navy-700">{o.buyer?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-navy-900 max-w-[160px] truncate">{o.product?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-navy-700">{o.quantity}</td>
                    <td className="px-4 py-3 font-medium text-navy-900">{formatINR(o.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(o.status === 'pending' || o.status === 'confirmed') && (
                          <button onClick={() => updateStatus(o.id, 'shipped')}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                            <Truck className="w-3.5 h-3.5" /> Ship
                          </button>
                        )}
                        {o.status === 'shipped' && (
                          <button onClick={() => updateStatus(o.id, 'delivered')}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                            <PackageCheck className="w-3.5 h-3.5" /> Deliver
                          </button>
                        )}
                        {o.status === 'delivered' && (
                          <button onClick={() => updateStatus(o.id, 'returned')}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" /> Return
                          </button>
                        )}
                        {o.status === 'cancelled' || o.status === 'returned' ? (
                          <span className="text-xs text-navy-400 italic px-2">No actions</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
