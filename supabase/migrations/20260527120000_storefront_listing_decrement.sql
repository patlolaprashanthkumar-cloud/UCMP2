/*
  # Storefront orders: decrement tenant listing_quantity
  
  - Allow listing_quantity to reach 0 (sold out on store)
  - After INSERT orders for storefront + tenant, subtract quantity from tenant_products
*/

ALTER TABLE public.tenant_products DROP CONSTRAINT IF EXISTS tenant_products_listing_quantity_check;

ALTER TABLE public.tenant_products
  ADD CONSTRAINT tenant_products_listing_quantity_nonnegative
  CHECK (listing_quantity >= 0);

COMMENT ON COLUMN public.tenant_products.listing_quantity IS 'Units allocated for this store; decremented on each storefront order (see trigger).';

CREATE OR REPLACE FUNCTION public.decrement_tenant_listing_on_storefront_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_orders_decrement_tenant_listing ON public.orders;
CREATE TRIGGER tr_orders_decrement_tenant_listing
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_tenant_listing_on_storefront_order();
