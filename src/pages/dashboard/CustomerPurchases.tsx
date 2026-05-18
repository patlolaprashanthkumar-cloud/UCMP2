import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate } from '../../lib/format';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Order } from '../../types';
import { ShoppingCart } from 'lucide-react';

export function CustomerPurchases() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<(Order & { product?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, product:products(name)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });
    setOrders((data as typeof orders) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;
  if (user.role !== 'CUSTOMER') return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">My purchases</h1>
      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="w-10 h-10 text-navy-300" />}
          title="No orders yet"
          description="Browse the shop and place your first order."
        />
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 divide-y divide-navy-50">
          {orders.map((o) => (
            <div key={o.id} className="px-4 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-navy-900">{o.product?.name || `Order ${o.id.slice(0, 8)}`}</p>
                <p className="text-xs text-navy-500">{formatDate(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-navy-900">{formatINR(o.total_amount)}</p>
                <span className="text-xs font-medium text-navy-500 capitalize">{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
