/*
  # Store-centric commerce: order payment fields, cart & wishlist, SaaS owner order access, signup tenant_members
*/

-- Orders: payment + customer snapshot (optional at checkout)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_timing text NOT NULL DEFAULT 'prepaid'
    CONSTRAINT orders_payment_timing_check CHECK (payment_timing IN ('prepaid', 'postpaid')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS shipping_snapshot jsonb;

-- Link orders to tenant when present (nullable legacy rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.saas_tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Cart
CREATE TABLE IF NOT EXISTS public.store_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, product_id)
);

ALTER TABLE public.store_cart_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_cart_tenant_user ON public.store_cart_items(tenant_id, user_id);

-- Wishlist
CREATE TABLE IF NOT EXISTS public.store_wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, product_id)
);

ALTER TABLE public.store_wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_wishlist_tenant_user ON public.store_wishlist_items(tenant_id, user_id);

-- Cart RLS: own rows
CREATE POLICY "Users manage own cart items"
  ON public.store_cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "SaaS owners read tenant cart items"
  ON public.store_cart_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Wishlist RLS
CREATE POLICY "Users manage own wishlist items"
  ON public.store_wishlist_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "SaaS owners read tenant wishlist items"
  ON public.store_wishlist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Orders: SaaS owner can view / update orders for their store
DROP POLICY IF EXISTS "SaaS owners can view tenant orders" ON public.orders;
CREATE POLICY "SaaS owners can view tenant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = orders.tenant_id AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "SaaS owners can update tenant orders" ON public.orders;
CREATE POLICY "SaaS owners can update tenant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = orders.tenant_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.id = orders.tenant_id AND t.owner_id = auth.uid()
    )
  );

-- Tenant members: users can see their own memberships (store portal)
DROP POLICY IF EXISTS "Users can view own tenant memberships" ON public.tenant_members;
CREATE POLICY "Users can view own tenant memberships"
  ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Signup: tenant_id + store_role in user metadata -> tenant_members + profile role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_referred_by text;
  v_referrer_id uuid;
  v_code text;
  v_attempts int := 0;
  v_tenant_id uuid;
  v_store_role text;
  v_tid text;
BEGIN
  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''), '');
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'role'), ''), 'AFFILIATE');
  v_referred_by := NULLIF(trim(NEW.raw_user_meta_data ->> 'referred_by'), '');
  v_tid := NULLIF(trim(NEW.raw_user_meta_data ->> 'tenant_id'), '');

  IF v_tid IS NOT NULL THEN
    BEGIN
      v_tenant_id := v_tid::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_tenant_id := NULL;
    END;
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    v_store_role := upper(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'store_role'), ''), 'CUSTOMER'));
    IF v_store_role NOT IN ('CUSTOMER', 'AFFILIATE', 'RESELLER') THEN
      v_store_role := 'CUSTOMER';
    END IF;

    IF v_store_role IN ('AFFILIATE', 'RESELLER') THEN
      v_role := v_store_role;
    ELSE
      v_role := 'CUSTOMER';
    END IF;
  ELSE
    IF v_role NOT IN ('AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER', 'CUSTOMER') THEN
      v_role := 'AFFILIATE';
    END IF;
  END IF;

  LOOP
    v_code := 'UCMP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      v_code := 'UCMP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, name, email, role, referral_code, referred_by)
  VALUES (NEW.id, v_name, NEW.email, v_role, v_code, v_referred_by)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, v_store_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;

  IF v_referred_by IS NOT NULL THEN
    SELECT p.id
    INTO v_referrer_id
    FROM public.profiles p
    WHERE p.referral_code = v_referred_by
      AND p.id <> NEW.id
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      INSERT INTO public.referrals (referrer_id, referred_id)
      SELECT v_referrer_id, NEW.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.referrals r
        WHERE r.referrer_id = v_referrer_id
          AND r.referred_id = NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
