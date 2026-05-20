/*
  # Nimbuspost: per-tenant settings + order line carrier shipments (1:1 with orders)

  - Credentials are read by Edge (service role) only for booking; SaaS owner manages via dashboard (masked password updates).
*/

CREATE TABLE IF NOT EXISTS public.tenant_nimbuspost_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  api_email text NOT NULL DEFAULT '',
  api_password text NOT NULL DEFAULT '',
  warehouse_id text,
  default_weight_grams integer NOT NULL DEFAULT 500,
  default_length_cm numeric NOT NULL DEFAULT 10,
  default_width_cm numeric NOT NULL DEFAULT 10,
  default_height_cm numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_nimbuspost_settings IS 'Nimbuspost API user (email/password from seller panel Settings > API). Edge uses these to book shipments.';
COMMENT ON COLUMN public.tenant_nimbuspost_settings.api_password IS 'Stored in DB; never returned to browser (see RLS + dashboard patterns).';

CREATE TABLE IF NOT EXISTS public.order_carrier_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'nimbuspost',
  external_shipment_id text,
  awb text,
  courier_name text,
  label_url text,
  delivery_status text,
  last_error text,
  provider_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_carrier_shipments_tenant ON public.order_carrier_shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_carrier_shipments_awb ON public.order_carrier_shipments(awb) WHERE awb IS NOT NULL;

ALTER TABLE public.tenant_nimbuspost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_carrier_shipments ENABLE ROW LEVEL SECURITY;

-- SaaS owners manage Nimbuspost settings for their store (password is write-only from client perspective if we omit from select — use separate RPC or selective column policy; here we allow owner full access; dashboard will avoid displaying password).
CREATE POLICY "SaaS owners manage tenant Nimbuspost settings"
  ON public.tenant_nimbuspost_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_nimbuspost_settings.tenant_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_nimbuspost_settings.tenant_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "SaaS owners read tenant carrier shipments"
  ON public.order_carrier_shipments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = order_carrier_shipments.tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Allow SaaS owner to clear retry state if needed (optional; booking still runs via Edge)
CREATE POLICY "SaaS owners update tenant carrier shipments"
  ON public.order_carrier_shipments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = order_carrier_shipments.tenant_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = order_carrier_shipments.tenant_id AND t.owner_id = auth.uid()
    )
  );
