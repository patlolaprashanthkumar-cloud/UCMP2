import { useState, useEffect, useCallback } from 'react';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, TrendingUp, Filter, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate, getStatusColor } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton, CardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Wallet, Transaction } from '../../types';

const TYPE_COLORS: Record<string, string> = {
  commission: 'bg-green-100 text-green-700',
  withdrawal: 'bg-blue-100 text-blue-700',
  bonus: 'bg-orange-100 text-orange-700',
  refund: 'bg-red-100 text-red-700',
};

const PER_PAGE = 20;

export function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWallet = useCallback(async () => {
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    setWallet(data);
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (typeFilter !== 'all') query = query.eq('type', typeFilter);

    const from = (page - 1) * PER_PAGE;
    const { data, count } = await query.range(from, from + PER_PAGE - 1);
    setTransactions(data || []);
    setTotalCount(count || 0);
  }, [user, page, typeFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchWallet(), fetchTransactions()]);
      setLoading(false);
    };
    load();
  }, [fetchWallet, fetchTransactions]);

  const handleWithdraw = async () => {
    const val = parseFloat(amount);
    if (!val || val < 500) {
      toast('Minimum withdrawal amount is ₹500', 'error');
      return;
    }
    if (!wallet || val > wallet.balance) {
      toast('Insufficient balance', 'error');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: user!.id,
      type: 'withdrawal',
      amount: val,
      status: 'pending',
    });
    if (error) {
      toast('Withdrawal request failed. Please try again.', 'error');
    } else {
      await supabase
        .from('wallets')
        .update({ balance: wallet.balance - val })
        .eq('user_id', user!.id);
      toast('Withdrawal request submitted successfully', 'success');
      setShowModal(false);
      setAmount('');
      await Promise.all([fetchWallet(), fetchTransactions()]);
    }
    setSubmitting(false);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-900">Wallet</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4" /> Withdraw
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Current Balance" value={formatINR(wallet?.balance ?? 0)} icon={<WalletIcon className="w-5 h-5" />} color="accent" />
        <StatCard title="Pending Balance" value={formatINR(wallet?.pending_balance ?? 0)} icon={<Clock className="w-5 h-5" />} color="navy" />
        <StatCard title="Total Earned" value={formatINR(wallet?.total_earned ?? 0)} icon={<TrendingUp className="w-5 h-5" />} color="success" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-navy-900">Transaction History</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Types</option>
              <option value="commission">Commission</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="bonus">Bonus</option>
              <option value="refund">Refund</option>
            </select>
          </div>
        </div>

        {transactions.length === 0 ? (
          <EmptyState title="No transactions" description="Your transaction history will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-navy-900">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLORS[tx.type] || 'bg-gray-100 text-gray-700'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${tx.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'withdrawal' ? '-' : '+'}{formatINR(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{tx.reference_id || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Withdraw Funds">
        {user?.kyc_status !== 'verified' ? (
          <div className="text-center py-6">
            <ArrowDownCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <p className="text-navy-900 font-medium mb-1">KYC Verification Required</p>
            <p className="text-sm text-gray-500">Please complete your KYC verification before requesting a withdrawal.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Available balance: <span className="font-semibold text-navy-900">{formatINR(wallet?.balance ?? 0)}</span></p>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min ₹500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p className="font-medium text-navy-900 mb-1">Bank Details</p>
              <p>Funds will be transferred to your verified bank account on file.</p>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
            >
              {submitting ? 'Processing...' : 'Request Withdrawal'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
