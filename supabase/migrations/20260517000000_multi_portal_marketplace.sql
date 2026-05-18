/*
  # Multi-portal marketplace: CUSTOMER role, tenant_products, product RLS, vendor catalog RPC, storage buckets
*/

-- 1. CUSTOMER role on profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER', 'ADMIN', 'CUSTOMER'));

-- 2. tenant_products (SaaS store curation)
CREATE TABLE IF NOT EXISTS public.tenant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id)
);

ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tenant product links"
  ON public.tenant_products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "SaaS owners insert tenant products"
  ON public.tenant_products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saas_tenants st
      WHERE st.id = tenant_id AND st.owner_id = auth.uid()
    )
  );

CREATE POLICY "SaaS owners delete tenant products"
  ON public.tenant_products FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants st
      WHERE st.id = tenant_id AND st.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage tenant_products"
  ON public.tenant_products FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- 3. Products SELECT: replace broad catalog with marketplace + own rows
DROP POLICY IF EXISTS "Anyone authenticated can view active products" ON public.products;

CREATE POLICY "Vendors can view own products"
  ON public.products FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Marketplace can view tenant-listed active products"
  ON public.products FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.tenant_products tp
      INNER JOIN public.saas_tenants st ON st.id = tp.tenant_id AND st.is_active = true
      WHERE tp.product_id = products.id
    )
  );

-- 4. RPC: SaaS owners list all active vendor products for curation (bypasses marketplace RLS)
CREATE OR REPLACE FUNCTION public.list_vendor_catalog()
RETURNS TABLE (
  id uuid,
  vendor_id uuid,
  name text,
  description text,
  price double precision,
  mrp double precision,
  stock integer,
  category text,
  images text[],
  is_active boolean,
  tenant_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.vendor_id,
    p.name,
    p.description,
    p.price,
    p.mrp,
    p.stock,
    p.category,
    p.images,
    p.is_active,
    p.tenant_id,
    p.created_at
  FROM public.products p
  WHERE p.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'SAAS_OWNER'
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_vendor_catalog() TO authenticated;

-- 5. Storage buckets (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-media', 'product-media', true),
  ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read product-media" ON storage.objects;
CREATE POLICY "Public read product-media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Public read store-assets" ON storage.objects;
CREATE POLICY "Public read store-assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Vendors upload product-media" ON storage.objects;
CREATE POLICY "Vendors upload product-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors update own product-media" ON storage.objects;
CREATE POLICY "Vendors update own product-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Vendors delete own product-media" ON storage.objects;
CREATE POLICY "Vendors delete own product-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "SaaS owners upload store-assets" ON storage.objects;
CREATE POLICY "SaaS owners upload store-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.owner_id = auth.uid()
        AND t.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "SaaS owners update store-assets" ON storage.objects;
CREATE POLICY "SaaS owners update store-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.owner_id = auth.uid()
        AND t.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "SaaS owners delete store-assets" ON storage.objects;
CREATE POLICY "Saas owners delete store-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.saas_tenants t
      WHERE t.owner_id = auth.uid()
        AND t.id::text = (storage.foldername(name))[1]
    )
  );

-- 7. Public storefront (anon): browse curated products without login
CREATE POLICY "Anon can read tenant product links"
  ON public.tenant_products FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_tenants st
      WHERE st.id = tenant_id AND st.is_active = true
    )
  );

CREATE POLICY "Anon marketplace active products"
  ON public.products FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.tenant_products tp
      INNER JOIN public.saas_tenants st ON st.id = tp.tenant_id AND st.is_active = true
      WHERE tp.product_id = products.id
    )
  );

CREATE POLICY "Anon can read active tenants"
  ON public.saas_tenants FOR SELECT TO anon
  USING (is_active = true);

-- 6. Signup trigger: allow CUSTOMER role in metadata
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
BEGIN
  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''), '');
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'role'), ''), 'AFFILIATE');
  IF v_role NOT IN ('AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER', 'CUSTOMER') THEN
    v_role := 'AFFILIATE';
  END IF;
  v_referred_by := NULLIF(trim(NEW.raw_user_meta_data ->> 'referred_by'), '');

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
