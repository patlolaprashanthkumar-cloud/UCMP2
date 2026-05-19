import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/**
 * Deep links from affiliate/reseller tools: `/buy/:productId?ref=...&reseller=...`
 * Resolves an active storefront that lists the SKU and opens the store PDP.
 */
export function BuyProductRedirect() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      navigate('/', { replace: true });
      return;
    }
    let cancel = false;
    void (async () => {
      const { data: row } = await supabase
        .from('tenant_products')
        .select('tenant_id')
        .eq('product_id', productId)
        .limit(1)
        .maybeSingle();
      if (cancel) return;
      if (!row?.tenant_id) {
        setMessage('This product is not listed in an active store yet.');
        return;
      }
      const { data: tenant } = await supabase
        .from('saas_tenants')
        .select('slug')
        .eq('id', row.tenant_id)
        .eq('is_active', true)
        .maybeSingle();
      if (cancel) return;
      if (!tenant?.slug) {
        setMessage('This product is not listed in an active store yet.');
        return;
      }
      const qs = new URLSearchParams();
      const ref = searchParams.get('ref');
      const reseller = searchParams.get('reseller');
      if (ref) qs.set('ref', ref);
      if (reseller) qs.set('reseller', reseller);
      const q = qs.toString();
      navigate(`/store/${tenant.slug}/product/${productId}${q ? `?${q}` : ''}`, { replace: true });
    })();
    return () => {
      cancel = true;
    };
  }, [productId, navigate, searchParams]);

  if (message) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-navy-50">
        <p className="text-navy-700 text-center max-w-md">{message}</p>
        <Link to="/" className="text-accent-600 font-medium hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-50">
      <p className="text-navy-500 text-sm">Redirecting…</p>
    </div>
  );
}
