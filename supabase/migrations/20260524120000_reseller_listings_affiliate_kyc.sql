/*
  Public reseller margin listings, cart resale metadata, manual affiliate commission on orders,
  SaaS owner KYC review for vendors in storefront catalog.
*/

-- Reseller margin rows: public seller label for anon storefront
ALTER TABLE public.tenant_store_reseller_product_margins
  ADD COLUMN IF NOT EXISTS seller_display_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tenant_store_reseller_product_margins.seller_display_name IS
  'Denormalized public display name (from reseller profile) for storefront “sold by”';

-- Cart: distinguish reseller listing lines vs reseller “stocking” purchases
ALTER TABLE public.store_cart_items
  ADD COLUMN IF NOT EXISTS offered_by_reseller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_intent text NULL
    CHECK (purchase_intent IS NULL OR purchase_intent IN ('resale_stock'));

DROP INDEX IF EXISTS public.store_cart_items_tenant_user_product_size_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS store_cart_items_tenant_user_product_size_offer_intent_uidx
  ON public.store_cart_items (
    tenant_id,
    user_id,
    product_id,
    COALESCE(size, ''),
    COALESCE(offered_by_reseller_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(purchase_intent, '')
  );

CREATE INDEX IF NOT EXISTS idx_store_cart_reseller_offer ON public.store_cart_items(tenant_id, user_id, offered_by_reseller_id);

-- Manual affiliate commission (SaaS owner records payout per order)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS affiliate_commission_amount double precision NULL
    CHECK (affiliate_commission_amount IS NULL OR (affiliate_commission_amount >= 0 AND affiliate_commission_amount <= 100000000)),
  ADD COLUMN IF NOT EXISTS affiliate_commission_note text NULL;

COMMENT ON COLUMN public.orders.affiliate_commission_amount IS 'Store owner–set commission (currency) for this affiliate-attributed order.';
COMMENT ON COLUMN public.orders.affiliate_commission_note IS 'Optional note from store owner about this commission.';

-- Public read: reseller margins for active storefront SKUs (no PII beyond seller_display_name)
CREATE POLICY "Anon read storefront reseller margins"
  ON public.tenant_store_reseller_product_margins FOR SELECT TO anon
  USING (
    margin_amount > 0
    AND COALESCE(seller_display_name, '') <> ''
    AND EXISTS (
      SELECT 1
      FROM public.tenant_products tp
      INNER JOIN public.saas_tenants st ON st.id = tp.tenant_id AND st.is_active = true
      WHERE tp.tenant_id = tenant_store_reseller_product_margins.tenant_id
        AND tp.product_id = tenant_store_reseller_product_margins.product_id
    )
  );

CREATE POLICY "Authenticated read storefront reseller margins"
  ON public.tenant_store_reseller_product_margins FOR SELECT TO authenticated
  USING (
    margin_amount > 0
    AND COALESCE(seller_display_name, '') <> ''
    AND EXISTS (
      SELECT 1
      FROM public.tenant_products tp
      INNER JOIN public.saas_tenants st ON st.id = tp.tenant_id AND st.is_active = true
      WHERE tp.tenant_id = tenant_store_reseller_product_margins.tenant_id
        AND tp.product_id = tenant_store_reseller_product_margins.product_id
    )
  );

-- SaaS owners: read vendor profiles that supply their storefront
CREATE POLICY "SaaS owners read vendor profiles in storefront catalog"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    role = 'VENDOR'
    AND EXISTS (
      SELECT 1
      FROM public.saas_tenants st
      INNER JOIN public.tenant_products tp ON tp.tenant_id = st.id
      INNER JOIN public.products pr ON pr.id = tp.product_id AND pr.vendor_id = profiles.id
      WHERE st.owner_id = auth.uid()
    )
  );

-- SaaS owners: read/update KYC for those vendors
CREATE POLICY "SaaS owners read vendor kyc in storefront catalog"
  ON public.kyc FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pv WHERE pv.id = kyc.user_id AND pv.role = 'VENDOR')
    AND EXISTS (
      SELECT 1
      FROM public.saas_tenants st
      INNER JOIN public.tenant_products tp ON tp.tenant_id = st.id
      INNER JOIN public.products pr ON pr.id = tp.product_id AND pr.vendor_id = kyc.user_id
      WHERE st.owner_id = auth.uid()
    )
  );

CREATE POLICY "SaaS owners update vendor kyc in storefront catalog"
  ON public.kyc FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pv WHERE pv.id = kyc.user_id AND pv.role = 'VENDOR')
    AND EXISTS (
      SELECT 1
      FROM public.saas_tenants st
      INNER JOIN public.tenant_products tp ON tp.tenant_id = st.id
      INNER JOIN public.products pr ON pr.id = tp.product_id AND pr.vendor_id = kyc.user_id
      WHERE st.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles pv WHERE pv.id = kyc.user_id AND pv.role = 'VENDOR')
    AND EXISTS (
      SELECT 1
      FROM public.saas_tenants st
      INNER JOIN public.tenant_products tp ON tp.tenant_id = st.id
      INNER JOIN public.products pr ON pr.id = tp.product_id AND pr.vendor_id = kyc.user_id
      WHERE st.owner_id = auth.uid()
    )
  );

-- Keep profiles.kyc_status in sync whenever kyc.status changes (SaaS/admin approvals only need to touch kyc)
CREATE OR REPLACE FUNCTION public.trg_kyc_sync_profile_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET kyc_status = NEW.status WHERE id = NEW.user_id;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.profiles SET kyc_status = NEW.status WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_sync_profile_kyc_status ON public.kyc;
CREATE TRIGGER kyc_sync_profile_kyc_status
  AFTER INSERT OR UPDATE OF status ON public.kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kyc_sync_profile_kyc_status();
