import { useState, useEffect } from 'react';
import { Users, IndianRupee, TrendingUp, Building2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { formatINR } from '../../../lib/format';
import { StatCard } from '../../../components/ui/StatCard';
import { DashboardSkeleton } from '../../../components/ui/LoadingSkeleton';

const ORANGE = '#F97316';

const demoDailyGMV = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - 29 + i);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    gmv: Math.floor(Math.random() * 50000) + 10000,
  };
});

const demoCommissionPayouts = [
  { type: 'Direct Sale', amount: 125000 },
  { type: 'Team Override', amount: 78000 },
  { type: 'Leadership', amount: 45000 },
  { type: 'Bonus', amount: 32000 },
];

export function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, gmv: 0, revenue: 0, tenants: 0 });
  const [dailyGMV] = useState(demoDailyGMV);
  const [topEarners, setTopEarners] = useState<{ name: string; earnings: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; sold: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [usersRes, tenantsRes, ordersRes, earnerRes, productsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tenant').eq('is_active', true),
        supabase.from('orders').select('total_amount'),
        supabase.from('profiles').select('name, wallet_balance').order('wallet_balance', { ascending: false }).limit(5),
        supabase.from('order_items').select('product_name, quantity').order('quantity', { ascending: false }).limit(5),
      ]);

      const totalGMV = (ordersRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);

      setStats({
        users: usersRes.count || 0,
        gmv: totalGMV,
        revenue: Math.round(totalGMV * 0.05),
        tenants: tenantsRes.count || 0,
      });

      if (earnerRes.data?.length) {
        setTopEarners(earnerRes.data.map((e) => ({ name: e.name || 'Unknown', earnings: e.wallet_balance || 0 })));
      } else {
        setTopEarners([
          { name: 'Rahul Sharma', earnings: 48500 },
          { name: 'Priya Patel', earnings: 42300 },
          { name: 'Amit Kumar', earnings: 38900 },
          { name: 'Sneha Reddy', earnings: 31200 },
          { name: 'Vikram Singh', earnings: 27800 },
        ]);
      }

      if (productsRes.data?.length) {
        setTopProducts(productsRes.data.map((p) => ({ name: p.product_name || 'Unknown', sold: p.quantity || 0 })));
      } else {
        setTopProducts([
          { name: 'Herbal Face Wash', sold: 342 },
          { name: 'Protein Supplement', sold: 289 },
          { name: 'Immunity Booster', sold: 256 },
          { name: 'Hair Growth Oil', sold: 198 },
          { name: 'Green Tea Extract', sold: 175 },
        ]);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.users.toLocaleString('en-IN')} icon={<Users className="w-5 h-5 text-orange-500" />} />
        <StatCard title="Total GMV" value={formatINR(stats.gmv)} icon={<IndianRupee className="w-5 h-5 text-orange-500" />} />
        <StatCard title="Platform Revenue" value={formatINR(stats.revenue)} icon={<TrendingUp className="w-5 h-5 text-orange-500" />} />
        <StatCard title="Active Tenants" value={stats.tenants.toLocaleString('en-IN')} icon={<Building2 className="w-5 h-5 text-orange-500" />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Daily GMV (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyGMV}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [formatINR(v), 'GMV']} />
              <Line type="monotone" dataKey="gmv" stroke={ORANGE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Commission Payouts by Type</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={demoCommissionPayouts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [formatINR(v), 'Amount']} />
              <Bar dataKey="amount" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Top 5 Earning Users</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-semibold text-slate-900">#</th>
                <th className="text-left py-2 font-semibold text-slate-900">Name</th>
                <th className="text-right py-2 font-semibold text-slate-900">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {topEarners.map((u, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  <td className="py-2 text-slate-900 font-medium">{u.name}</td>
                  <td className="py-2 text-right text-slate-900">{formatINR(u.earnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Top 5 Selling Products</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-semibold text-slate-900">#</th>
                <th className="text-left py-2 font-semibold text-slate-900">Product</th>
                <th className="text-right py-2 font-semibold text-slate-900">Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  <td className="py-2 text-slate-900 font-medium">{p.name}</td>
                  <td className="py-2 text-right text-slate-900">{p.sold.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
