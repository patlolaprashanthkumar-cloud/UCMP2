import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate, getRoleLabel } from '../../lib/format';
import { StatCard } from '../../components/ui/StatCard';
import { DashboardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Role, Order, Transaction, Wallet, ChallengeProgress } from '../../types';
import {
  DollarSign, Users, ShoppingCart, Package, TrendingUp,
  ClipboardList, AlertTriangle, Store, UserCheck, Layers,
  Copy, Check, Target, Clock,
} from 'lucide-react';

interface DashboardStats {
  stats: { title: string; value: string; icon: React.ReactNode; trend?: number; color?: 'accent' | 'success' | 'blue' | 'navy' }[];
  recentActivity: (Order | Transaction)[];
  challenges: ChallengeProgress[];
  wallet: Wallet | null;
}

const DEMO_CHALLENGES: ChallengeProgress[] = [
  { id: '1', user_id: '', challenge_id: '1', current_value: 3, is_completed: false, reward_claimed: false, created_at: '', challenge: { id: '1', title: 'Share 5 Products', description: 'Share 5 products today', type: 'daily', target_value: 5, reward_amount: 50, is_active: true, start_date: '', end_date: null, created_at: '' } },
  { id: '2', user_id: '', challenge_id: '2', current_value: 1, is_completed: false, reward_claimed: false, created_at: '', challenge: { id: '2', title: 'Get 2 Orders', description: 'Get 2 orders today', type: 'daily', target_value: 2, reward_amount: 100, is_active: true, start_date: '', end_date: null, created_at: '' } },
  { id: '3', user_id: '', challenge_id: '3', current_value: 7, is_completed: true, reward_claimed: false, created_at: '', challenge: { id: '3', title: 'Refer 5 Users', description: 'Refer 5 users this week', type: 'weekly', target_value: 5, reward_amount: 500, is_active: true, start_date: '', end_date: null, created_at: '' } },
];

function getStatConfigForRole(role: Role, wallet: Wallet | null, counts: Record<string, number | string>) {
  const w = wallet || { balance: 0, pending_balance: 0, total_earned: 0 };
  const configs: Record<Role, DashboardStats['stats']> = {
    AFFILIATE: [
      { title: 'Total Earned', value: formatINR(w.total_earned), icon: <DollarSign className="w-5 h-5" />, trend: 12, color: 'accent' },
      { title: 'This Month', value: formatINR(Number(counts.monthEarnings) || 0), icon: <TrendingUp className="w-5 h-5" />, trend: 8, color: 'success' },
      { title: 'Pending', value: formatINR(w.pending_balance), icon: <Clock className="w-5 h-5" />, color: 'navy' },
      { title: 'Total Referrals', value: String(counts.referrals || 0), icon: <Users className="w-5 h-5" />, trend: 15, color: 'blue' },
    ],
    RESELLER: [
      { title: 'Total Revenue', value: formatINR(Number(counts.revenue) || 0), icon: <DollarSign className="w-5 h-5" />, trend: 18, color: 'accent' },
      { title: 'My Commission', value: formatINR(w.total_earned), icon: <TrendingUp className="w-5 h-5" />, trend: 10, color: 'success' },
      { title: 'Orders', value: String(counts.orders || 0), icon: <ShoppingCart className="w-5 h-5" />, color: 'blue' },
      { title: 'Products Listed', value: String(counts.products || 0), icon: <Package className="w-5 h-5" />, color: 'navy' },
    ],
    VENDOR: [
      { title: 'Total Sales', value: formatINR(Number(counts.revenue) || 0), icon: <DollarSign className="w-5 h-5" />, trend: 22, color: 'accent' },
      { title: 'Products', value: String(counts.products || 0), icon: <Package className="w-5 h-5" />, color: 'success' },
      { title: 'Pending Orders', value: String(counts.pendingOrders || 0), icon: <ClipboardList className="w-5 h-5" />, color: 'blue' },
      { title: 'Stock Alerts', value: String(counts.stockAlerts || 0), icon: <AlertTriangle className="w-5 h-5" />, color: 'navy' },
    ],
    SAAS_OWNER: [
      { title: 'Store Revenue', value: formatINR(Number(counts.revenue) || 0), icon: <Store className="w-5 h-5" />, trend: 25, color: 'accent' },
      { title: 'Active Users', value: String(counts.activeUsers || 0), icon: <UserCheck className="w-5 h-5" />, trend: 5, color: 'success' },
      { title: 'Commission Paid', value: formatINR(Number(counts.commissionPaid) || 0), icon: <DollarSign className="w-5 h-5" />, color: 'blue' },
      { title: 'Subscription', value: String(counts.subscriptionPlan || 'Starter'), icon: <Layers className="w-5 h-5" />, color: 'navy' },
    ],
    ADMIN: [
      { title: 'Total Users', value: String(counts.totalUsers || 0), icon: <Users className="w-5 h-5" />, trend: 30, color: 'accent' },
      { title: 'GMV', value: formatINR(Number(counts.gmv) || 0), icon: <DollarSign className="w-5 h-5" />, trend: 20, color: 'success' },
      { title: 'Platform Revenue', value: formatINR(Number(counts.platformRevenue) || 0), icon: <TrendingUp className="w-5 h-5" />, trend: 15, color: 'blue' },
      { title: 'Active Tenants', value: String(counts.activeTenants || 0), icon: <Store className="w-5 h-5" />, color: 'navy' },
    ],
  };
  return configs[role] || configs.AFFILIATE;
}

