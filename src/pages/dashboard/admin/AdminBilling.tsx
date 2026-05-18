import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatINR, formatDate } from '../../../lib/format';
import type { Profile, SaasTenant, VendorPlatformDue, SaasVendorCatalogDue } from '../../../types';
import { DollarSign, Building2, Truck } from 'lucide-react';

export function AdminBilling() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [vendorDues, setVendorDues] = useState<VendorPlatformDue[]>([]);
  const [catalogDues, setCatalogDues] = useState<SaasVendorCatalogDue[]>([]);
  const [loading, setLoading] = useState(true);

  const [vVendorId, setVVendorId] = useState('');
  const [vAmount, setVAmount] = useState('');
  const [vTitle, setVTitle] = useState('Platform usage');
  const [vNotes, setVNotes] = useState('');

  const [cTenantId, setCTenantId] = useState('');
  const [cVendorId, setCVendorId] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cBasis, setCBasis] = useState('');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');

  const loadRefs = useCallback(async () => {
    const [{ data: v }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'VENDOR').order('name').limit(500),
      supabase.from('saas_tenants').select('*').order('store_name').limit(500),
    ]);
    setVendors((v as Profile[]) || []);
    setTenants((t as SaasTenant[]) || []);
  }, []);

  const loadDues = useCallback(async () => {
    setLoading(true);
    const [{ data: vd }, { data: cd }] = await Promise.all([
      supabase
        .from('vendor_platform_dues')
        .select('*, vendor:profiles!vendor_id(name, email)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('saas_vendor_catalog_dues')
        .select('*, vendor:profiles!vendor_id(name, email), tenant:saas_tenants(store_name, slug)')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setVendorDues((vd as unknown as VendorPlatformDue[]) || []);
    setCatalogDues((cd as unknown as SaasVendorCatalogDue[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadDues();
  }, [loadDues]);

  useEffect(() => {
    if (vendors.length && !vVendorId) setVVendorId(vendors[0].id);
    if (vendors.length && !cVendorId) setCVendorId(vendors[0].id);
    if (tenants.length && !cTenantId) setCTenantId(tenants[0].id);
  }, [vendors, tenants, vVendorId, cVendorId, cTenantId]);

  async function addVendorDue() {
    const amount = Number(vAmount);
    if (!vVendorId || !Number.isFinite(amount) || amount <= 0) {
      toast('Select a vendor and enter a valid amount', 'error');
      return;
    }
    const { error } = await supabase.from('vendor_platform_dues').insert({
      vendor_id: vVendorId,
      amount,
      title: vTitle.trim() || 'Platform due',
      notes: vNotes.trim(),
      status: 'pending',
    });
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Vendor platform due created');
    setVAmount('');
    setVNotes('');
    loadDues();
  }

  async function addCatalogDue() {
    const amount = Number(cAmount);
    if (!cTenantId || !cVendorId || !Number.isFinite(amount) || amount <= 0) {
      toast('Select tenant and vendor and enter a valid amount', 'error');
      return;
    }
    const { error } = await supabase.from('saas_vendor_catalog_dues').insert({
      tenant_id: cTenantId,
      vendor_id: cVendorId,
      amount,
      basis: cBasis.trim() || 'Catalog royalty',
      period_start: cStart || null,
      period_end: cEnd || null,
      status: 'pending',
    });
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('SaaS → vendor catalog due created');
    setCAmount('');
    setCBasis('');
    loadDues();
  }

  async function setVendorDueStatus(id: string, status: 'paid' | 'waived') {
    const { error } = await supabase
      .from('vendor_platform_dues')
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

  async function setCatalogDueStatus(id: string, status: 'paid' | 'waived') {
    const { error } = await supabase
      .from('saas_vendor_catalog_dues')
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

  if (loading && vendorDues.length === 0 && catalogDues.length === 0) {
    return <div className="animate-pulse h-40 bg-navy-100 rounded-xl" />;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <DollarSign className="w-7 h-7 text-accent-500" />
          Platform billing
        </h1>
        <p className="text-navy-500 mt-1">Record vendor platform dues and SaaS → vendor catalog payment obligations. Track status here after offline settlement.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-accent-500" /> Vendor → platform
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-navy-600">Vendor</label>
              <select
                value={vVendorId}
                onChange={(e) => setVVendorId(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
                disabled={vendors.length === 0}
              >
                {vendors.length === 0 ? (
                  <option value="">No vendors in system</option>
                ) : (
                  vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.email})</option>
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
                value={vAmount}
                onChange={(e) => setVAmount(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Title</label>
              <input
                value={vTitle}
                onChange={(e) => setVTitle(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-navy-600">Notes</label>
              <input
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addVendorDue()}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600"
          >
            Create vendor due
          </button>

          <ul className="divide-y divide-navy-100 border border-navy-100 rounded-lg max-h-64 overflow-y-auto">
            {vendorDues.length === 0 ? (
              <li className="p-4 text-sm text-navy-500">No records yet.</li>
            ) : (
              vendorDues.map((d) => (
                <li key={d.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-navy-900">{formatINR(d.amount)} · {d.title}</p>
                    <p className="text-xs text-navy-500">
                      {(d as { vendor?: { name?: string } }).vendor?.name} · {formatDate(d.created_at)} ·{' '}
                      <span className="capitalize">{d.status}</span>
                    </p>
                  </div>
                  {d.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button type="button" className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium" onClick={() => void setVendorDueStatus(d.id, 'paid')}>
                        Paid
                      </button>
                      <button type="button" className="text-xs px-2 py-1 rounded bg-navy-100 text-navy-700 font-medium" onClick={() => void setVendorDueStatus(d.id, 'waived')}>
                        Waive
                      </button>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-500" /> SaaS store → vendor
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-navy-600">Tenant</label>
              <select
                value={cTenantId}
                onChange={(e) => setCTenantId(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
                disabled={tenants.length === 0}
              >
                {tenants.length === 0 ? (
                  <option value="">No tenants</option>
                ) : (
                  tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.store_name} ({t.slug})</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Vendor</label>
              <select
                value={cVendorId}
                onChange={(e) => setCVendorId(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
                disabled={vendors.length === 0}
              >
                {vendors.length === 0 ? (
                  <option value="">No vendors</option>
                ) : (
                  vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
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
                value={cAmount}
                onChange={(e) => setCAmount(e.target.value)}
                className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Period start</label>
              <input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Period end</label>
              <input type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-navy-600">Basis / notes</label>
              <input value={cBasis} onChange={(e) => setCBasis(e.target.value)} className="mt-1 w-full border border-navy-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 10% of SKU sales Jan" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void addCatalogDue()}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600"
          >
            Create catalog due
          </button>

          <ul className="divide-y divide-navy-100 border border-navy-100 rounded-lg max-h-64 overflow-y-auto">
            {catalogDues.length === 0 ? (
              <li className="p-4 text-sm text-navy-500">No records yet.</li>
            ) : (
              catalogDues.map((d) => (
                <li key={d.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-navy-900">{formatINR(d.amount)}</p>
                    <p className="text-xs text-navy-500">
                      {(d as { tenant?: { store_name?: string } }).tenant?.store_name} → {(d as { vendor?: { name?: string } }).vendor?.name} · {formatDate(d.created_at)} ·{' '}
                      <span className="capitalize">{d.status}</span>
                    </p>
                    {d.basis ? <p className="text-xs text-navy-400 mt-0.5">{d.basis}</p> : null}
                  </div>
                  {d.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button type="button" className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium" onClick={() => void setCatalogDueStatus(d.id, 'paid')}>
                        Paid
                      </button>
                      <button type="button" className="text-xs px-2 py-1 rounded bg-navy-100 text-navy-700 font-medium" onClick={() => void setCatalogDueStatus(d.id, 'waived')}>
                        Waive
                      </button>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
