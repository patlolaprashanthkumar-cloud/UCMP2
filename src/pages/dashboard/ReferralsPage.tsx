import { useState, useEffect, useCallback } from 'react';
import { Users, Gift, UserCheck, Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate } from '../../lib/format';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { TableSkeleton, CardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Referral, Profile } from '../../types';

interface TreeNode {
  profile: Profile;
  children: TreeNode[];
}

const PER_PAGE = 10;

export function ReferralsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast('Referral link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchReferrals = useCallback(async () => {
    const from = (page - 1) * PER_PAGE;
    const { data, count } = await supabase
      .from('referrals')
      .select('*, referred:profiles!referrals_referred_id_fkey(*)', { count: 'exact' })
      .eq('referrer_id', user!.id)
      .order('created_at', { ascending: false })
      .range(from, from + PER_PAGE - 1);
    setReferrals(data || []);
    setTotalCount(count || 0);
  }, [user, page]);

  const fetchStats = useCallback(async () => {
    const { count } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user!.id);
    const { data: bonusData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user!.id)
      .eq('type', 'bonus')
      .eq('status', 'completed');
    setBonusTotal(bonusData?.reduce((s, t) => s + t.amount, 0) || 0);
    const { data: activeData } = await supabase
      .from('referrals')
      .select('referred:profiles!referrals_referred_id_fkey(is_active)')
      .eq('referrer_id', user!.id);
    setActiveCount(activeData?.filter((r: any) => r.referred?.is_active).length || 0);
    setTotalCount(count || 0);
  }, [user]);

  const fetchTree = useCallback(async () => {
    const getChildren = async (parentId: string): Promise<TreeNode[]> => {
      const { data } = await supabase
        .from('referrals')
        .select('referred:profiles!referrals_referred_id_fkey(*)')
        .eq('referrer_id', parentId);
      return (data || []).map((r: any) => ({ profile: r.referred, children: [] }));
    };
    const l1 = await getChildren(user!.id);
    for (const node of l1) {
      node.children = await getChildren(node.profile.id);
      for (const child of node.children) {
        child.children = await getChildren(child.profile.id);
      }
    }
    setTree(l1);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchReferrals(), fetchStats(), fetchTree()]);
      setLoading(false);
    };
    load();
  }, [fetchReferrals, fetchStats, fetchTree]);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const renderNode = (node: TreeNode, level: number) => (
    <div key={node.profile.id} style={{ marginLeft: level * 24 }}>
      <div
        className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-navy-50 rounded px-2"
        onClick={() => node.children.length > 0 && toggle(node.profile.id)}
      >
        {node.children.length > 0 ? (
          expanded[node.profile.id] ? (
            <ChevronDown className="w-4 h-4 text-navy-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-navy-400" />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
          level === 0 ? 'bg-accent-100 text-accent-700' : level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-navy-100 text-navy-700'
        }`}>
          L{level + 1}
        </span>
        <span className="text-sm font-medium text-navy-900">{node.profile.name}</span>
        <span className="text-xs text-navy-400">{node.profile.email}</span>
      </div>
      {expanded[node.profile.id] && node.children.map((c) => renderNode(c, level + 1))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton />
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Referrals</h1>

      <div className="bg-white rounded-xl border border-navy-100 p-4">
        <p className="text-sm font-medium text-navy-700 mb-2">Your Referral Link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 text-sm bg-navy-50 border border-navy-200 rounded-lg px-3 py-2 text-navy-700"
          />
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Referrals" value={String(totalCount)} icon={<Users className="w-5 h-5" />} color="accent" />
        <StatCard title="Bonus Earned" value={formatINR(bonusTotal)} icon={<Gift className="w-5 h-5" />} color="success" />
        <StatCard title="Active Referrals" value={String(activeCount)} icon={<UserCheck className="w-5 h-5" />} color="blue" />
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="p-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900">Referral Tree</h2>
          <p className="text-xs text-navy-400 mt-0.5">Click to expand L1 / L2 / L3 downline</p>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {tree.length === 0 ? (
            <p className="text-sm text-navy-400 text-center py-6">No referrals yet</p>
          ) : (
            tree.map((n) => renderNode(n, 0))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="p-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900">Referral History</h2>
        </div>
        {referrals.length === 0 ? (
          <EmptyState title="No referrals" description="Share your link to start earning bonuses." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-navy-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Date Joined</th>
                  <th className="px-4 py-3 font-medium">Bonus Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 text-navy-900 font-medium">{r.referred?.name || '--'}</td>
                    <td className="px-4 py-3 text-navy-600">{r.referred?.email || '--'}</td>
                    <td className="px-4 py-3 text-navy-600">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        r.bonus_paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.bonus_paid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="p-4 border-t border-navy-100">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
