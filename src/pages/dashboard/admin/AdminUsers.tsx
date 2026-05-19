import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatDate, getRoleBadgeColor, getRoleLabel } from '../../../lib/format';
import type { Profile, KYC } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';

const PAGE_SIZE = 20;

export function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailKyc, setDetailKyc] = useState<KYC | null>(null);
  const [detailTenants, setDetailTenants] = useState<
    { id: string; store_name: string; slug: string; role: string }[]
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*', { count: 'exact' });
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (roleFilter !== 'all') query = query.eq('role', roleFilter);
    if (statusFilter !== 'all') query = query.eq('is_active', statusFilter === 'active');
    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      toast('Failed to fetch users', 'error');
    } else {
      setUsers(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [search, roleFilter, statusFilter, page, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  const toggleActive = async (user: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (error) {
      toast('Failed to update user', 'error');
    } else {
      toast(`User ${user.is_active ? 'deactivated' : 'activated'}`, 'success');
      fetchUsers();
    }
  };

  const viewProfile = async (user: Profile) => {
    setSelectedUser(user);
    setModalOpen(true);
    setDetailLoading(true);
    setDetailKyc(null);
    setDetailTenants([]);
    const [{ data: kycRow }, { data: mems }] = await Promise.all([
      supabase.from('kyc').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('tenant_members').select('role, tenant:saas_tenants(id, store_name, slug)').eq('user_id', user.id),
    ]);
    setDetailKyc(kycRow as KYC | null);
    const rows = (mems || []) as unknown as {
      role: string;
      tenant: { id: string; store_name: string; slug: string } | null;
    }[];
    setDetailTenants(
      rows
        .filter((m) => m.tenant)
        .map((m) => ({
          id: m.tenant!.id,
          store_name: m.tenant!.store_name,
          slug: m.tenant!.slug,
          role: m.role,
        })),
    );
    setDetailLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Roles</option>
          <option value="AFFILIATE">Affiliate</option>
          <option value="RESELLER">Reseller</option>
          <option value="VENDOR">Vendor</option>
          <option value="SAAS_OWNER">SaaS Owner</option>
          <option value="ADMIN">Admin</option>
          <option value="CUSTOMER">Customer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <EmptyState icon={<Users className="w-12 h-12 text-slate-300" />} title="No users found" description="Try adjusting your search or filters." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">KYC</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Active</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${user.kyc_status === 'verified' ? 'text-green-600' : user.kyc_status === 'pending' ? 'text-orange-500' : 'text-slate-400'}`}>
                      {user.kyc_status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`w-2 h-2 inline-block rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => viewProfile(user)} className="p-1 text-slate-500 hover:text-orange-500 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(user)} className="p-1 text-slate-500 hover:text-orange-500 transition-colors">
                        {user.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="User details" size="lg">
        {selectedUser && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-500">Name</span><p className="font-medium text-slate-900">{selectedUser.name || '-'}</p></div>
              <div><span className="text-slate-500">Email</span><p className="font-medium text-slate-900">{selectedUser.email}</p></div>
              <div><span className="text-slate-500">Role</span><p className="font-medium text-slate-900">{getRoleLabel(selectedUser.role)}</p></div>
              <div><span className="text-slate-500">KYC (profile)</span><p className="font-medium text-slate-900">{selectedUser.kyc_status || 'N/A'}</p></div>
              <div><span className="text-slate-500">Referral</span><p className="font-medium text-slate-900">{selectedUser.referral_code}</p></div>
              <div><span className="text-slate-500">Referred by</span><p className="font-medium text-slate-900">{selectedUser.referred_by || '—'}</p></div>
              <div><span className="text-slate-500">Status</span><p className="font-medium text-slate-900">{selectedUser.is_active ? 'Active' : 'Inactive'}</p></div>
              <div><span className="text-slate-500">Joined</span><p className="font-medium text-slate-900">{formatDate(selectedUser.created_at)}</p></div>
            </div>
            {detailLoading ? <p className="text-slate-500 text-sm">Loading KYC & stores…</p> : null}
            {!detailLoading && detailKyc && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h3 className="font-semibold text-slate-900 mb-2">KYC record</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Status</span><p className="font-medium">{detailKyc.status}</p></div>
                  <div><span className="text-slate-500">PAN</span><p className="font-medium">{detailKyc.pan_number || '—'}</p></div>
                  <div><span className="text-slate-500">Aadhaar</span><p className="font-medium">{detailKyc.aadhar_no ? '••••' + detailKyc.aadhar_no.slice(-4) : '—'}</p></div>
                  <div><span className="text-slate-500">Bank / IFSC</span><p className="font-medium">{detailKyc.bank_acc_no ? '••••' + detailKyc.bank_acc_no.slice(-4) : '—'} / {detailKyc.ifsc || '—'}</p></div>
                </div>
              </div>
            )}
            {!detailLoading && !detailKyc && (
              <p className="text-slate-500 text-sm">No KYC submission on file.</p>
            )}
            {detailTenants.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Store memberships</h3>
                <ul className="space-y-2 text-sm">
                  {detailTenants.map((t) => (
                    <li key={`${t.id}-${t.role}`} className="text-slate-700 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        <span className="font-medium">{t.store_name}</span>
                        <span className="text-slate-500"> ({t.slug}) — {t.role}</span>
                      </span>
                      <Link
                        to={`/dashboard/admin/orders?tenant=${encodeURIComponent(t.id)}`}
                        className="text-orange-600 font-medium text-xs hover:underline"
                      >
                        View store orders
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
