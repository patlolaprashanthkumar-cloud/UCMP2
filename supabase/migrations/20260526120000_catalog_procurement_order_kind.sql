/*
  # Catalog procurement + vendor buyer profile read

  - orders.order_kind: storefront vs catalog_procurement (B2B buy from vendor when listing in store)
  - tenant_products: listing_quantity, link to initial procurement order
  - profiles RLS: vendors can read buyer profiles for B2B orders on their products (uses order_buyer_is_saas_owner from prior migration)
  - tenant_products UPDATE for SaaS owners (listing_quantity)
*/

-- order_kind (existing rows = storefront)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_kind text NOT NULL DEFAULT 'storefront';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_kind_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_kind_check
  CHECK (order_kind IN ('storefront', 'catalog_procurement'));

COMMENT ON COLUMN public.orders.order_kind IS 'storefront = shopper checkout; catalog_procurement = SaaS owner purchasing units when adding vendor SKU to store.';

-- tenant_products extensions
ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS listing_quantity integer NOT NULL DEFAULT 1
    CONSTRAINT tenant_products_listing_quantity_check CHECK (listing_quantity >= 1);

ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS catalog_procurement_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_products_procurement_order ON public.tenant_products(catalog_procurement_order_id);

-- SaaS owners may update their catalog rows (e.g. listing_quantity after extra procurement)
DROP POLICY IF EXISTS "SaaS owners update tenant products" ON public.tenant_products;
CREATE POLICY "SaaS owners update tenant products"
  ON public.tenant_products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants st
      WHERE st.id = tenant_id AND st.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saas_tenants st
      WHERE st.id = tenant_id AND st.owner_id = auth.uid()
    )
  );

-- Vendors can read buyer profile rows for users who placed B2B orders on the vendor''s products
DROP POLICY IF EXISTS "Vendors read buyers on their B2B orders" ON public.profiles;
CREATE POLICY "Vendors read buyers on their B2B orders"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      INNER JOIN public.products pr ON pr.id = o.product_id
      WHERE o.buyer_id = profiles.id
        AND pr.vendor_id = auth.uid()
        AND public.order_buyer_is_saas_owner(o.buyer_id)
    )
  );
