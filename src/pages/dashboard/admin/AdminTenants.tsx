import { useState, useEffect, useCallback } from 'react';
import { Store, Eye, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatDate } from '../../../lib/format';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';
import type { SaasTenant } from '../../../types';

const PAGE_SIZE = 10;

export function AdminTenants() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<(SaasTenant & { profiles: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailModal, setDetailModal] = useState<{ open: boolean; tenant: any }>({ open: false, tenant: null });
  const [memberCount, setMemberCount] = useState(0);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const { data, count, error } = await supabase
      .from('saas_tenants')
      .select('*, profiles(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) toast('Failed to load tenants', 'error');
    else {
      setTenants(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, toast]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const toggleStatus = async (tenant: any) => {
    setToggling(tenant.id);
    const newActive = !tenant.is_active;
    const { error } = await supabase
      .from('saas_tenants')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', tenant.id);
    if (error) toast('Failed to update status', 'error');
    else toast(`Tenant ${newActive ? 'activated' : 'deactivated'}`, 'success');
    setToggling(null);
    fetchTenants();
  };

  const openDetails = async (tenant: any) => {
    setDetailModal({ open: true, tenant });
    const { count } = await supabase
      .from('tenant_members')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);
    setMemberCount(count || 0);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Tenant Management</h1>
      {loading ? <TableSkeleton /> : tenants.length === 0 ? (
        <EmptyState icon={<Store className="h-12 w-12 text-gray-400" />} title="No tenants" description="No SaaS tenants found." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Store Name', 'Owner', 'Plan', 'Domain', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-900">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-navy-900">{t.store_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{t.profiles?.name || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">{t.subscription_plan || 'free'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{t.custom_domain || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${t.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{t.is_active ? 'active' : 'inactive'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(t.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetails(t)} className="inline-flex items-center gap-1 rounded bg-navy-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-800">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => toggleStatus(t)} disabled={toggling === t.id} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-gray-50 disabled:opacity-50">
                        {t.is_active ? <ToggleRight className="h-3.5 w-3.5 text-green-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />}
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
      <Modal isOpen={detailModal.open} onClose={() => setDetailModal({ open: false, tenant: null })} title="Tenant Details">
        {detailModal.tenant && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-navy-900">Store Information</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Store Name</dt>
                <dd className="font-medium text-navy-900">{detailModal.tenant.store_name}</dd>
                <dt className="text-gray-500">Owner</dt>
                <dd className="font-medium text-navy-900">{detailModal.tenant.profiles?.name || '-'}</dd>
                <dt className="text-gray-500">Domain</dt>
                <dd className="font-medium text-navy-900">{detailModal.tenant.custom_domain || '-'}</dd>
                <dt className="text-gray-500">Status</dt>
                <dd><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${detailModal.tenant.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{detailModal.tenant.is_active ? 'active' : 'inactive'}</span></dd>
              </dl>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-navy-900">Subscription</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Plan</dt>
                <dd><span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">{detailModal.tenant.subscription_plan || 'free'}</span></dd>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-navy-900">{formatDate(detailModal.tenant.created_at)}</dd>
              </dl>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-navy-900">Members</h3>
              </div>
              <p className="mt-1 text-2xl font-bold text-navy-900">{memberCount}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                to={`/dashboard/admin/orders?tenant=${encodeURIComponent(detailModal.tenant.id)}`}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                View orders
              </Link>
              <button onClick={() => setDetailModal({ open: false, tenant: null })} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-navy-900 hover:bg-gray-50">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
