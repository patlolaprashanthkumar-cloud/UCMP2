/*
  # Platform billing: vendor dues to admin, SaaS catalog dues to vendors, royalty % on tenant_products
*/

-- Royalty % owed to vendor when a SaaS store sells their SKU (MVP default 10%)
ALTER TABLE public.tenant_products
  ADD COLUMN IF NOT EXISTS vendor_royalty_percent double precision NOT NULL DEFAULT 10
  CHECK (vendor_royalty_percent >= 0 AND vendor_royalty_percent <= 100);

-- Vendors pay platform / admin (tracked obligations)
CREATE TABLE IF NOT EXISTS public.vendor_platform_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount double precision NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.vendor_platform_dues ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vendor_platform_dues_vendor ON public.vendor_platform_dues(vendor_id);

CREATE POLICY "Vendors read own platform dues"
  ON public.vendor_platform_dues FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Admins manage vendor platform dues"
  ON public.vendor_platform_dues FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- SaaS tenant owes vendor for catalog product usage / sales share (admin records)
CREATE TABLE IF NOT EXISTS public.saas_vendor_catalog_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount double precision NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
  period_start date,
  period_end date,
  basis text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.saas_vendor_catalog_dues ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saas_vendor_dues_tenant ON public.saas_vendor_catalog_dues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_vendor_dues_vendor ON public.saas_vendor_catalog_dues(vendor_id);

CREATE POLICY "SaaS owners read tenant catalog dues"
  ON public.saas_vendor_catalog_dues FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Vendors read catalog dues owed to them"
  ON public.saas_vendor_catalog_dues FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Admins manage saas vendor catalog dues"
  ON public.saas_vendor_catalog_dues FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );
