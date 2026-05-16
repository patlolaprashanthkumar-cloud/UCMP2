import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { DashboardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { SaasTenant, TenantMember } from '../../types';
import {
  Store, Crown, Activity, ExternalLink, Palette, Save,
  UserPlus, Trash2, ShoppingCart, DollarSign, Users, ArrowUpRight,
} from 'lucide-react';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function SaasDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<SaasTenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [form, setForm] = useState({ store_name: '', slug: '', logo: '', primary_color: '#f97316' });
  const [branding, setBranding] = useState({ store_name: '', logo: '', primary_color: '' });
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [stats, setStats] = useState({ orders: 0, commissions: 0 });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: t } = await supabase
      .from('saas_tenants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    setTenant(t);
    if (t) {
      setBranding({ store_name: t.store_name, logo: t.logo || '', primary_color: t.primary_color });
      const { data: m } = await supabase
        .from('tenant_members')
        .select('*, user:profiles(*)')
        .eq('tenant_id', t.id);
      setMembers(m || []);
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id);
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'commission')
        .eq('status', 'completed');
      setStats({
        orders: orderCount || 0,
        commissions: txData?.reduce((s, t) => s + t.amount, 0) || 0,
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const createStore = async () => {
    if (!user || !form.store_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('saas_tenants').insert({
      owner_id: user.id,
      store_name: form.store_name.trim(),
      slug: form.slug || slugify(form.store_name),
      logo: form.logo || null,
      primary_color: form.primary_color,
      subscription_plan: 'starter',
      is_active: true,
    });
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Store created successfully!');
    fetchData();
  };

  const saveBranding = async () => {
    if (!tenant) return;
    setSaving(true);
    const { error } = await supabase
      .from('saas_tenants')
      .update({
        store_name: branding.store_name,
        logo: branding.logo || null,
        primary_color: branding.primary_color,
      })
      .eq('id', tenant.id);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Branding updated!');
    fetchData();
  };

  const inviteUser = async () => {
    if (!tenant || !inviteEmail.trim()) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail.trim())
      .maybeSingle();
    if (!profile) { toast('User not found with that email', 'error'); return; }
    const { error } = await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: profile.id,
      role: inviteRole,
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('User invited successfully!');
    setInviteOpen(false);
    setInviteEmail('');
    fetchData();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from your store?')) return;
    const { error } = await supabase.from('tenant_members').delete().eq('id', memberId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Member removed');
    fetchData();
  };

  if (!user) return null;
  if (loading) return <DashboardSkeleton />;

  if (!tenant) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-xl border border-navy-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-accent-50 text-accent-500">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-900">Create Your Store</h1>
              <p className="text-sm text-navy-500">Set up your white-label storefront</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Store Name</label>
              <input
                type="text"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value, slug: slugify(e.target.value) })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="My Awesome Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Store Slug</label>
              <div className="flex items-center gap-1 text-sm text-navy-400 mb-1">
                <span>ucmp.in/store/</span>
                <span className="font-medium text-navy-700">{form.slug || '...'}</span>
              </div>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-navy-200 cursor-pointer"
                />
                <span className="text-sm text-navy-500">{form.primary_color}</span>
              </div>
            </div>
            <button
              onClick={createStore}
              disabled={saving || !form.store_name.trim()}
              className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? 'Creating...' : 'Create Store'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{tenant.store_name}</h1>
          <p className="text-navy-500 mt-1">Store Management Dashboard</p>
        </div>
        <a
          href={`/store/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm transition-colors self-start"
        >
          <ExternalLink className="w-4 h-4" /> Visit Store
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Store Name" value={tenant.store_name} icon={<Store className="w-5 h-5" />} color="accent" />
        <StatCard title="Plan" value={tenant.subscription_plan === 'pro' ? 'Pro' : 'Starter'} icon={<Crown className="w-5 h-5" />} color="navy" />
        <StatCard title="Status" value={tenant.is_active ? 'Active' : 'Inactive'} icon={<Activity className="w-5 h-5" />} color={tenant.is_active ? 'success' : 'navy'} />
        <StatCard title="Total Orders" value={String(stats.orders)} icon={<ShoppingCart className="w-5 h-5" />} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-accent-500" /> Branding Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Store Name</label>
              <input
                type="text"
                value={branding.store_name}
                onChange={(e) => setBranding({ ...branding, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={branding.logo}
                onChange={(e) => setBranding({ ...branding, logo: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-navy-200 cursor-pointer"
                />
                <span className="text-sm text-navy-500">{branding.primary_color}</span>
              </div>
            </div>
            <button
              onClick={saveBranding}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Store Preview</h2>
          <div className="rounded-lg border border-navy-200 overflow-hidden">
            <div className="h-12 flex items-center px-4 gap-3" style={{ backgroundColor: branding.primary_color }}>
              {branding.logo ? (
                <img src={branding.logo} alt="Logo" className="h-7 w-7 rounded object-cover" />
              ) : (
                <Store className="w-5 h-5 text-white" />
              )}
              <span className="text-white font-semibold text-sm">{branding.store_name}</span>
            </div>
            <div className="p-4 bg-navy-50 space-y-3">
              <div className="h-20 bg-white rounded-lg border border-navy-100 flex items-center justify-center text-navy-300 text-xs">
                Product Grid Preview
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded text-white text-xs flex items-center justify-center font-medium" style={{ backgroundColor: branding.primary_color }}>
                  Buy Now
                </div>
                <div className="h-8 flex-1 rounded border text-xs flex items-center justify-center font-medium" style={{ borderColor: branding.primary_color, color: branding.primary_color }}>
                  Add to Cart
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-navy-400 mt-3">
            Store URL: ucmp.in/store/{tenant.slug}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-500" /> Team Members
          </h2>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite User
          </button>
        </div>
        {members.length === 0 ? (
          <EmptyState
            title="No Team Members"
            description="Invite users to help manage your store."
            action={
              <button
                onClick={() => setInviteOpen(true)}
                className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Invite First Member
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-navy-50">
            {members.map((m) => (
              <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-navy-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center font-semibold text-sm">
                    {m.user?.name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">{m.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-navy-400 truncate">{m.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-navy-100 text-navy-600 capitalize">
                    {m.role}
                  </span>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-1.5 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-accent-500" /> Subscription
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Current Plan</span>
              <span className="font-semibold text-navy-900 capitalize">{tenant.subscription_plan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Status</span>
              <span className={`font-medium ${tenant.is_active ? 'text-green-600' : 'text-red-500'}`}>
                {tenant.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Member Since</span>
              <span className="font-medium text-navy-700">{formatDate(tenant.created_at)}</span>
            </div>
            {tenant.subscription_plan === 'starter' && (
              <button className="w-full mt-2 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2">
                <ArrowUpRight className="w-4 h-4" /> Upgrade to Pro
              </button>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-accent-500" /> Revenue Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Total Orders</span>
              <span className="font-semibold text-navy-900">{stats.orders}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Commissions Paid</span>
              <span className="font-semibold text-navy-900">{formatINR(stats.commissions)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            onClick={inviteUser}
            disabled={!inviteEmail.trim()}
            className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Send Invite
          </button>
        </div>
      </Modal>
    </div>
  );
}
