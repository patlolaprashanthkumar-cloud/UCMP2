import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type StoreMemberRole = 'CUSTOMER' | 'AFFILIATE' | 'RESELLER';

export function useStoreRole(tenantId: string | undefined) {
  const { user } = useAuth();
  const [storeRole, setStoreRole] = useState<StoreMemberRole>('CUSTOMER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !user) {
      setStoreRole('CUSTOMER');
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancel) return;
      const r = (data?.role as string | undefined)?.toUpperCase();
      if (r === 'AFFILIATE' || r === 'RESELLER' || r === 'CUSTOMER') {
        setStoreRole(r);
      } else if (user.role === 'AFFILIATE') setStoreRole('AFFILIATE');
      else if (user.role === 'RESELLER') setStoreRole('RESELLER');
      else setStoreRole('CUSTOMER');
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId, user]);

  const hideStockNumbers = !user || user.role === 'CUSTOMER' || storeRole === 'CUSTOMER';

  return { storeRole, loading, hideStockNumbers };
}
