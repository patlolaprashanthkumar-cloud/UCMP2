/*
  # SaaS tenant platform dues

  Obligations where a SaaS store (tenant) owes the platform/admin — tracked for offline settlement.
  Store owner can read rows for their tenant; admins manage all rows.
*/

CREATE TABLE IF NOT EXISTS public.saas_tenant_platform_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  amount double precision NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.saas_tenant_platform_dues ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saas_tenant_platform_dues_tenant ON public.saas_tenant_platform_dues(tenant_id);

CREATE POLICY "SaaS owners read own tenant platform dues"
  ON public.saas_tenant_platform_dues FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage saas tenant platform dues"
  ON public.saas_tenant_platform_dues FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

COMMENT ON TABLE public.saas_tenant_platform_dues IS 'Amounts SaaS store owners owe the platform (admin-recorded; settled offline).';