export function DashboardHome() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats['stats']>([]);
  const [activity, setActivity] = useState<(Order & { _type?: string })[]>([]);
  const [challenges, setChallenges] = useState<ChallengeProgress[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const counts: Record<string, number | string> = {};

      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (user.role === 'AFFILIATE' || user.role === 'RESELLER') {
        const { count: refCount } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id);
        counts.referrals = refCount || 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: monthTx } = await supabase.from('transactions').select('amount').eq('user_id', user.id).eq('type', 'commission').eq('status', 'completed').gte('created_at', startOfMonth);
        counts.monthEarnings = monthTx?.reduce((s, t) => s + t.amount, 0) || 0;
      }

      if (user.role === 'RESELLER' || user.role === 'VENDOR' || user.role === 'SAAS_OWNER') {
        const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        counts.orders = orderCount || 0;
      }

      if (user.role === 'VENDOR') {
        const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('vendor_id', user.id);
        counts.products = prodCount || 0;
        const { count: pendingCount } = await supabase.from('orders').select('*, products!inner(vendor_id)', { count: 'exact', head: true }).eq('products.vendor_id', user.id).eq('status', 'pending');
        counts.pendingOrders = pendingCount || 0;
        const { count: lowStock } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('vendor_id', user.id).lt('stock', 10);
        counts.stockAlerts = lowStock || 0;
      }

      if (user.role === 'ADMIN') {
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        counts.totalUsers = userCount || 0;
        const { count: tenantCount } = await supabase.from('saas_tenants').select('*', { count: 'exact', head: true }).eq('is_active', true);
        counts.activeTenants = tenantCount || 0;
      }

      if (user.role === 'SAAS_OWNER') {
        const { data: tenant } = await supabase.from('saas_tenants').select('*').eq('owner_id', user.id).maybeSingle();
        counts.subscriptionPlan = tenant?.subscription_plan === 'pro' ? 'Pro' : 'Starter';
        if (tenant) {
          const { count: memberCount } = await supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
          counts.activeUsers = memberCount || 0;
        }
      }

      setStats(getStatConfigForRole(user.role, wallet as Wallet | null, counts));

      const { data: recentOrders } = await supabase.from('orders').select('*, product:products(name)').order('created_at', { ascending: false }).limit(5);
      setActivity(recentOrders || []);

      const { data: cp } = await supabase.from('challenge_progress').select('*, challenge:challenges(*)').eq('user_id', user.id).eq('challenge.is_active', true).limit(3);
      setChallenges(cp && cp.length > 0 ? cp : DEMO_CHALLENGES);

      setLoading(false);
    };
    load();
  }, [user]);

  const copyReferralLink = () => {
    if (!user) return;
    navigator.clipboard.writeText(`${window.location.origin}/join?ref=${user.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            Welcome back, {user.name}
          </h1>
          <p className="text-navy-500 mt-1">
            {getRoleLabel(user.role)} Dashboard
          </p>
        </div>
        <button
          onClick={copyReferralLink}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm transition-colors self-start"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Referral Link'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-navy-50">
            {activity.length === 0 ? (
              <div className="px-6 py-8 text-center text-navy-400">
                No recent activity yet. Start by sharing products or making sales.
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-navy-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-accent-50 text-accent-500 shrink-0">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">
                        {(item as Order & { product?: { name: string } }).product?.name || `Order #${item.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-navy-400">{formatDate(item.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-navy-900">{formatINR(item.total_amount)}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.status === 'delivered' || item.status === 'confirmed' ? 'bg-green-50 text-green-600' :
                      item.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      item.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-accent-500" />
              Daily Challenges
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {challenges.map((cp) => {
              const progress = cp.challenge ? Math.min((cp.current_value / cp.challenge.target_value) * 100, 100) : 0;
              return (
                <div key={cp.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-navy-900">{cp.challenge?.title}</p>
                    {cp.is_completed && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Done</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-navy-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cp.is_completed ? 'bg-green-500' : 'bg-accent-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-navy-500 shrink-0 w-12 text-right">
                      {cp.current_value}/{cp.challenge?.target_value}
                    </span>
                  </div>
                  <p className="text-xs text-navy-400 mt-1">
                    Reward: {formatINR(cp.challenge?.reward_amount || 0)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
