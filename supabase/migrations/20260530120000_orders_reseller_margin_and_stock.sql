/*
  # Storefront orders: reseller margin snapshot + vendor stock decrement
  
  - orders.store_base_line_total / reseller_margin_total: SaaS settlement vs catalog base
  - Extend listing trigger to also decrement products.stock (fail if insufficient)
*/

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_base_line_total double precision,
  ADD COLUMN IF NOT EXISTS reseller_margin_total double precision;

COMMENT ON COLUMN public.orders.store_base_line_total IS 'Store catalog base subtotal for this line (qty × base unit price at checkout).';
COMMENT ON COLUMN public.orders.reseller_margin_total IS 'Reseller margin owed by store for this line; customer paid total_amount to the store.';

CREATE OR REPLACE FUNCTION public.decrement_tenant_listing_on_storefront_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  s int;
BEGIN
  IF NEW.order_kind = 'storefront' AND NEW.tenant_id IS NOT NULL THEN
    UPDATE public.tenant_products
    SET listing_quantity = listing_quantity - NEW.quantity
    WHERE tenant_id = NEW.tenant_id
      AND product_id = NEW.product_id
      AND listing_quantity >= NEW.quantity;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      RAISE EXCEPTION 'Insufficient storefront listing quantity for this product (tenant %, product %, qty %)',
        NEW.tenant_id, NEW.product_id, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id
      AND stock >= NEW.quantity;
    GET DIAGNOSTICS s = ROW_COUNT;
    IF s = 0 THEN
      RAISE EXCEPTION 'Insufficient vendor stock for this product (product %, qty %)',
        NEW.product_id, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
