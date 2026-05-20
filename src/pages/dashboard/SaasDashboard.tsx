import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { uploadPublicFile } from '../../lib/storage';
import { formatINR, formatDate } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { DashboardSkeleton } from '../../components/ui/LoadingSkeleton';
import type {
  SaasTenant,
  TenantMember,
  Product,
  TenantProduct,
  Order,
  OrderCarrierShipment,
  SaasVendorCatalogDue,
  SaasTenantPlatformDue,
} from '../../types';
import { invokeEdgeFunction } from '../../lib/edgeFunctions';
import { loadRazorpayScript, openRazorpayModal } from '../../lib/razorpayCheckout';
import {
  Store, Crown, Activity, ExternalLink, Palette, Save,
  UserPlus, Trash2, ShoppingCart, DollarSign, Users, ArrowUpRight,
  ImagePlus, Package, Plus, Search, Link2, Share2, TrendingUp, ShoppingBag,
  Truck,
} from 'lucide-react';

function firstCarrierShipment(o: { order_carrier_shipments?: OrderCarrierShipment[] | null }): OrderCarrierShipment | undefined {
  const c = o.order_carrier_shipments;
  if (!c) return undefined;
  return Array.isArray(c) ? c[0] : c;
}

const NIMBUS_FORM_DEFAULT = {
  enabled: false,
  api_email: '',
  api_password: '',
  hasStoredPassword: false,
  warehouse_id: '',
  default_weight_grams: 500,
  default_length_cm: 10,
  default_width_cm: 10,
  default_height_cm: 10,
};

type TenantOrderRow = Order & {
  buyer?: { name: string; email: string } | null;
  product?: { name: string } | null;
  affiliate?: { name: string; email: string } | null;
  order_carrier_shipments?: OrderCarrierShipment[] | null;
};

