-- Store reseller margin as a fixed currency amount (per unit) instead of only a percentage.
ALTER TABLE public.tenant_store_partner_settings
  ADD COLUMN IF NOT EXISTS margin_amount double precision NOT NULL DEFAULT 0
    CHECK (margin_amount >= 0 AND margin_amount <= 100000000);

COMMENT ON COLUMN public.tenant_store_partner_settings.margin_amount IS
  'Reseller margin as a fixed amount added to base price per item (same currency as catalog).';

COMMENT ON COLUMN public.tenant_store_partner_settings.margin_percent IS
  'Legacy; superseded by margin_amount in store UI. Kept for backward compatibility.';
