import { useState, useEffect } from 'react';
import { Users, IndianRupee, TrendingUp, Building2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { formatINR } from '../../../lib/format';
import { StatCard } from '../../../components/ui/StatCard';
import { DashboardSkeleton } from '../../../components/ui/LoadingSkeleton';

const ORANGE = '#F97316';

const TX_TYPE_LABEL: Record<string, string> = {
  commission: 'Commission',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
  bonus: 'Bonus',
  subscription: 'Subscription',
};

function buildLast30DaysGMVRows(
  orders: { created_at: string; total_amount: number | null }[],
): { date: string; gmv: number }[] {
  const start = new Date();
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of orders) {
    const k = o.created_at?.slice(0, 10);
    if (k && buckets.has(k)) buckets.set(k, buckets.get(k)! + (o.total_amount || 0));
  }
  return [...buckets.entries()].map(([iso, gmv]) => ({
    date: new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    gmv,
  }));
}

export function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, gmv: 0, revenue: 0, tenants: 0 });
  const [dailyGMV, setDailyGMV] = useState<{ date: string; gmv: number }[]>([]);
  const [commissionPayouts, setCommissionPayouts] = useState<{ type: string; amount: number }[]>([]);
  const [topEarners, setTopEarners] = useState<{ name: string; earnings: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const start30 = new Date();
      start30.setDate(start30.getDate() - 29);
      start30.setHours(0, 0, 0, 0);

      const [usersRes, tenantsRes, ordersRes, orders30Res, txRes, walletRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('saas_tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('total_amount'),
        supabase.from('orders').select('created_at, total_amount').gte('created_at', start30.toISOString()),
        supabase.from('transactions').select('type, amount').eq('status', 'completed'),
        supabase
          .from('wallets')
          .select('total_earned, profiles(name)')
          .order('total_earned', { ascending: false })
          .limit(5),
      ]);

      const totalGMV = (ordersRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);

      setStats({
        users: usersRes.count || 0,
        gmv: totalGMV,
        revenue: Math.round(totalGMV * 0.05),
        tenants: tenantsRes.count || 0,
      });

      setDailyGMV(buildLast30DaysGMVRows(orders30Res.data || []));

      const payoutMap = new Map<string, number>();
      for (const t of txRes.data || []) {
        const label = TX_TYPE_LABEL[t.type] || t.type;
        payoutMap.set(label, (payoutMap.get(label) || 0) + (t.amount || 0));
      }
      setCommissionPayouts([...payoutMap.entries()].map(([type, amount]) => ({ type, amount })));

      const earners: { name: string; earnings: number }[] = [];
      for (const row of walletRes.data || []) {
        const prof = row.profiles as { name?: string } | null;
        earners.push({ name: prof?.name || 'Unknown', earnings: row.total_earned || 0 });
      }
      setTopEarners(earners);

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
          {dailyGMV.length === 0 || dailyGMV.every((d) => d.gmv === 0) ? (
            <p className="text-sm text-slate-500 py-16 text-center">No order volume in the last 30 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyGMV}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatINR(Number(v)), 'GMV']} />
                <Line type="monotone" dataKey="gmv" stroke={ORANGE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Completed transactions by type</h2>
          {commissionPayouts.length === 0 ? (
            <p className="text-sm text-slate-500 py-16 text-center">No completed transactions to chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={commissionPayouts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatINR(Number(v)), 'Amount']} />
                <Bar dataKey="amount" fill={ORANGE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Top 5 by wallet (total earned)</h2>
        {topEarners.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No wallet data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-semibold text-slate-900">#</th>
                <th className="text-left py-2 font-semibold text-slate-900">Name</th>
                <th className="text-right py-2 font-semibold text-slate-900">Total earned</th>
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
        )}
      </div>
    </div>
  );
}
