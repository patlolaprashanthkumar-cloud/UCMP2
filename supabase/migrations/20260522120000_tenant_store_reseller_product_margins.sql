-- Per-product fixed margin for store resellers (tenant + reseller + product).
CREATE TABLE IF NOT EXISTS public.tenant_store_reseller_product_margins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  margin_amount double precision NOT NULL DEFAULT 0
    CHECK (margin_amount >= 0 AND margin_amount <= 100000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, product_id)
);

ALTER TABLE public.tenant_store_reseller_product_margins ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reseller_product_margins_tenant_user
  ON public.tenant_store_reseller_product_margins(tenant_id, user_id);

COMMENT ON TABLE public.tenant_store_reseller_product_margins IS
  'Reseller-chosen fixed margin per store catalog product (selling narrative: base + margin).';

CREATE POLICY "Resellers manage own per-product margins"
  ON public.tenant_store_reseller_product_margins FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_products tp
      WHERE tp.tenant_id = tenant_store_reseller_product_margins.tenant_id
        AND tp.product_id = tenant_store_reseller_product_margins.product_id
    )
  );

CREATE POLICY "SaaS owners read tenant reseller product margins"
  ON public.tenant_store_reseller_product_margins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );
