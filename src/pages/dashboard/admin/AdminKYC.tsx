import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getStatusColor } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';
import type { KYC } from '../../../types';

const PAGE_SIZE = 10;

export function AdminKYC() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<(KYC & { profiles: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<{ open: boolean; action: string; record: any }>({ open: false, action: '', record: null });
  const [processing, setProcessing] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('kyc')
      .select('*, profiles(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, count, error } = await query;
    if (error) toast('Failed to load KYC records', 'error');
    else {
      setRecords(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, filter, toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { setPage(1); }, [filter]);

  const maskValue = (val: string | null, visible = 4) =>
    val ? `${'*'.repeat(Math.max(0, val.length - visible))}${val.slice(-visible)}` : '-';

  const handleAction = async () => {
    if (!modal.record) return;
    setProcessing(true);
    const newStatus = modal.action === 'approve' ? 'verified' : 'rejected';
    const { error: kycError } = await supabase
      .from('kyc')
      .update({ status: newStatus, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', modal.record.id);
    if (!kycError && modal.action === 'approve') {
      await supabase
        .from('profiles')
        .update({ kyc_status: 'verified' })
        .eq('id', modal.record.user_id);
    }
    if (kycError) toast('Action failed', 'error');
    else toast(`KYC ${newStatus} successfully`, 'success');
    setProcessing(false);
    setModal({ open: false, action: '', record: null });
    fetchRecords();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">KYC Management</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-navy-900 focus:border-orange-500 focus:ring-orange-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {loading ? <TableSkeleton /> : records.length === 0 ? (
        <EmptyState icon={<Shield className="h-12 w-12 text-gray-400" />} title="No KYC records" description="No records match the current filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['User Name', 'PAN', 'Aadhaar', 'Bank Account', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-900">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-navy-900">{r.profiles?.name || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.pan_number || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{maskValue(r.aadhar_no)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{maskValue(r.bank_acc_no)}</td>
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
      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, action: '', record: null })} title={`${modal.action === 'approve' ? 'Approve' : 'Reject'} KYC`}>
        <p className="text-sm text-gray-600">
          Are you sure you want to {modal.action} the KYC submission for <strong>{modal.record?.profiles?.name}</strong>?
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
