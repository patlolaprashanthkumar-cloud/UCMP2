import { useState, useEffect, useCallback } from 'react';
import { Wallet, CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatINR, formatDate, getStatusColor } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';
import type { Transaction } from '../../../types';

const PAGE_SIZE = 10;

export function AdminWithdrawals() {
  const { toast } = useToast();
  const [records, setRecords] = useState<(Transaction & { profiles: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ pending: 0, approvedMonth: 0, rejectedMonth: 0 });
  const [modal, setModal] = useState<{ open: boolean; action: string; record: any }>({ open: false, action: '', record: null });
  const [processing, setProcessing] = useState(false);

  const fetchSummary = useCallback(async () => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'pending'),
      supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed').gte('updated_at', startOfMonth),
      supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'rejected').gte('updated_at', startOfMonth),
    ]);
    setSummary({
      pending: (pendingRes.data || []).reduce((s, r) => s + Number(r.amount), 0),
      approvedMonth: (approvedRes.data || []).reduce((s, r) => s + Number(r.amount), 0),
      rejectedMonth: (rejectedRes.data || []).reduce((s, r) => s + Number(r.amount), 0),
    });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, profiles(name)', { count: 'exact' })
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, count, error } = await query;
    if (error) toast('Failed to load withdrawals', 'error');
    else {
      setRecords(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, filter, toast]);

  useEffect(() => { fetchRecords(); fetchSummary(); }, [fetchRecords, fetchSummary]);
  useEffect(() => { setPage(1); }, [filter]);

  const handleAction = async () => {
    if (!modal.record) return;
    setProcessing(true);
    const newStatus = modal.action === 'approve' ? 'completed' : 'rejected';
    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', modal.record.id);
    if (error) toast('Action failed', 'error');
    else toast(modal.action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected', 'success');
    setProcessing(false);
    setModal({ open: false, action: '', record: null });
    fetchRecords();
    fetchSummary();
  };

  const summaryCards = [
    { label: 'Total Pending', value: formatINR(summary.pending), icon: Clock, color: 'bg-orange-50 text-orange-600' },
    { label: 'Approved This Month', value: formatINR(summary.approvedMonth), icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'Rejected This Month', value: formatINR(summary.rejectedMonth), icon: Ban, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Withdrawal Management</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${c.color}`}><c.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-lg font-bold text-navy-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-navy-900 focus:border-orange-500 focus:ring-orange-500">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {loading ? <TableSkeleton /> : records.length === 0 ? (
        <EmptyState icon={<Wallet className="h-12 w-12 text-gray-400" />} title="No withdrawals" description="No withdrawal requests match the current filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['User Name', 'Amount', 'Bank Details', 'Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-900">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-navy-900">{r.profiles?.name || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-navy-900">{formatINR(r.amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.description || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {r.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => setModal({ open: true, action: 'approve', record: r })} className="inline-flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button onClick={() => setModal({ open: true, action: 'reject', record: r })} className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, action: '', record: null })} title={`${modal.action === 'approve' ? 'Approve' : 'Reject'} Withdrawal`}>
        <p className="text-sm text-gray-600">
          Confirm {modal.action} of <strong>{modal.record ? formatINR(modal.record.amount) : ''}</strong> withdrawal for <strong>{modal.record?.profiles?.name}</strong>?
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={() => setModal({ open: false, action: '', record: null })} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-navy-900 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAction} disabled={processing} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${modal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>
            {processing ? 'Processing...' : modal.action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
