/*
  # Provision profile, wallet, and referral on auth signup (email confirmation safe)

  When "Confirm email" is ON, signUp returns no JWT — client cannot pass RLS on profiles/wallets/referrals.
  This trigger runs as SECURITY DEFINER and reads name, role, referred_by from raw_user_meta_data.
*/

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
  IF v_role NOT IN ('AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER') THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
