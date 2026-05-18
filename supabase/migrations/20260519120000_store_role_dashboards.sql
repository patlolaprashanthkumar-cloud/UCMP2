/*
  # Store role dashboards: sizes, cart uniqueness, delivery addresses, partner settings, tenant fee copy
*/

-- Product size options (empty array = single SKU / no picker)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}';

-- Cart: allow one row per (tenant, user, product, size)
ALTER TABLE public.store_cart_items DROP CONSTRAINT IF EXISTS store_cart_items_tenant_id_user_id_product_id_key;

ALTER TABLE public.store_cart_items
  ADD COLUMN IF NOT EXISTS size text;

CREATE UNIQUE INDEX IF NOT EXISTS store_cart_items_tenant_user_product_size_uidx
  ON public.store_cart_items (tenant_id, user_id, product_id, COALESCE(size, ''));

CREATE INDEX IF NOT EXISTS idx_store_cart_size ON public.store_cart_items(tenant_id, user_id, product_id);

-- Order line size snapshot
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS size text;

-- SaaS tenant copy + default platform fee percentages (store owner sets)
ALTER TABLE public.saas_tenants
  ADD COLUMN IF NOT EXISTS reseller_requirements text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_affiliate_platform_fee_percent double precision NOT NULL DEFAULT 5
    CHECK (default_affiliate_platform_fee_percent >= 0 AND default_affiliate_platform_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS default_reseller_platform_fee_percent double precision NOT NULL DEFAULT 5
    CHECK (default_reseller_platform_fee_percent >= 0 AND default_reseller_platform_fee_percent <= 100);

-- Per-user partner settings (margin for resellers; optional fee overrides)
CREATE TABLE IF NOT EXISTS public.tenant_store_partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  margin_percent double precision NOT NULL DEFAULT 0
    CHECK (margin_percent >= 0 AND margin_percent <= 1000),
  affiliate_fee_percent_override double precision
    CHECK (affiliate_fee_percent_override IS NULL OR (affiliate_fee_percent_override >= 0 AND affiliate_fee_percent_override <= 100)),
  reseller_fee_percent_override double precision
    CHECK (reseller_fee_percent_override IS NULL OR (reseller_fee_percent_override >= 0 AND reseller_fee_percent_override <= 100)),
  requirements_ack_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.tenant_store_partner_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partner_settings_tenant ON public.tenant_store_partner_settings(tenant_id);

CREATE POLICY "Partners manage own store partner settings"
  ON public.tenant_store_partner_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "SaaS owners read tenant partner settings"
  ON public.tenant_store_partner_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Delivery addresses (scoped to store + customer)
CREATE TABLE IF NOT EXISTS public.store_delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'IN',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_delivery_addresses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_addresses_tenant_user ON public.store_delivery_addresses(tenant_id, user_id);

CREATE POLICY "Users manage own delivery addresses"
  ON public.store_delivery_addresses FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "SaaS owners read tenant delivery addresses"
  ON public.store_delivery_addresses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );
