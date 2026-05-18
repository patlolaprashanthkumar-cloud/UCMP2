import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatINR, formatDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useStoreRole } from '../../hooks/useStoreRole';
import type { Order, StoreDeliveryAddress, TenantStorePartnerSettings } from '../../types';
import { Package, LogOut, User, MapPin, ClipboardList, Link2, IndianRupee, FileText, Share2 } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

type TabId = 'orders' | 'profile' | 'addresses' | 'affiliate' | 'reseller';

const emptyAddressForm = {
  label: 'Home',
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'IN',
  is_default: false,
};

export function StoreAccountPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const { user, signOut, refreshProfile } = useAuth();
  const { storeRole, loading: roleLoading } = useStoreRole(tenant.id);

  const [tab, setTab] = useState<TabId>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [nameDraft, setNameDraft] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [addresses, setAddresses] = useState<StoreDeliveryAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addrForm, setAddrForm] = useState(emptyAddressForm);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrSaving, setAddrSaving] = useState(false);

  const [storeProducts, setStoreProducts] = useState<{ id: string; name: string; price: number; category: string }[]>([]);
  const [affiliateOrders, setAffiliateOrders] = useState<{ buyer_id: string; total_amount: number }[]>([]);
  const [resellerOrders, setResellerOrders] = useState<{ total_amount: number }[]>([]);
  const [partner, setPartner] = useState<TenantStorePartnerSettings | null>(null);
  const [resellerMarginDrafts, setResellerMarginDrafts] = useState<Record<string, string>>({});
  const [partnerSaving, setPartnerSaving] = useState(false);

  const accent = tenant.primary_color || '#ea580c';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (user?.name != null) setNameDraft(user.name);
  }, [user?.name]);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, product:products(name)')
      .eq('tenant_id', tenant.id)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setOrders((data as Order[]) || []);
    setOrdersLoading(false);
  }, [user, tenant.id]);

  const loadAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setAddressesLoading(false);
      return;
    }
    setAddressesLoading(true);
    const { data } = await supabase
      .from('store_delivery_addresses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAddresses((data as StoreDeliveryAddress[]) || []);
    setAddressesLoading(false);
  }, [user, tenant.id]);

  const loadPartnerExtras = useCallback(async () => {
    if (!user) return;
    if (storeRole !== 'AFFILIATE' && storeRole !== 'RESELLER') return;

    const marginQuery =
      storeRole === 'RESELLER' && user
        ? supabase
            .from('tenant_store_reseller_product_margins')
            .select('product_id, margin_amount')
            .eq('tenant_id', tenant.id)
            .eq('user_id', user.id)
        : Promise.resolve({ data: null as { product_id: string; margin_amount: number }[] | null });

    const [{ data: tps }, { data: pRow }, { data: marginRows }] = await Promise.all([
      supabase
        .from('tenant_products')
        .select('product:products(id, name, price, category, is_active)')
        .eq('tenant_id', tenant.id),
      supabase
        .from('tenant_store_partner_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      marginQuery,
    ]);

    const prods: { id: string; name: string; price: number; category: string }[] = [];
    const raw = (tps || []) as unknown as {
      product: { id: string; name: string; price: number; category: string | null; is_active?: boolean } | null;
    }[];
    for (const row of raw) {
      const pr = row.product;
      if (pr?.id && pr.is_active !== false) {
        prods.push({
          id: pr.id,
          name: pr.name,
          price: Number(pr.price) || 0,
          category: pr.category || '',
        });
      }
    }
    prods.sort((a, b) => a.name.localeCompare(b.name));
    setStoreProducts(prods);

    setPartner((pRow as TenantStorePartnerSettings) || null);

    if (storeRole === 'RESELLER') {
      const marginMap: Record<string, string> = {};
      for (const p of prods) marginMap[p.id] = '0';
      const mrows = (marginRows || []) as { product_id: string; margin_amount: number }[];
      for (const m of mrows) {
        if (m.product_id != null) marginMap[m.product_id] = String(Number(m.margin_amount) || 0);
      }
      setResellerMarginDrafts(marginMap);
    } else {
      setResellerMarginDrafts({});
    }

    if (storeRole === 'AFFILIATE') {
      const { data: ao } = await supabase
        .from('orders')
        .select('buyer_id, total_amount')
        .eq('tenant_id', tenant.id)
        .eq('affiliate_id', user.id);
      setAffiliateOrders((ao as { buyer_id: string; total_amount: number }[]) || []);
    } else {
      setAffiliateOrders([]);
    }

    if (storeRole === 'RESELLER') {
      const { data: ro } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .eq('reseller_id', user.id);
      setResellerOrders((ro as { total_amount: number }[]) || []);
    } else {
      setResellerOrders([]);
    }
  }, [user, tenant.id, storeRole]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (roleLoading) return;
    void loadPartnerExtras();
  }, [roleLoading, loadPartnerExtras]);

  const affiliateFeePct = useMemo(() => {
    return (
      partner?.affiliate_fee_percent_override ??
      tenant.default_affiliate_platform_fee_percent ??
      5
    );
  }, [partner, tenant]);

  const resellerFeePct = useMemo(() => {
    return (
      partner?.reseller_fee_percent_override ?? tenant.default_reseller_platform_fee_percent ?? 5
    );
  }, [partner, tenant]);

  const affiliateGmv = useMemo(
    () => affiliateOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    [affiliateOrders],
  );
  const affiliateDistinctBuyers = useMemo(() => new Set(affiliateOrders.map((o) => o.buyer_id)).size, [affiliateOrders]);
  const affiliateFeeEstimate = useMemo(() => affiliateGmv * (Number(affiliateFeePct) / 100), [affiliateGmv, affiliateFeePct]);

  const resellerGmv = useMemo(
    () => resellerOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    [resellerOrders],
  );
  const resellerFeeEstimate = useMemo(() => resellerGmv * (Number(resellerFeePct) / 100), [resellerGmv, resellerFeePct]);

  async function saveProfile() {
    if (!user) return;
    setProfileSaving(true);
    const { error } = await supabase.from('profiles').update({ name: nameDraft.trim() || user.name }).eq('id', user.id);
    setProfileSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    await refreshProfile();
  }

  function startNewAddress() {
    setEditingAddrId(null);
    setAddrForm({
      ...emptyAddressForm,
      full_name: user?.name || '',
    });
  }

  function startEditAddress(a: StoreDeliveryAddress) {
    setEditingAddrId(a.id);
    setAddrForm({
      label: a.label,
      full_name: a.full_name,
      phone: a.phone,
      address_line1: a.address_line1,
      address_line2: a.address_line2,
      city: a.city,
      state: a.state,
      postal_code: a.postal_code,
      country: a.country,
      is_default: a.is_default,
    });
  }

  async function saveAddress() {
    if (!user) return;
    if (!addrForm.address_line1.trim() || !addrForm.city.trim()) {
      window.alert('Address line 1 and city are required.');
      return;
    }
    setAddrSaving(true);
    if (addrForm.is_default) {
      await supabase
        .from('store_delivery_addresses')
        .update({ is_default: false })
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id);
    }

    if (editingAddrId) {
      const { error } = await supabase
        .from('store_delivery_addresses')
        .update({
          label: addrForm.label.trim() || 'Home',
          full_name: addrForm.full_name.trim(),
          phone: addrForm.phone.trim(),
          address_line1: addrForm.address_line1.trim(),
          address_line2: addrForm.address_line2.trim(),
          city: addrForm.city.trim(),
          state: addrForm.state.trim(),
          postal_code: addrForm.postal_code.trim(),
          country: addrForm.country.trim() || 'IN',
          is_default: addrForm.is_default,
        })
        .eq('id', editingAddrId)
        .eq('user_id', user.id);
      setAddrSaving(false);
      if (error) {
        window.alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('store_delivery_addresses').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        label: addrForm.label.trim() || 'Home',
        full_name: addrForm.full_name.trim(),
        phone: addrForm.phone.trim(),
        address_line1: addrForm.address_line1.trim(),
        address_line2: addrForm.address_line2.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        postal_code: addrForm.postal_code.trim(),
        country: addrForm.country.trim() || 'IN',
        is_default: addrForm.is_default,
      });
      setAddrSaving(false);
      if (error) {
        window.alert(error.message);
        return;
      }
    }
    setEditingAddrId(null);
    setAddrForm(emptyAddressForm);
    await loadAddresses();
  }

  async function deleteAddress(id: string) {
    if (!user || !confirm('Delete this address?')) return;
    const { error } = await supabase.from('store_delivery_addresses').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    await loadAddresses();
  }

  async function saveResellerProductMargins() {
    if (!user || storeProducts.length === 0) return;
    const rows: { tenant_id: string; user_id: string; product_id: string; margin_amount: number }[] = [];
    for (const p of storeProducts) {
      const rawVal = resellerMarginDrafts[p.id] ?? '0';
      const n = Number.parseFloat(String(rawVal));
      const margin = Number.isFinite(n) ? Math.min(100_000_000, Math.max(0, n)) : 0;
      rows.push({ tenant_id: tenant.id, user_id: user.id, product_id: p.id, margin_amount: margin });
    }
    setPartnerSaving(true);
    const { error } = await supabase.from('tenant_store_reseller_product_margins').upsert(rows, {
      onConflict: 'tenant_id,user_id,product_id',
    });
    setPartnerSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    await loadPartnerExtras();
  }

  function shareResellerProductWhatsApp(p: { id: string; name: string; price: number }) {
    if (!user) return;
    const margin = Number.parseFloat(resellerMarginDrafts[p.id] ?? '0') || 0;
    const selling = p.price + margin;
    const link = `${origin}/store/${slug}/product/${p.id}?reseller=${user.id}`;
    const msg = encodeURIComponent(`${p.name} — ${formatINR(selling)}. Order: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  async function acknowledgeRequirements() {
    if (!user) return;
    setPartnerSaving(true);
    const { error } = await supabase.from('tenant_store_partner_settings').upsert(
      {
        tenant_id: tenant.id,
        user_id: user.id,
        requirements_ack_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id' },
    );
    setPartnerSaving(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    await loadPartnerExtras();
  }

  function tabClass(active: boolean) {
    return `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'text-white' : 'text-[var(--sf-fg)] bg-[var(--sf-surface)] border border-[var(--sf-border)] hover:bg-stone-50'
    }`;
  }

  const visibleTabs = useMemo(() => {
    const profileTab = { id: 'profile' as const, label: 'Profile', icon: User };
    const ordersTab = { id: 'orders' as const, label: 'Orders', icon: ClipboardList };
    if (storeRole === 'CUSTOMER') {
      return [
        profileTab,
        { id: 'addresses' as const, label: 'Address', icon: MapPin },
        ordersTab,
      ];
    }
    if (storeRole === 'AFFILIATE') {
      return [profileTab, { id: 'affiliate' as const, label: 'Affiliate', icon: Link2 }, ordersTab];
    }
    if (storeRole === 'RESELLER') {
      return [profileTab, { id: 'reseller' as const, label: 'Reseller', icon: IndianRupee }, ordersTab];
    }
    return [profileTab, ordersTab];
  }, [storeRole]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-[var(--sf-muted)] mb-4">Sign in to view your orders.</p>
        <Link
          to={`/store/${slug}/login?next=${encodeURIComponent(`/store/${slug}/account`)}`}
          className="inline-flex px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: accent }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--sf-fg)]">Your account</h1>
          <p className="text-sm text-[var(--sf-muted)]">{user.email}</p>
          <p className="text-xs text-[var(--sf-muted)] mt-1 capitalize">Store role: {storeRole.toLowerCase()}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[var(--sf-border)] font-medium text-[var(--sf-fg)] hover:bg-stone-50"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tabClass(tab === id)}
            style={tab === id ? { backgroundColor: accent } : undefined}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--sf-fg)]">Profile</h2>
          <div>
            <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Name</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--sf-border)] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--sf-muted)] mb-1">Email</label>
            <input value={user.email} readOnly className="w-full px-3 py-2 rounded-xl border border-[var(--sf-border)] bg-stone-50 text-[var(--sf-muted)]" />
          </div>
          <button
            type="button"
            disabled={profileSaving}
            onClick={() => void saveProfile()}
            className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      )}

      {tab === 'addresses' && storeRole === 'CUSTOMER' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-[var(--sf-fg)]">Address</h2>
              <button
                type="button"
                onClick={startNewAddress}
                className="text-sm font-semibold"
                style={{ color: accent }}
              >
                + New address
              </button>
            </div>
            {addressesLoading ? (
              <div className="h-24 bg-stone-100 animate-pulse rounded-xl" />
            ) : addresses.length === 0 && !editingAddrId && addrForm.address_line1 === '' ? (
              <p className="text-sm text-[var(--sf-muted)]">No address yet. Add one for faster checkout.</p>
            ) : null}

            {!addressesLoading &&
              addresses.map((a) => (
                <div
                  key={a.id}
                  className="border border-[var(--sf-border)] rounded-xl p-4 mb-3 flex flex-col sm:flex-row sm:justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-[var(--sf-fg)]">
                      {a.label}
                      {a.is_default ? <span className="text-xs text-[var(--sf-muted)] ml-2">Default</span> : null}
                    </p>
                    <p className="text-sm text-[var(--sf-muted)] mt-1">
                      {a.full_name}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </p>
                    <p className="text-sm text-[var(--sf-fg)] mt-1">
                      {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" className="text-sm font-medium underline" style={{ color: accent }} onClick={() => startEditAddress(a)}>
                      Edit
                    </button>
                    <button type="button" className="text-sm text-red-600 font-medium" onClick={() => void deleteAddress(a.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}

            {(editingAddrId !== null || addrForm.address_line1 !== '' || addrForm.full_name !== '' || addrForm.city !== '') && (
              <div className="mt-4 space-y-3 border-t border-[var(--sf-border)] pt-4">
                <h3 className="font-medium text-[var(--sf-fg)]">{editingAddrId ? 'Edit address' : 'New address'}</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">Label</label>
                    <input
                      value={addrForm.label}
                      onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">Full name</label>
                    <input
                      value={addrForm.full_name}
                      onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">Phone</label>
                    <input
                      value={addrForm.phone}
                      onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-[var(--sf-muted)]">Address line 1</label>
                    <input
                      value={addrForm.address_line1}
                      onChange={(e) => setAddrForm({ ...addrForm, address_line1: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-[var(--sf-muted)]">Address line 2</label>
                    <input
                      value={addrForm.address_line2}
                      onChange={(e) => setAddrForm({ ...addrForm, address_line2: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">City</label>
                    <input
                      value={addrForm.city}
                      onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">State</label>
                    <input
                      value={addrForm.state}
                      onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">Postal code</label>
                    <input
                      value={addrForm.postal_code}
                      onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sf-muted)]">Country</label>
                    <input
                      value={addrForm.country}
                      onChange={(e) => setAddrForm({ ...addrForm, country: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      id="def"
                      type="checkbox"
                      checked={addrForm.is_default}
                      onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })}
                    />
                    <label htmlFor="def" className="text-sm text-[var(--sf-fg)]">
                      Set as default for this store
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={addrSaving}
                    onClick={() => void saveAddress()}
                    className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {addrSaving ? 'Saving…' : 'Save address'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddrId(null);
                      setAddrForm(emptyAddressForm);
                    }}
                    className="px-4 py-2 rounded-xl border border-[var(--sf-border)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'affiliate' && storeRole === 'AFFILIATE' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-2 flex items-center gap-2">
              <Link2 className="w-5 h-5" /> Product links
            </h2>
            <p className="text-xs text-[var(--sf-muted)] mb-4">
              Share a product URL with <code className="bg-stone-100 px-1 rounded">?ref=your-id</code> so orders can attribute to you when buyers use that link in this browser session.
            </p>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {storeProducts.map((p) => {
                const url = `${origin}/store/${slug}/product/${p.id}?ref=${user.id}`;
                return (
                  <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm border border-[var(--sf-border)] rounded-lg p-3">
                    <span className="font-medium text-[var(--sf-fg)] flex-1 min-w-0">{p.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold px-2 py-1 rounded border border-[var(--sf-border)] hover:bg-stone-50"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                      }}
                    >
                      Copy link
                    </button>
                  </li>
                );
              })}
            </ul>
            {storeProducts.length === 0 ? <p className="text-sm text-[var(--sf-muted)]">No products in this store yet.</p> : null}
          </div>

          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-4">Performance</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[var(--sf-muted)]">Attributed orders</p>
                <p className="text-xl font-bold text-[var(--sf-fg)]">{affiliateOrders.length}</p>
              </div>
              <div>
                <p className="text-[var(--sf-muted)]">Distinct buyers</p>
                <p className="text-xl font-bold text-[var(--sf-fg)]">{affiliateDistinctBuyers}</p>
              </div>
              <div>
                <p className="text-[var(--sf-muted)]">GMV (attributed)</p>
                <p className="text-xl font-bold text-[var(--sf-fg)]">{formatINR(affiliateGmv)}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--sf-muted)] mt-3">
              Stats include only orders tagged with your affiliate id for this store (typically after checkout with a referral link).
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-2">Platform fee estimate</h2>
            <p className="text-sm text-[var(--sf-muted)] mb-2">
              Default fee: {Number(affiliateFeePct).toFixed(1)}% of attributed GMV (store default or your override when configured by the owner).
            </p>
            <p className="text-2xl font-bold text-[var(--sf-fg)]">{formatINR(affiliateFeeEstimate)}</p>
          </div>
        </div>
      )}

      {tab === 'reseller' && storeRole === 'RESELLER' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)]">Your product margins</h2>
            <p className="text-sm text-[var(--sf-muted)]">
              Set a fixed margin per catalog item. Your suggested selling price is <strong>base price + margin</strong> (same currency as the store). Share the product link with{' '}
              <code className="bg-stone-100 px-1 rounded">?reseller=your-id</code> so checkouts can attribute to you when buyers shop from that link.
            </p>
            {storeProducts.length === 0 ? (
              <p className="text-sm text-[var(--sf-muted)]">No products in this store yet.</p>
            ) : (
              <>
                <ul className="space-y-3 max-h-[min(28rem,70vh)] overflow-y-auto pr-1">
                  {storeProducts.map((p) => {
                    const marginRaw = resellerMarginDrafts[p.id] ?? '0';
                    const marginNum = Number.parseFloat(marginRaw);
                    const margin = Number.isFinite(marginNum) ? Math.max(0, marginNum) : 0;
                    const selling = p.price + margin;
                    const rid = user?.id ?? '';
                    const storeLink = rid ? `${origin}/store/${slug}/product/${p.id}?reseller=${rid}` : `${origin}/store/${slug}/product/${p.id}`;
                    return (
                      <li
                        key={p.id}
                        className="border border-[var(--sf-border)] rounded-xl p-4 space-y-3 text-sm bg-[var(--sf-bg)]"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          {p.category ? (
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-muted)]">{p.category}</p>
                          ) : null}
                          <p className="font-semibold text-[var(--sf-fg)]">{p.name}</p>
                          <p className="text-[var(--sf-muted)]">
                            Base: <span className="text-[var(--sf-fg)] font-medium">{formatINR(p.price)}</span>
                            {' · '}
                            Your price:{' '}
                            <span className="font-semibold" style={{ color: accent }}>
                              {formatINR(selling)}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs text-[var(--sf-muted)] mb-1">Margin amount (INR / unit)</label>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={marginRaw}
                              onChange={(e) =>
                                setResellerMarginDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              className="w-32 px-2 py-1.5 rounded-lg border border-[var(--sf-border)]"
                            />
                          </div>
                          <p className="text-xs text-[var(--sf-muted)] pb-1.5">
                            You earn {formatINR(margin)} per unit at this margin
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--sf-border)] hover:bg-stone-50"
                            onClick={() => void navigator.clipboard.writeText(storeLink)}
                          >
                            Copy store link
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--sf-border)] hover:bg-stone-50 inline-flex items-center gap-1"
                            onClick={() => shareResellerProductWhatsApp(p)}
                          >
                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                          <Link
                            to={`/store/${slug}/product/${p.id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--sf-border)] hover:bg-stone-50"
                          >
                            View in store
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={partnerSaving}
                  onClick={() => void saveResellerProductMargins()}
                  className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {partnerSaving ? 'Saving…' : 'Save all margins'}
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-4">Sales summary</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--sf-muted)]">Orders as reseller</p>
                <p className="text-xl font-bold text-[var(--sf-fg)]">{resellerOrders.length}</p>
              </div>
              <div>
                <p className="text-[var(--sf-muted)]">GMV</p>
                <p className="text-xl font-bold text-[var(--sf-fg)]">{formatINR(resellerGmv)}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--sf-muted)] mt-4">
              Estimated platform fee ({Number(resellerFeePct).toFixed(1)}%):{' '}
              <strong className="text-[var(--sf-fg)]">{formatINR(resellerFeeEstimate)}</strong>
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Reseller requirements
            </h2>
            {tenant.reseller_requirements?.trim() ? (
              <p className="text-sm text-[var(--sf-fg)] whitespace-pre-wrap">{tenant.reseller_requirements}</p>
            ) : (
              <p className="text-sm text-[var(--sf-muted)]">The store owner has not posted requirements yet.</p>
            )}
            {partner?.requirements_ack_at ? (
              <p className="text-xs text-[var(--sf-muted)] mt-3">
                Acknowledged {formatDate(partner.requirements_ack_at)}
              </p>
            ) : tenant.reseller_requirements?.trim() ? (
              <button
                type="button"
                disabled={partnerSaving}
                onClick={() => void acknowledgeRequirements()}
                className="mt-3 px-4 py-2 rounded-xl border-2 font-semibold text-sm disabled:opacity-50"
                style={{ borderColor: accent, color: accent }}
              >
                Acknowledge requirements
              </button>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <>
          <h2 className="text-lg font-semibold text-[var(--sf-fg)] mb-4">Orders from this store</h2>
          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-stone-200 animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] py-14 text-center">
              <Package className="w-10 h-10 mx-auto text-[var(--sf-muted)] mb-2" />
              <p className="text-[var(--sf-muted)]">No orders yet.</p>
              <Link to={`/store/${slug}`} className="inline-block mt-4 font-semibold" style={{ color: accent }}>
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-[var(--sf-fg)]">
                      {(o as Order & { product?: { name?: string } }).product?.name || `Order ${o.id.slice(0, 8)}`}
                    </p>
                    {o.size ? <p className="text-xs text-[var(--sf-muted)]">Size: {o.size}</p> : null}
                    <p className="text-xs text-[var(--sf-muted)]">{formatDate(o.created_at)}</p>
                    <p className="text-xs text-[var(--sf-muted)] mt-1 capitalize">
                      {o.payment_timing} · payment: {o.payment_status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--sf-fg)]">{formatINR(o.total_amount)}</p>
                    <span className="text-xs font-medium text-[var(--sf-muted)] capitalize">{o.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
