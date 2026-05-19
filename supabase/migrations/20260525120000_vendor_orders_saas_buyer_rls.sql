/*
  # Vendor orders: SaaS-owner buyers only

  Vendors must not see end-customer storefront orders (those stay with SaaS tenant policies).
  Use a SECURITY DEFINER helper to test buyer role without exposing profiles via vendor RLS.
*/

CREATE OR REPLACE FUNCTION public.order_buyer_is_saas_owner(p_buyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles b
    WHERE b.id = p_buyer_id AND b.role = 'SAAS_OWNER'
  );
$$;

REVOKE ALL ON FUNCTION public.order_buyer_is_saas_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_buyer_is_saas_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "Vendors can view orders for their products" ON public.orders;
CREATE POLICY "Vendors can view SaaS buyer orders for their products"
  ON public.orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = orders.product_id AND p.vendor_id = auth.uid()
    )
    AND public.order_buyer_is_saas_owner(orders.buyer_id)
  );

DROP POLICY IF EXISTS "Vendors can update order status" ON public.orders;
CREATE POLICY "Vendors can update SaaS buyer orders for their products"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = orders.product_id AND p.vendor_id = auth.uid()
    )
    AND public.order_buyer_is_saas_owner(orders.buyer_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = orders.product_id AND p.vendor_id = auth.uid()
    )
    AND public.order_buyer_is_saas_owner(orders.buyer_id)
  );
