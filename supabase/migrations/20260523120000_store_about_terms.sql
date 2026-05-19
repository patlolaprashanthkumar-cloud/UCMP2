-- Owner-editable storefront copy: About us and Terms & conditions
ALTER TABLE public.saas_tenants
  ADD COLUMN IF NOT EXISTS store_about text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS store_terms text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.saas_tenants.store_about IS 'Public "About us" body for the tenant storefront (plain text).';
COMMENT ON COLUMN public.saas_tenants.store_terms IS 'Public terms & conditions body for the tenant storefront (plain text).';
