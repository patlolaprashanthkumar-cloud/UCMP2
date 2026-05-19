import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { formatINR, formatDate } from '../../../lib/format';
import type { Order, OrderKind, SaasTenant } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';

const PAGE_SIZE = 20;

type OrderRow = Order & {
  buyer?: { name?: string | null; email?: string | null } | null;
  product?: { name?: string | null } | null;
  tenant?: { store_name?: string | null; slug?: string | null } | null;
};

export function AdminOrders() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tenantFilter, setTenantFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detail, setDetail] = useState<OrderRow | null>(null);

  useEffect(() => {
    const t = searchParams.get('tenant') || '';
    setTenantFilter(t);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('saas_tenants').select('id, store_name, slug').order('store_name').limit(500);
      setTenants((data as SaasTenant[]) || []);
    })();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(
        `*,
        buyer:profiles!buyer_id(name, email),
        product:products(name),
        tenant:saas_tenants(store_name, slug)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    if (tenantFilter) query = query.eq('tenant_id', tenantFilter);
    if (kindFilter !== 'all') query = query.eq('order_kind', kindFilter as OrderKind);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      toast('Failed to load orders', 'error');
      setOrders([]);
      setTotal(0);
    } else {
      setOrders((data as OrderRow[]) || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [tenantFilter, kindFilter, statusFilter, page, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [tenantFilter, kindFilter, statusFilter]);

  function applyTenantToUrl(nextTenant: string) {
    setTenantFilter(nextTenant);
    const next = new URLSearchParams(searchParams);
    if (nextTenant) next.set('tenant', nextTenant);
    else next.delete('tenant');
    setSearchParams(next, { replace: true });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-orange-500" />
          Orders
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Review storefront and catalog procurement orders across all tenants.</p>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tenant</label>
          <select
            value={tenantFilter}
            onChange={(e) => applyTenantToUrl(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[12rem]"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.store_name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Order kind</label>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All kinds</option>
            <option value="storefront">Storefront</option>
            <option value="catalog_procurement">Catalog procurement</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="w-12 h-12 text-slate-300" />}
          title="No orders"
          description="Try changing filters or check back after sales activity."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Store</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Buyer</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Product</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-900">Qty</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-900">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Kind</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-slate-800">
                    {o.tenant ? (
                      <span>
                        {o.tenant.store_name}
                        <span className="text-slate-500 text-xs block">{o.tenant.slug}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{o.buyer?.name || '—'}</span>
                    <span className="text-slate-500 text-xs block">{o.buyer?.email || ''}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-800 max-w-[10rem] truncate">{o.product?.name || '—'}</td>
                  <td className="px-4 py-3 text-right">{o.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(o.total_amount)}</td>
                  <td className="px-4 py-3 capitalize text-xs">{o.order_kind || 'storefront'}</td>
                  <td className="px-4 py-3 capitalize">{o.status}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail(o)}
                      className="p-1 text-slate-500 hover:text-orange-500"
                      aria-label="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Order details" size="lg">
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 text-xs">Order ID</span>
                <p className="font-mono text-xs break-all">{detail.id}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Created</span>
                <p className="font-medium">{formatDate(detail.created_at)}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Status</span>
                <p className="font-medium capitalize">{detail.status}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Order kind</span>
                <p className="font-medium capitalize">{detail.order_kind || 'storefront'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Payment</span>
                <p className="font-medium">
                  {detail.payment_timing} · {detail.payment_status}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Quantity / line total</span>
                <p className="font-medium">
                  {detail.quantity} · {formatINR(detail.total_amount)}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Buyer</span>
                <p className="font-medium">{detail.buyer?.name || '—'}</p>
                <p className="text-slate-600 text-xs">{detail.buyer?.email || ''}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Product</span>
                <p className="font-medium">{detail.product?.name || '—'}</p>
                <p className="text-xs text-slate-500 font-mono">{detail.product_id}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Tenant</span>
                <p className="font-medium">{detail.tenant?.store_name || '—'}</p>
                <p className="text-xs text-slate-500">{detail.tenant?.slug || detail.tenant_id || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Size</span>
                <p className="font-medium">{detail.size || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Customer contact</span>
                <p className="font-medium">{detail.customer_email || '—'}</p>
                <p className="text-xs">{detail.customer_phone || ''}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 text-xs">Affiliate / reseller</span>
                <p className="font-medium">
                  affiliate: {detail.affiliate_id || '—'} · reseller: {detail.reseller_id || '—'}
                </p>
              </div>
              {detail.affiliate_commission_amount != null ? (
                <div className="col-span-2">
                  <span className="text-slate-500 text-xs">Affiliate commission</span>
                  <p className="font-medium">
                    {formatINR(detail.affiliate_commission_amount)}{' '}
                    {detail.affiliate_commission_note ? `· ${detail.affiliate_commission_note}` : ''}
                  </p>
                </div>
              ) : null}
            </div>
            <div>
              <span className="text-slate-500 text-xs block mb-1">Shipping snapshot</span>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-48">
                {detail.shipping_snapshot ? JSON.stringify(detail.shipping_snapshot, null, 2) : '—'}
              </pre>
            </div>
            <p className="text-xs text-slate-500">
              Razorpay: order <span className="font-mono">{detail.razorpay_order_id || '—'}</span> · payment{' '}
              <span className="font-mono">{detail.razorpay_payment_id || '—'}</span>
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
