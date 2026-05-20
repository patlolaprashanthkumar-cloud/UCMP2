/*
  # Razorpay integration foundations
  - Checkout sessions (server-confirmed amounts; fulfilled after payment verify/webhook)
  - Webhook idempotency ledger
  - orders.checkout_session_id, payment_provider; tighten INSERT RLS for storefront prepaid
  - SaaS platform due checkout + payment columns on dues
*/

-- Orders: correlate multi-line checkouts and tag payment rail
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'none'
    CONSTRAINT orders_payment_provider_check CHECK (payment_provider IN ('none', 'razorpay', 'manual')),
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;

COMMENT ON COLUMN public.orders.payment_provider IS 'none = legacy/offline; razorpay = cards/UPI via Razorpay; manual = admin/postpaid settlement.';
COMMENT ON COLUMN public.orders.checkout_session_id IS 'Links multiple order rows created from one storefront Razorpay checkout.';

CREATE INDEX IF NOT EXISTS idx_orders_checkout_session ON public.orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

-- Storefront Razorpay checkout sessions (written only via Edge Functions — service role)
CREATE TABLE IF NOT EXISTS public.store_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  affiliate_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  fallback_reseller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_email text,
  customer_phone text,
  shipping_snapshot jsonb,
  razorpay_order_id text,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_store_checkout_sessions_razorpay_order
  ON public.store_checkout_sessions(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

ALTER TABLE public.store_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers read own checkout sessions"
  ON public.store_checkout_sessions FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "SaaS owners read tenant checkout sessions"
  ON public.store_checkout_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Webhook idempotency
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'ok'
);

ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read razorpay webhook events"
  ON public.razorpay_webhook_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- FK from orders to sessions (optional column; enforce after table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_checkout_session_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_checkout_session_id_fkey
      FOREIGN KEY (checkout_session_id) REFERENCES public.store_checkout_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- SaaS platform dues: Razorpay correlation
ALTER TABLE public.saas_tenant_platform_dues
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

CREATE TABLE IF NOT EXISTS public.saas_due_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_due_id uuid NOT NULL REFERENCES public.saas_tenant_platform_dues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR',
  razorpay_order_id text,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_due_checkout_razorpay_order
  ON public.saas_due_checkout_sessions(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

ALTER TABLE public.saas_due_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SaaS due session read for due owner"
  ON public.saas_due_checkout_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenant_platform_dues d
      JOIN public.saas_tenants t ON t.id = d.tenant_id
      WHERE d.id = platform_due_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all saas due checkout sessions"
  ON public.saas_due_checkout_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Tighten order INSERT: no client-forged storefront prepaid/paid
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

CREATE POLICY "Buyers create allowed storefront or catalog procurement orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND (
      (
        order_kind = 'storefront'
        AND payment_timing = 'postpaid'
        AND payment_status = 'pending'
        AND COALESCE(payment_provider, 'none') IN ('none', 'manual')
      )
      OR (
        order_kind = 'catalog_procurement'
        AND payment_timing = 'prepaid'
        AND payment_status = 'paid'
        AND tenant_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.saas_tenants t
          WHERE t.id = tenant_id AND t.owner_id = auth.uid()
        )
      )
    )
  );