type CatalogModalState = null | { mode: 'add'; product: Product } | { mode: 'increase'; line: TenantProduct };

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
  const [branding, setBranding] = useState({
    store_name: '',
    logo: '',
    primary_color: '',
    reseller_requirements: '',
    store_about: '',
    store_terms: '',
    default_affiliate_platform_fee_percent: 5,
    default_reseller_platform_fee_percent: 5,
  });
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('CUSTOMER');
  const [stats, setStats] = useState({
    orders: 0,
    revenue: 0,
    procurementOrders: 0,
    procurementRevenue: 0,
    catalogCount: 0,
    platformPaidTotal: 0,
    affiliateCommissionsAccrued: 0,
    resellerMarginsToSettle: 0,
  });
  const [vendorCatalog, setVendorCatalog] = useState<Product[]>([]);
  const [storeLines, setStoreLines] = useState<TenantProduct[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPaste, setLogoPaste] = useState('');
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [tenantOrders, setTenantOrders] = useState<TenantOrderRow[]>([]);
  const [affiliateCommissionEdits, setAffiliateCommissionEdits] = useState<
    Record<string, { amount: string; note: string }>
  >({});
  const [savingAffiliateCommissionFor, setSavingAffiliateCommissionFor] = useState<string | null>(null);
  const [saasCatalogDues, setSaasCatalogDues] = useState<SaasVendorCatalogDue[]>([]);
  const [catalogModal, setCatalogModal] = useState<CatalogModalState>(null);
  const [catalogQtyInput, setCatalogQtyInput] = useState(1);
  const [catalogSubmitting, setCatalogSubmitting] = useState(false);
  const [platformDues, setPlatformDues] = useState<SaasTenantPlatformDue[]>([]);
  const [payingDueId, setPayingDueId] = useState<string | null>(null);
  const [nimbus, setNimbus] = useState(NIMBUS_FORM_DEFAULT);
  const [savingNimbus, setSavingNimbus] = useState(false);
  const [bookingOrderId, setBookingOrderId] = useState<string | null>(null);

  const location = useLocation();

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
      setBranding({
        store_name: t.store_name,
        logo: t.logo || '',
        primary_color: t.primary_color,
        reseller_requirements: t.reseller_requirements ?? '',
        store_about: t.store_about ?? '',
        store_terms: t.store_terms ?? '',
        default_affiliate_platform_fee_percent: Number(t.default_affiliate_platform_fee_percent ?? 5),
        default_reseller_platform_fee_percent: Number(t.default_reseller_platform_fee_percent ?? 5),
      });
      setLogoPaste('');
      const { data: m } = await supabase
        .from('tenant_members')
        .select('*, user:profiles(*)')
        .eq('tenant_id', t.id);
      setMembers(m || []);

      const { data: rpcData } = await supabase.rpc('list_vendor_catalog');
      setVendorCatalog((rpcData as Product[]) || []);

      const { data: tps } = await supabase
        .from('tenant_products')
        .select(
          'id, tenant_id, product_id, created_at, listing_quantity, catalog_procurement_order_id, product:products(*)',
        )
        .eq('tenant_id', t.id);
      const lines = (tps || []) as unknown as TenantProduct[];
      setStoreLines(lines);

      const { data: orderMetrics } = await supabase
        .from('orders')
        .select('total_amount, order_kind, payment_status, affiliate_commission_amount, reseller_margin_total, reseller_id')
        .eq('tenant_id', t.id);

      const metrics = orderMetrics || [];
      const storefrontRows = metrics.filter((r) => r.order_kind !== 'catalog_procurement');
      const paidStorefront = storefrontRows.filter((r) => r.payment_status === 'paid');
      const procRows = metrics.filter((r) => r.order_kind === 'catalog_procurement');
      const paidProcurement = procRows.filter((r) => r.payment_status === 'paid');
      const affiliateCommissionsAccrued = paidStorefront.reduce(
        (s, row) => s + Number(row.affiliate_commission_amount ?? 0),
        0,
      );
      const resellerMarginsToSettle = paidStorefront.reduce(
        (s, row) => s + (row.reseller_id ? Number(row.reseller_margin_total ?? 0) : 0),
        0,
      );

      const { data: platformDueRows } = await supabase
        .from('saas_tenant_platform_dues')
        .select('*')
        .eq('tenant_id', t.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const duesList = (platformDueRows as SaasTenantPlatformDue[]) || [];
      const platformPaidTotal = duesList.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.amount), 0);

      setStats({
        orders: paidStorefront.length,
        revenue: paidStorefront.reduce((s, row) => s + Number(row.total_amount), 0),
        procurementOrders: paidProcurement.length,
        procurementRevenue: paidProcurement.reduce((s, row) => s + Number(row.total_amount), 0),
        catalogCount: lines.length,
        platformPaidTotal,
        affiliateCommissionsAccrued,
        resellerMarginsToSettle,
      });

      const { data: ordData } = await supabase
        .from('orders')
        .select(
          '*, buyer:profiles!buyer_id(name, email), product:products(name), affiliate:profiles!affiliate_id(name, email), order_carrier_shipments(awb, courier_name, delivery_status, last_error, label_url, updated_at)',
        )
        .eq('tenant_id', t.id)
        .order('created_at', { ascending: false })
        .limit(200);
      const nextOrders = (ordData as TenantOrderRow[]) || [];
      setTenantOrders(nextOrders);
      const edits: Record<string, { amount: string; note: string }> = {};
      for (const o of nextOrders) {
        if (!o.affiliate_id) continue;
        edits[o.id] = {
          amount:
            o.affiliate_commission_amount != null && o.affiliate_commission_amount !== undefined
              ? String(o.affiliate_commission_amount)
              : '',
          note: o.affiliate_commission_note ?? '',
        };
      }
      setAffiliateCommissionEdits(edits);

      const { data: duesRows } = await supabase
        .from('saas_vendor_catalog_dues')
        .select('*, vendor:profiles!vendor_id(name, email)')
        .eq('tenant_id', t.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setSaasCatalogDues((duesRows as unknown as SaasVendorCatalogDue[]) || []);

      setPlatformDues(duesList);

      const { data: np } = await supabase
        .from('tenant_nimbuspost_settings')
        .select('*')
        .eq('tenant_id', t.id)
        .maybeSingle();
      if (np) {
        const row = np as typeof np & { api_password?: string };
        setNimbus({
          enabled: !!np.enabled,
          api_email: np.api_email ?? '',
          api_password: '',
          hasStoredPassword: !!(row.api_password && String(row.api_password).trim()),
          warehouse_id: np.warehouse_id ?? '',
          default_weight_grams: Number(np.default_weight_grams) || 500,
          default_length_cm: Number(np.default_length_cm) || 10,
          default_width_cm: Number(np.default_width_cm) || 10,
          default_height_cm: Number(np.default_height_cm) || 10,
        });
      } else {
        setNimbus({ ...NIMBUS_FORM_DEFAULT });
      }
    } else {
      setMembers([]);
      setVendorCatalog([]);
      setStoreLines([]);
      setTenantOrders([]);
      setAffiliateCommissionEdits({});
      setSaasCatalogDues([]);
      setPlatformDues([]);
      setNimbus({ ...NIMBUS_FORM_DEFAULT });
      setStats({
        orders: 0,
        revenue: 0,
        procurementOrders: 0,
        procurementRevenue: 0,
        catalogCount: 0,
        platformPaidTotal: 0,
        affiliateCommissionsAccrued: 0,
        resellerMarginsToSettle: 0,
      });
    }
    setLoading(false);
  };

  const saveNimbusSettings = async () => {
    if (!tenant) return;
    if (nimbus.enabled && !nimbus.api_email.trim()) {
      toast('Enter Nimbuspost API email (from your Nimbuspost API user).', 'error');
      return;
    }
    if (nimbus.enabled && !nimbus.hasStoredPassword && !nimbus.api_password.trim()) {
      toast('Enter the API password for that user.', 'error');
      return;
    }
    setSavingNimbus(true);
    try {
      const base = {
        tenant_id: tenant.id,
        enabled: nimbus.enabled,
        api_email: nimbus.api_email.trim(),
        warehouse_id: nimbus.warehouse_id.trim() || null,
        default_weight_grams: Math.max(1, Number(nimbus.default_weight_grams) || 500),
        default_length_cm: Number(nimbus.default_length_cm) || 10,
        default_width_cm: Number(nimbus.default_width_cm) || 10,
        default_height_cm: Number(nimbus.default_height_cm) || 10,
        updated_at: new Date().toISOString(),
      };
      const { data: cur } = await supabase
        .from('tenant_nimbuspost_settings')
        .select('tenant_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (cur) {
        const upd: Record<string, unknown> = { ...base };
        if (nimbus.api_password.trim()) upd.api_password = nimbus.api_password.trim();
        const { error } = await supabase.from('tenant_nimbuspost_settings').update(upd).eq('tenant_id', tenant.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('tenant_nimbuspost_settings').insert({
          ...base,
          api_password: nimbus.api_password.trim() || '',
        });
        if (error) throw new Error(error.message);
      }
      toast('Nimbuspost settings saved.', 'success');
      setNimbus((prev) => ({
        ...prev,
        api_password: '',
        hasStoredPassword: prev.hasStoredPassword || !!nimbus.api_password.trim(),
      }));
      await fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSavingNimbus(false);
    }
  };

  const retryNimbusBooking = async (orderId: string) => {
    if (!nimbus.enabled) {
      toast('Enable Nimbuspost and save credentials first.', 'error');
      return;
    }
    setBookingOrderId(orderId);
    try {
      const res = await invokeEdgeFunction<
        { ok?: boolean; results?: { order_id: string; ok: boolean; error?: string }[] }
      >('book-nimbuspost-orders', { order_ids: [orderId] });
      const row = res.results?.find((r) => r.order_id === orderId);
      if (row && !row.ok) toast(row.error ?? 'Booking failed', 'error');
      else toast('Booking completed.', 'success');
      await fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Booking failed', 'error');
    } finally {
      setBookingOrderId(null);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    const id = location.hash?.replace(/^#/, '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.hash, tenant?.id, loading]);

  const storefrontOrders = useMemo(
    () => tenantOrders.filter((o) => o.order_kind !== 'catalog_procurement'),
    [tenantOrders],
  );

  const paidStorefrontOrders = useMemo(
    () => storefrontOrders.filter((o) => o.payment_status === 'paid'),
    [storefrontOrders],
  );

  const customerSummaries = useMemo(() => {
    const m = new Map<string, { name: string; email: string; orders: number; spent: number }>();
    for (const o of paidStorefrontOrders) {
      const b = o.buyer;
      const prev = m.get(o.buyer_id) ?? {
        name: b?.name || 'Unknown',
        email: b?.email || '',
        orders: 0,
        spent: 0,
      };
      prev.orders += 1;
      prev.spent += Number(o.total_amount);
      if (b?.name) prev.name = b.name;
      if (b?.email) prev.email = b.email;
      m.set(o.buyer_id, prev);
    }
    return Array.from(m.entries())
      .map(([buyerId, v]) => ({ buyerId, ...v }))
      .sort((a, b) => b.spent - a.spent);
  }, [paidStorefrontOrders]);

  const affiliateRows = useMemo(
    () =>
      members
        .filter((mem) => mem.role === 'AFFILIATE')
        .map((mem) => {
          const attributed = paidStorefrontOrders.filter((o) => o.affiliate_id === mem.user_id);
          return {
            member: mem,
            orderCount: attributed.length,
            gmv: attributed.reduce((s, o) => s + Number(o.total_amount), 0),
          };
        }),
    [members, paidStorefrontOrders],
  );

  const resellerRows = useMemo(
    () =>
      members
        .filter((mem) => mem.role === 'RESELLER')
        .map((mem) => {
          const attributed = paidStorefrontOrders.filter((o) => o.reseller_id === mem.user_id);
          return {
            member: mem,
            orderCount: attributed.length,
            gmv: attributed.reduce((s, o) => s + Number(o.total_amount), 0),
          };
        }),
    [members, paidStorefrontOrders],
  );

  const affiliateAttributedOrders = useMemo(
    () => paidStorefrontOrders.filter((o) => o.affiliate_id),
    [paidStorefrontOrders],
  );

  const saveAffiliateCommission = async (orderId: string) => {
    if (!tenant) return;
    const edit = affiliateCommissionEdits[orderId];
    if (!edit) return;
    const raw = edit.amount.trim();
    const parsed = raw === '' ? null : Number(raw);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast('Enter a valid commission amount (INR) or leave blank.', 'error');
      return;
    }
    setSavingAffiliateCommissionFor(orderId);
    const { error } = await supabase
      .from('orders')
      .update({
        affiliate_commission_amount: parsed,
        affiliate_commission_note: edit.note.trim() || null,
      })
      .eq('id', orderId)
      .eq('tenant_id', tenant.id);
    setSavingAffiliateCommissionFor(null);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Commission saved.', 'success');
    setTenantOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              affiliate_commission_amount: parsed,
              affiliate_commission_note: edit.note.trim() || null,
            }
          : o,
      ),
    );
  };

  const payPlatformDue = async (due: SaasTenantPlatformDue) => {
    if (!tenant || !user || due.status !== 'pending') return;
    setPayingDueId(due.id);
    try {
      const created = await invokeEdgeFunction<{
        session_id: string;
        razorpay_order_id: string;
        key_id: string;
        amount: number;
      }>('create-razorpay-saas-due-order', { platform_due_id: due.id });

      await loadRazorpayScript();
      openRazorpayModal({
        keyId: created.key_id,
        orderId: created.razorpay_order_id,
        name: `${tenant.store_name} — platform`,
        description: `Pay ${formatINR(created.amount / 100)}`,
        prefillEmail: user.email ?? undefined,
        themeColor: tenant.primary_color || '#f97316',
        onSuccess: async (resp) => {
          try {
            await invokeEdgeFunction('verify-razorpay-saas-due-payment', {
              session_id: created.session_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast('Payment recorded.', 'success');
            await fetchData();
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Verification failed', 'error');
          } finally {
            setPayingDueId(null);
          }
        },
        onDismiss: () => setPayingDueId(null),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start payment', 'error');
      setPayingDueId(null);
    }
  };

  const createStore = async () => {
    if (!user || !form.store_name.trim()) return;
    setSaving(true);
    const { data: row, error } = await supabase
      .from('saas_tenants')
      .insert({
        owner_id: user.id,
        store_name: form.store_name.trim(),
        slug: form.slug || slugify(form.store_name),
        logo: form.logo.trim() || null,
        primary_color: form.primary_color,
        subscription_plan: 'starter',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      setSaving(false);
      toast(error.message, 'error');
      return;
    }

    let logoUrl: string | null = form.logo.trim() || null;
    if (createLogoFile && row?.id) {
      setUploadingLogo(true);
      const safeName = createLogoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${row.id}/${crypto.randomUUID()}-${safeName}`;
      const { url, error: upErr } = await uploadPublicFile('store-assets', path, createLogoFile);
      setUploadingLogo(false);
      if (upErr) {
        toast(upErr, 'error');
      } else if (url) {
        logoUrl = url;
      }
    }

    if (logoUrl && row?.id) {
      const { error: patchErr } = await supabase.from('saas_tenants').update({ logo: logoUrl }).eq('id', row.id);
      if (patchErr) toast(patchErr.message, 'error');
    }

    setCreateLogoFile(null);
    setSaving(false);
    toast('Store created successfully!');
    fetchData();
  };

  const saveBranding = async () => {
    if (!tenant) return;
    setSaving(true);
    const affFee = Number(branding.default_affiliate_platform_fee_percent);
    const resFee = Number(branding.default_reseller_platform_fee_percent);
    if (!Number.isFinite(affFee) || affFee < 0 || affFee > 100 || !Number.isFinite(resFee) || resFee < 0 || resFee > 100) {
      toast('Fee percentages must be between 0 and 100', 'error');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('saas_tenants')
      .update({
        store_name: branding.store_name,
        logo: branding.logo || null,
        primary_color: branding.primary_color,
        reseller_requirements: branding.reseller_requirements,
        store_about: branding.store_about,
        store_terms: branding.store_terms,
        default_affiliate_platform_fee_percent: affFee,
        default_reseller_platform_fee_percent: resFee,
      })
      .eq('id', tenant.id);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Branding updated!');
    fetchData();
  };

  const upgradeToPro = async () => {
    if (!tenant) return;
    if (!confirm('Upgrade this store to the Pro plan?')) return;
    setSaving(true);
    const { error } = await supabase.from('saas_tenants').update({ subscription_plan: 'pro' }).eq('id', tenant.id);
    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Your store is now on Pro.');
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

  const openCatalogAddModal = (product: Product) => {
    setCatalogModal({ mode: 'add', product });
    setCatalogQtyInput(1);
  };

  const openCatalogIncreaseModal = (line: TenantProduct) => {
    setCatalogModal({ mode: 'increase', line });
    setCatalogQtyInput(line.listing_quantity ?? 1);
  };

  const closeCatalogModal = () => {
    if (catalogSubmitting) return;
    setCatalogModal(null);
  };

  const submitCatalogModal = async () => {
    if (!tenant || !user || !catalogModal) return;
    const qty = Math.floor(Number(catalogQtyInput));
    if (!Number.isFinite(qty) || qty < 1) {
      toast('Enter a valid quantity (at least 1).', 'error');
      return;
    }

    if (catalogModal.mode === 'add') {
      const product = catalogModal.product;
      if (qty > product.stock) {
        toast(`Only ${product.stock} units in stock.`, 'error');
        return;
      }
      setCatalogSubmitting(true);
      const unit = Number(product.price) || 0;
      const total = unit * qty;
      const { data: ord, error: oErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          product_id: product.id,
          quantity: qty,
          total_amount: total,
          status: 'confirmed',
          tenant_id: tenant.id,
          payment_timing: 'prepaid',
          payment_status: 'paid',
          order_kind: 'catalog_procurement',
        })
        .select('id')
        .single();
      if (oErr) {
        setCatalogSubmitting(false);
        toast(oErr.message, 'error');
        return;
      }
      const { error: tpErr } = await supabase.from('tenant_products').insert({
        tenant_id: tenant.id,
        product_id: product.id,
        listing_quantity: qty,
        catalog_procurement_order_id: ord.id,
      });
      if (tpErr) {
        await supabase.from('orders').delete().eq('id', ord.id);
        setCatalogSubmitting(false);
        toast(tpErr.message.includes('duplicate') ? 'Already in your store' : tpErr.message, 'error');
        return;
      }
      const { error: stErr } = await supabase
        .from('products')
        .update({ stock: product.stock - qty })
        .eq('id', product.id);
      if (stErr) {
        toast('Listed, but stock update failed: ' + stErr.message, 'error');
      }
      setCatalogSubmitting(false);
      setCatalogModal(null);
      toast('Product added; vendor catalog purchase recorded.');
      fetchData();
      return;
    }

    const line = catalogModal.line;
    const p = line.product as Product | undefined;
    if (!p) {
      toast('Product not loaded.', 'error');
      return;
    }
    const current = line.listing_quantity ?? 1;
    if (qty <= current) {
      toast(`New total must be greater than current listed quantity (${current}).`, 'error');
      return;
    }
    const delta = qty - current;
    if (delta > p.stock) {
      toast(`Only ${p.stock} more units available from vendor stock.`, 'error');
      return;
    }
    setCatalogSubmitting(true);
    const unit = Number(p.price) || 0;
    const { data: ord, error: oErr } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        product_id: p.id,
        quantity: delta,
        total_amount: unit * delta,
        status: 'confirmed',
        tenant_id: tenant.id,
        payment_timing: 'prepaid',
        payment_status: 'paid',
        order_kind: 'catalog_procurement',
      })
      .select('id')
      .single();
    if (oErr) {
      setCatalogSubmitting(false);
      toast(oErr.message, 'error');
      return;
    }
    const { error: upErr } = await supabase
      .from('tenant_products')
      .update({ listing_quantity: qty })
      .eq('id', line.id);
    if (upErr) {
      await supabase.from('orders').delete().eq('id', ord.id);
      setCatalogSubmitting(false);
      toast(upErr.message, 'error');
      return;
    }
    const { error: stErr } = await supabase
      .from('products')
      .update({ stock: p.stock - delta })
      .eq('id', p.id);
    if (stErr) {
      toast('Listing updated, but stock sync failed: ' + stErr.message, 'error');
    }
    setCatalogSubmitting(false);
    setCatalogModal(null);
    toast('Additional units purchased.');
    fetchData();
  };

  const removeProductFromStore = async (lineId: string) => {
    if (!confirm('Remove this product from your storefront?')) return;
    const { error } = await supabase.from('tenant_products').delete().eq('id', lineId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Removed from store');
    fetchData();
  };

  const applyLogoUrl = () => {
    const u = logoPaste.trim();
    if (!u) return;
    try {
      // eslint-disable-next-line no-new -- validate
      new URL(u);
      setBranding((b) => ({ ...b, logo: u }));
      setLogoPaste('');
      toast('Logo URL applied (save branding to persist)', 'success');
    } catch {
      toast('Invalid logo URL', 'error');
    }
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setUploadingLogo(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${tenant.id}/${crypto.randomUUID()}-${safeName}`;
    const { url, error } = await uploadPublicFile('store-assets', path, file);
    setUploadingLogo(false);
    e.target.value = '';
    if (error) { toast(error, 'error'); return; }
    if (url) {
      setBranding((b) => ({ ...b, logo: url }));
      toast('Logo uploaded (save branding to persist)', 'success');
    }
  };

  const inStoreIds = new Set(storeLines.map((l) => l.product_id));
  const availableCatalog = tenant
    ? vendorCatalog.filter(
        (p) =>
          !inStoreIds.has(p.id) &&
          (!catalogSearch.trim() ||
            p.name.toLowerCase().includes(catalogSearch.trim().toLowerCase())),
      )
    : [];

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
              <label className="block text-sm font-medium text-navy-700 mb-1">Logo</label>
              <p className="text-xs text-navy-500 mb-2">Paste a URL and/or choose an image file (file is uploaded after the store is created).</p>
              <input
                type="url"
                value={form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none mb-2"
                placeholder="https://example.com/logo.png (optional)"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50 cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-accent-500" />
                  {uploadingLogo ? 'Uploading logo…' : 'Upload logo from file'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={saving || uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      setCreateLogoFile(f || null);
                    }}
                  />
                </label>
                {createLogoFile && (
                  <span className="text-xs text-navy-600 flex items-center gap-2">
                    {createLogoFile.name}
                    <button
                      type="button"
                      className="text-accent-600 hover:underline"
                      onClick={() => setCreateLogoFile(null)}
                    >
                      Clear
                    </button>
                  </span>
                )}
              </div>
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
              disabled={saving || uploadingLogo || !form.store_name.trim()}
              className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving || uploadingLogo ? 'Creating…' : 'Create Store'}
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
        <Link
          to={`/store/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm transition-colors self-start"
        >
          <ExternalLink className="w-4 h-4" /> Visit Store
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Plan" value={tenant.subscription_plan === 'pro' ? 'Pro' : 'Starter'} icon={<Crown className="w-5 h-5" />} color="navy" to="/dashboard/saas#saas-subscription" />
        <StatCard title="Status" value={tenant.is_active ? 'Active' : 'Inactive'} icon={<Activity className="w-5 h-5" />} color={tenant.is_active ? 'success' : 'navy'} to="/dashboard/saas#saas-subscription" />
        <StatCard title="Paid storefront orders" value={String(stats.orders)} icon={<ShoppingCart className="w-5 h-5" />} color="blue" to="/dashboard/saas#saas-orders" />
        <StatCard
          title="Collected storefront revenue"
          value={formatINR(stats.revenue)}
          icon={<DollarSign className="w-5 h-5" />}
          color="accent"
          to="/dashboard/saas#saas-orders"
          subtitle={`${formatINR(stats.resellerMarginsToSettle)} reseller margins to settle (paid orders)`}
        />
        <StatCard
          title="Catalog purchases"
          value={formatINR(stats.procurementRevenue)}
          icon={<ShoppingBag className="w-5 h-5" />}
          color="navy"
          to="/dashboard/saas#saas-orders"
          subtitle={`${stats.procurementOrders} orders`}
        />
        <StatCard title="SKUs in store" value={String(stats.catalogCount)} icon={<Package className="w-5 h-5" />} color="success" to="/dashboard/saas#saas-catalog" />
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-platform-dues">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent-500" /> Platform invoices
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Amounts your store owes the platform (created by admin). Pay securely with Razorpay when status is pending.
          </p>
        </div>
        <div className="p-6">
          {platformDues.length === 0 ? (
            <p className="text-sm text-navy-500">No platform invoices for this store.</p>
          ) : (
            <ul className="divide-y divide-navy-100 border border-navy-100 rounded-lg overflow-hidden">
              {platformDues.map((d) => (
                <li key={d.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white">
                  <div>
                    <p className="font-medium text-navy-900">{d.title?.trim() || 'Platform due'}</p>
                    <p className="text-xs text-navy-500 mt-0.5">{formatDate(d.created_at)} · {d.status}</p>
                    {d.notes?.trim() ? <p className="text-sm text-navy-600 mt-1">{d.notes.trim()}</p> : null}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-navy-900">{formatINR(d.amount)}</span>
                    {d.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={payingDueId === d.id}
                        onClick={() => void payPlatformDue(d)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
                      >
                        {payingDueId === d.id ? 'Opening…' : 'Pay with Razorpay'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-nimbuspost">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-accent-500" /> Nimbuspost delivery
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Auto-book one shipment per storefront order line after checkout (prepaid and postpaid). Use API credentials from
            Nimbuspost (Settings → API). Adjust packing defaults if couriers require weight or dimensions.
          </p>
        </div>
        <div className="p-6 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={nimbus.enabled}
              onChange={(e) => setNimbus((v) => ({ ...v, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-navy-900">Enable automatic booking</span>
          </label>
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-navy-600">API user email</label>
              <input
                type="email"
                value={nimbus.api_email}
                onChange={(e) => setNimbus((v) => ({ ...v, api_email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                placeholder="api-user@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">
                API password {nimbus.hasStoredPassword ? '(leave blank to keep)' : ''}
              </label>
              <input
                type="password"
                value={nimbus.api_password}
                onChange={(e) => setNimbus((v) => ({ ...v, api_password: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-600">Warehouse ID (from Nimbuspost)</label>
              <input
                type="text"
                value={nimbus.warehouse_id}
                onChange={(e) => setNimbus((v) => ({ ...v, warehouse_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                placeholder="Optional pickup / warehouse id"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-navy-600">Weight (g)</label>
                <input
                  type="number"
                  min={1}
                  value={nimbus.default_weight_grams}
                  onChange={(e) => setNimbus((v) => ({ ...v, default_weight_grams: Number(e.target.value) || 500 }))}
                  className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy-600">L / W / H (cm)</label>
                <div className="mt-1 flex gap-1">
                  <input
                    type="number"
                    min={1}
                    value={nimbus.default_length_cm}
                    onChange={(e) => setNimbus((v) => ({ ...v, default_length_cm: Number(e.target.value) || 10 }))}
                    className="w-full rounded-lg border border-navy-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={nimbus.default_width_cm}
                    onChange={(e) => setNimbus((v) => ({ ...v, default_width_cm: Number(e.target.value) || 10 }))}
                    className="w-full rounded-lg border border-navy-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={nimbus.default_height_cm}
                    onChange={(e) => setNimbus((v) => ({ ...v, default_height_cm: Number(e.target.value) || 10 }))}
                    className="w-full rounded-lg border border-navy-200 px-2 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-navy-500 md:col-span-2">
            Webhook URL (optional): <code className="bg-navy-50 px-1 rounded">{'{{SUPABASE_URL}}/functions/v1/nimbuspost-webhook?secret=YOUR_SECRET'}</code>
            — set <code className="bg-navy-50 px-1 rounded">NIMBUSPOST_WEBHOOK_SECRET</code> on the Edge function. See{' '}
            <span className="font-medium">docs/NIMBUSPOST.md</span>.
          </p>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={savingNimbus}
              onClick={() => void saveNimbusSettings()}
              className="px-4 py-2 rounded-lg bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 disabled:opacity-50"
            >
              {savingNimbus ? 'Saving…' : 'Save Nimbuspost settings'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-orders">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent-500" /> Orders & payments
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Storefront checkouts and catalog procurement (when you buy units from vendors to list). Type column shows
            which is which.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[360px]">
          {tenantOrders.length === 0 ? (
            <p className="p-6 text-sm text-navy-500">No orders for this store yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 sticky top-0 text-left text-navy-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Store base</th>
                  <th className="px-4 py-3 font-medium">Reseller margin</th>
                  <th className="px-4 py-3 font-medium">Pay</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium min-w-[120px]">Delivery</th>
                  <th className="px-4 py-3 font-medium">Affiliate</th>
                  <th className="px-4 py-3 font-medium">Reseller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {tenantOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-2.5 text-navy-500 whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          o.order_kind === 'catalog_procurement'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-navy-100 text-navy-700'
                        }`}
                      >
                        {o.order_kind === 'catalog_procurement' ? 'Catalog buy' : 'Storefront'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-navy-900 max-w-[140px] truncate">{o.product?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 max-w-[160px]">
                      <span className="block truncate font-medium text-navy-900">{o.buyer?.name ?? '—'}</span>
                      <span className="block truncate text-xs text-navy-400">{o.buyer?.email ?? ''}</span>
                      {(o.customer_email || o.customer_phone) && (
                        <span className="block text-xs text-navy-500 mt-0.5">
                          {o.customer_email || ''} {o.customer_phone ? ` · ${o.customer_phone}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-navy-900 whitespace-nowrap">{formatINR(o.total_amount)}</td>
                    <td className="px-4 py-2.5 text-navy-700 whitespace-nowrap">
                      {o.order_kind === 'catalog_procurement'
                        ? '—'
                        : o.store_base_line_total != null
                        ? formatINR(Number(o.store_base_line_total))
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-navy-700 whitespace-nowrap">
                      {o.order_kind === 'catalog_procurement'
                        ? '—'
                        : o.reseller_margin_total != null
                        ? formatINR(Number(o.reseller_margin_total))
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-navy-700 whitespace-nowrap">
                      {o.payment_timing}
                      <span className="block text-xs text-navy-400">{o.payment_status}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-full bg-navy-100 text-navy-700">{o.status}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px] align-top text-xs">
                      {o.order_kind === 'catalog_procurement' ? (
                        '—'
                      ) : (
                        <>
                          {(() => {
                            const c = firstCarrierShipment(o);
                            return (
                              <>
                                {c?.label_url ? (
                                  <a
                                    href={c.label_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-accent-600 font-medium hover:underline block mb-0.5"
                                  >
                                    Label
                                  </a>
                                ) : null}
                                <span className="font-mono block text-navy-900">{c?.awb ?? '—'}</span>
                                {c?.courier_name ? (
                                  <span className="text-navy-600 block">{c.courier_name}</span>
                                ) : null}
                                {c?.delivery_status ? (
                                  <span className="text-navy-500 block">{c.delivery_status}</span>
                                ) : null}
                                {c?.last_error && !c?.awb ? (
                                  <span className="text-red-600 block line-clamp-3" title={c.last_error}>
                                    {c.last_error}
                                  </span>
                                ) : null}
                                {nimbus.enabled && !c?.awb ? (
                                  <button
                                    type="button"
                                    disabled={bookingOrderId === o.id}
                                    onClick={() => void retryNimbusBooking(o.id)}
                                    className="mt-1 text-accent-600 font-medium hover:underline disabled:opacity-50"
                                  >
                                    {bookingOrderId === o.id ? 'Booking…' : 'Retry Nimbuspost'}
                                  </button>
                                ) : null}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-navy-500 font-mono">{o.affiliate_id ? o.affiliate_id.slice(0, 8) + '…' : '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-navy-500 font-mono">{o.reseller_id ? o.reseller_id.slice(0, 8) + '…' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-affiliate-activity">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent-500" /> Affiliate activity
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Orders with an affiliate on file. Enter commission in INR per order—nothing is auto-calculated from product rules.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          {affiliateAttributedOrders.length === 0 ? (
            <p className="p-6 text-sm text-navy-500">No affiliate-attributed orders yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 sticky top-0 text-left text-navy-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Order total</th>
                  <th className="px-4 py-3 font-medium">Affiliate</th>
                  <th className="px-4 py-3 font-medium">Commission (INR)</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {affiliateAttributedOrders.map((o) => {
                  const edit = affiliateCommissionEdits[o.id] ?? { amount: '', note: '' };
                  return (
                    <tr key={o.id} className="hover:bg-navy-50/50 align-top">
                      <td className="px-4 py-2.5 text-navy-500 whitespace-nowrap">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-2.5 text-navy-900 max-w-[120px] truncate">{o.product?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 max-w-[140px]">
                        <span className="block truncate font-medium text-navy-900">{o.buyer?.name ?? '—'}</span>
                        <span className="block truncate text-xs text-navy-400">{o.buyer?.email ?? ''}</span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-navy-900 whitespace-nowrap">
                        {formatINR(o.total_amount)}
                      </td>
                      <td className="px-4 py-2.5 max-w-[130px]">
                        <span className="block truncate font-medium text-navy-900">{o.affiliate?.name ?? '—'}</span>
                        <span className="block truncate text-xs text-navy-400">{o.affiliate?.email ?? ''}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-28 rounded border border-navy-200 px-2 py-1 text-sm text-navy-900"
                          value={edit.amount}
                          onChange={(e) =>
                            setAffiliateCommissionEdits((prev) => ({
                              ...prev,
                              [o.id]: { ...edit, amount: e.target.value },
                            }))
                          }
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <input
                          type="text"
                          className="w-full min-w-[140px] rounded border border-navy-200 px-2 py-1 text-sm text-navy-900"
                          value={edit.note}
                          onChange={(e) =>
                            setAffiliateCommissionEdits((prev) => ({
                              ...prev,
                              [o.id]: { ...edit, note: e.target.value },
                            }))
                          }
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => void saveAffiliateCommission(o.id)}
                          disabled={savingAffiliateCommissionFor === o.id}
                          className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50 whitespace-nowrap"
                        >
                          {savingAffiliateCommissionFor === o.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-500" /> Customers
            </h2>
            <p className="text-sm text-navy-500 mt-1">Distinct buyers on your store (from orders).</p>
          </div>
          {customerSummaries.length === 0 ? (
            <p className="p-6 text-sm text-navy-500">No customer orders yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 max-h-[280px] overflow-y-auto">
              {customerSummaries.map((c) => (
                <li key={c.buyerId} className="px-6 py-3 flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900 truncate">{c.name}</p>
                    <p className="text-xs text-navy-400 truncate">{c.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-navy-900">{formatINR(c.spent)}</p>
                    <p className="text-xs text-navy-500">{c.orders} orders</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-100">
            <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-accent-500" /> Affiliates
            </h2>
            <p className="text-sm text-navy-500 mt-1">Store team members with affiliate role & attributed orders.</p>
          </div>
          {affiliateRows.length === 0 ? (
            <p className="p-6 text-sm text-navy-500">No affiliates invited yet.</p>
          ) : (
            <ul className="divide-y divide-navy-50 max-h-[280px] overflow-y-auto">
              {affiliateRows.map(({ member: m, orderCount, gmv }) => (
                <li key={m.id} className="px-6 py-3 flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900 truncate">{m.user?.name ?? '—'}</p>
                    <p className="text-xs text-navy-400 truncate">{m.user?.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-navy-900">{formatINR(gmv)}</p>
                    <p className="text-xs text-navy-500">{orderCount} orders</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent-500" /> Resellers
          </h2>
          <p className="text-sm text-navy-500 mt-1">Team members with reseller role & orders where they are credited.</p>
        </div>
        {resellerRows.length === 0 ? (
          <p className="p-6 text-sm text-navy-500">No resellers invited yet.</p>
        ) : (
          <ul className="divide-y divide-navy-50 max-h-[240px] overflow-y-auto">
            {resellerRows.map(({ member: m, orderCount, gmv }) => (
              <li key={m.id} className="px-6 py-3 flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900 truncate">{m.user?.name ?? '—'}</p>
                  <p className="text-xs text-navy-400 truncate">{m.user?.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-navy-900">{formatINR(gmv)}</p>
                  <p className="text-xs text-navy-500">{orderCount} orders</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-catalog">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-accent-500" /> Store catalog
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Pick vendor products and choose how many units to buy from the vendor; only that quantity is billed to
            vendors and drawn from stock. Shoppers use the store link below; affiliates and resellers participate through
            that same store.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-navy-100">
          <div className="p-6 max-h-[440px] overflow-y-auto border-b lg:border-b-0 border-navy-100">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                type="text"
                placeholder="Search vendor products..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-navy-200 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
              />
            </div>
            <h3 className="text-sm font-semibold text-navy-800 mb-2">Available from vendors</h3>
            {availableCatalog.length === 0 ? (
              <p className="text-sm text-navy-500">No products to add (all selected or no matches).</p>
            ) : (
              <ul className="space-y-2">
                {availableCatalog.slice(0, 80).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-navy-100 hover:bg-navy-50/80"
                  >
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-navy-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-900 truncate">{p.name}</p>
                      <p className="text-xs text-navy-500">{formatINR(p.price)}</p>
                      <p className="text-xs text-navy-400">Vendor stock: {p.stock ?? 0}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCatalogAddModal(p)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent-500 text-white text-xs font-medium hover:bg-accent-600"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-6 max-h-[440px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-navy-800 mb-2">In your store ({storeLines.length})</h3>
            {storeLines.length === 0 ? (
              <p className="text-sm text-navy-500">Add products from the left to populate your storefront.</p>
            ) : (
              <ul className="space-y-2">
                {storeLines.map((line) => {
                  const p = line.product as Product | undefined;
                  return (
                    <li
                      key={line.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-navy-100"
                    >
                      {p?.images?.[0] ? (
                        <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-navy-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-900 truncate">{p?.name || 'Product'}</p>
                        <p className="text-xs text-navy-500">
                          {p ? formatINR(p.price) : ''}
                          {p ? ` · listed qty ${line.listing_quantity ?? 1}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCatalogIncreaseModal(line)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-navy-200 text-navy-700 text-xs font-medium hover:bg-navy-50"
                      >
                        <TrendingUp className="w-3 h-3" /> Add units
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProductFromStore(line.id)}
                        className="shrink-0 p-1.5 rounded-lg text-navy-400 hover:text-red-500 hover:bg-red-50"
                        title="Remove from store"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden" id="saas-vendor-payments">
        <div className="px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent-500" /> Vendor catalog payments
          </h2>
          <p className="text-sm text-navy-500 mt-1">Amounts owed to vendors for products listed from their catalog (recorded by platform admin).</p>
        </div>
        <div className="p-6 max-h-56 overflow-y-auto">
          {saasCatalogDues.length === 0 ? (
            <p className="text-sm text-navy-500">No vendor catalog payment records for this store.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {saasCatalogDues.map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 border border-navy-100 rounded-lg p-3">
                  <span>
                    <span className="font-semibold text-navy-900">{formatINR(d.amount)}</span>
                    <span className="block text-xs text-navy-500 mt-0.5">
                      {(d as { vendor?: { name?: string } }).vendor?.name} · {formatDate(d.created_at)} · <span className="capitalize">{d.status}</span>
                    </span>
                    {d.basis ? <span className="block text-xs text-navy-400 mt-1">{d.basis}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              <label className="block text-sm font-medium text-navy-700 mb-1">Logo</label>
              <p className="text-xs text-navy-500 mb-2">Paste a public image URL or upload a file.</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50 cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  {uploadingLogo ? 'Uploading…' : 'Upload file'}
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} disabled={uploadingLogo} />
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={logoPaste}
                  onChange={(e) => setLogoPaste(e.target.value)}
                  placeholder="https://…/logo.png"
                  className="flex-1 min-w-0 px-3 py-2 border border-navy-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                />
                <button type="button" onClick={applyLogoUrl} className="px-3 py-2 rounded-lg bg-navy-100 text-sm font-medium text-navy-800 hover:bg-navy-200 shrink-0">
                  Use URL
                </button>
              </div>
              <input
                type="url"
                value={branding.logo}
                onChange={(e) => setBranding({ ...branding, logo: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-sm"
                placeholder="Current logo URL (edit directly)"
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
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Reseller requirements</label>
              <p className="text-xs text-navy-500 mb-1">Shown to resellers in their store dashboard (policy, minimums, etc.).</p>
              <textarea
                value={branding.reseller_requirements}
                onChange={(e) => setBranding({ ...branding, reseller_requirements: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Storefront — About us</label>
              <p className="text-xs text-navy-500 mb-1">Plain text shown on your public store’s About page.</p>
              <textarea
                value={branding.store_about}
                onChange={(e) => setBranding({ ...branding, store_about: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-sm"
                placeholder="Tell shoppers about your store…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Storefront — Terms &amp; conditions</label>
              <p className="text-xs text-navy-500 mb-1">Plain text shown on your public store’s Terms page.</p>
              <textarea
                value={branding.store_terms}
                onChange={(e) => setBranding({ ...branding, store_terms: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-sm"
                placeholder="Shipping, returns, liability, etc."
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Default affiliate platform fee %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={branding.default_affiliate_platform_fee_percent}
                  onChange={(e) =>
                    setBranding({ ...branding, default_affiliate_platform_fee_percent: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Default reseller platform fee %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={branding.default_reseller_platform_fee_percent}
                  onChange={(e) =>
                    setBranding({ ...branding, default_reseller_platform_fee_percent: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm"
                />
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
        <div className="bg-white rounded-xl border border-navy-100 p-6" id="saas-subscription">
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
              <button
                type="button"
                disabled={saving}
                onClick={() => void upgradeToPro()}
                className="w-full mt-2 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
              >
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
            <div className="flex justify-between text-sm gap-4">
              <span className="text-navy-500 shrink-0">Payments from customers (paid storefront)</span>
              <span className="font-semibold text-navy-900 text-right">{formatINR(stats.revenue)}</span>
            </div>
            <p className="text-xs text-navy-400 -mt-2">{stats.orders} paid order line(s)</p>
            <div className="flex justify-between text-sm gap-4">
              <span className="text-navy-500 shrink-0">Reseller margins to settle (paid storefront, attributed)</span>
              <span className="font-semibold text-navy-900 text-right">{formatINR(stats.resellerMarginsToSettle)}</span>
            </div>
            <p className="text-xs text-navy-400 -mt-2">Snapshots from orders; settle with resellers outside the platform.</p>
            <div className="flex justify-between text-sm gap-4">
              <span className="text-navy-500 shrink-0">Affiliate commissions (on paid storefront)</span>
              <span className="font-semibold text-navy-900 text-right">{formatINR(stats.affiliateCommissionsAccrued)}</span>
            </div>
            <p className="text-xs text-navy-400 -mt-2">Recorded per order; settlement may be separate.</p>
            <div className="flex justify-between text-sm gap-4">
              <span className="text-navy-500 shrink-0">Vendor catalog procurement (you paid vendors)</span>
              <span className="font-semibold text-navy-900 text-right">{formatINR(stats.procurementRevenue)}</span>
            </div>
            <p className="text-xs text-navy-400 -mt-2">{stats.procurementOrders} paid procurement line(s)</p>
            <div className="flex justify-between text-sm gap-4">
              <span className="text-navy-500 shrink-0">Paid to platform (admin invoices)</span>
              <span className="font-semibold text-navy-900 text-right">{formatINR(stats.platformPaidTotal)}</span>
            </div>
            <p className="text-xs text-navy-400 -mt-2">Settled platform dues (e.g. Razorpay or marked paid).</p>
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
              <option value="CUSTOMER">Customer (store shopper)</option>
              <option value="AFFILIATE">Affiliate</option>
              <option value="RESELLER">Reseller</option>
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

      <Modal
        isOpen={catalogModal !== null}
        onClose={closeCatalogModal}
        title={
          catalogModal?.mode === 'add'
            ? 'Buy units & add to store'
            : catalogModal?.mode === 'increase'
              ? 'Increase listed quantity'
              : ''
        }
        size="sm"
      >
        {catalogModal?.mode === 'add' ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-navy-900">{catalogModal.product.name}</p>
              <p className="text-xs text-navy-500 mt-1">
                {formatINR(catalogModal.product.price)} per unit · {catalogModal.product.stock} in stock
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Units to purchase from vendor</label>
              <input
                type="number"
                min={1}
                max={catalogModal.product.stock}
                value={catalogQtyInput}
                onChange={(e) => setCatalogQtyInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
              />
            </div>
            <p className="text-sm text-navy-700">
              Line total:{' '}
              <span className="font-semibold text-navy-900">
                {formatINR(Math.max(0, Number(catalogModal.product.price) || 0) * Math.max(1, catalogQtyInput))}
              </span>
            </p>
            <p className="text-xs text-navy-500">
              Creates a B2B order visible to the vendor and records your listed quantity for this SKU.
            </p>
            <button
              type="button"
              onClick={() => void submitCatalogModal()}
              disabled={catalogSubmitting}
              className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {catalogSubmitting ? 'Saving…' : 'Confirm purchase & list'}
            </button>
          </div>
        ) : catalogModal?.mode === 'increase' ? (
          <div className="space-y-4">
            {(() => {
              const line = catalogModal.line;
              const p = line.product as Product | undefined;
              if (!p) return <p className="text-sm text-navy-500">Product not loaded.</p>;
              const current = line.listing_quantity ?? 1;
              const maxTotal = current + p.stock;
              const unit = Number(p.price) || 0;
              const nextTotal = Math.max(current + 1, Math.min(maxTotal, Math.floor(Number(catalogQtyInput)) || current + 1));
              const delta = Math.max(0, nextTotal - current);
              return (
                <>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{p.name}</p>
                    <p className="text-xs text-navy-500 mt-1">
                      Currently listed: <strong>{current}</strong> · Vendor stock: {p.stock} · Max new total: {maxTotal}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-1">New total listed quantity</label>
                    <input
                      type="number"
                      min={current + 1}
                      max={maxTotal}
                      value={catalogQtyInput}
                      onChange={(e) => setCatalogQtyInput(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
                    />
                  </div>
                  <p className="text-sm text-navy-700">
                    Additional units: {delta} · Charge: <span className="font-semibold">{formatINR(unit * delta)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void submitCatalogModal()}
                    disabled={catalogSubmitting}
                    className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {catalogSubmitting ? 'Saving…' : 'Buy additional units'}
                  </button>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
