import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatINR, formatDate } from '../../../lib/format';
import type { SaasTenant, SaasTenantPlatformDue } from '../../../types';
import { DollarSign, Building2 } from 'lucide-react';

export function AdminBilling() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [dues, setDues] = useState<SaasTenantPlatformDue[]>([]);
  const [loading, setLoading] = useState(true);

  const [tenantId, setTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('Platform subscription / usage');
  const [notes, setNotes] = useState('');

  const loadRefs = useCallback(async () => {
    const { data: t } = await supabase.from('saas_tenants').select('*').order('store_name').limit(500);
    setTenants((t as SaasTenant[]) || []);
  }, []);

  const loadDues = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('saas_tenant_platform_dues')
      .select('*, tenant:saas_tenants(store_name, slug, profiles(name, email))')
      .order('created_at', { ascending: false })
      .limit(200);
    setDues((rows as unknown as SaasTenantPlatformDue[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadDues();
  }, [loadDues]);

  useEffect(() => {
    if (tenants.length && !tenantId) setTenantId(tenants[0].id);
  }, [tenants, tenantId]);

  async function addDue() {
    const n = Number(amount);
    if (!tenantId || !Number.isFinite(n) || n <= 0) {
      toast('Select a SaaS store and enter a valid amount', 'error');
      return;
    }
    const { error } = await supabase.from('saas_tenant_platform_dues').insert({
      tenant_id: tenantId,
      amount: n,
      title: title.trim() || 'Platform due',
      notes: notes.trim(),
      status: 'pending',
    });
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('SaaS platform due created');
    setAmount('');
    setNotes('');
    loadDues();
  }

  async function setDueStatus(id: string, status: 'paid' | 'waived') {
    const { error } = await supabase
      .from('saas_tenant_platform_dues')
      .update({
        status,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(`Marked ${status}`);
    loadDues();
  }

  if (loading && dues.length === 0) {
    return <div className="animate-pulse h-40 bg-navy-100 rounded-xl" />;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-accent-500" />
          Platform billing (SaaS stores)
        </h1>
        <p className="text-navy-500 mt-1 max-w-3xl">
          Record amounts SaaS store owners owe the platform (subscription, usage, or other fees). Track status here
          after offline settlement.
        </p>
      </div>

      <div className="max-w-3xl">
        <div className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-500" />
            SaaS store → platform
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-navy-600">SaaS store (tenant)</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
                disabled={tenants.length === 0}
              >
                {tenants.length === 0 ? (
                  <option value="">No tenants</option>
                ) : (
                  tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.store_name} ({t.slug})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Amount (INR)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-navy-600">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addDue()}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600"
          >
            Create platform due
          </button>

          <ul className="divide-y divide-navy-100 border border-navy-100 rounded-lg max-h-80 overflow-y-auto">
            {dues.length === 0 ? (
              <li className="p-4 text-sm text-navy-500">No records yet.</li>
            ) : (
              dues.map((d) => {
                const row = d as SaasTenantPlatformDue & {
                  tenant?: {
                    store_name?: string;
                    slug?: string;
                    profiles?: { name?: string; email?: string } | null;
                  };
                };
                return (
                  <li key={d.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium text-navy-900">
                        {formatINR(d.amount)} · {d.title}
                      </p>
                      <p className="text-xs text-navy-500">
                        {row.tenant?.store_name} ({row.tenant?.slug})
                        {row.tenant?.profiles?.name ? ` · ${row.tenant.profiles.name}` : ''}
                        {' · '}
                        {formatDate(d.created_at)} · <span className="capitalize">{d.status}</span>
                      </p>
                      {d.notes ? <p className="text-xs text-navy-400 mt-0.5">{d.notes}</p> : null}
                    </div>
                    {d.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium"
                          onClick={() => void setDueStatus(d.id, 'paid')}
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-navy-100 text-navy-700 font-medium"
                          onClick={() => void setDueStatus(d.id, 'waived')}
                        >
                          Waive
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
