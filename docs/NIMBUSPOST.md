# Nimbuspost delivery integration

## Behavior

- Each **storefront order line** (`orders` row) can have one **Nimbuspost** shipment (`order_carrier_shipments`), with AWB, courier, label URL, delivery status, and error details.
- **Prepaid**: after Razorpay verification / webhook, [`fulfillStoreCheckoutSession`](../supabase/functions/_shared/fulfillStoreCheckout.ts) inserts orders and calls [`bookNimbuspostForOrder`](../supabase/functions/_shared/bookNimbuspost.ts) per line.
- **Postpaid**: after the buyer inserts orders from [`StoreCheckoutPage`](../src/pages/store/StoreCheckoutPage.tsx), the client invokes the Edge [`book-nimbuspost-orders`](../supabase/functions/book-nimbuspost-orders/index.ts) function with the new order IDs.
- **SaaS owner**: configure credentials and packaging defaults under **Nimbuspost delivery** on the SaaS dashboard; retry failed bookings from the orders table.

## Credentials

In Nimbuspost, generate an **API user** (Settings → API). Store:

- **API user email**
- **API password**

in **Nimbuspost delivery** settings. These are persisted in `tenant_nimbuspost_settings` (RLS: store owner only).

## Edge secrets (optional)

| Secret | Purpose |
|--------|---------|
| `NIMBUSPOST_API_BASE` | Override API base (default `https://api.nimbuspost.com/v1`). |
| `NIMBUSPOST_CREATE_PATH` | Path under base for POST booking (default `shipments`). If Nimbuspost rejects the payload, check their Postman docs and adjust path/body in [`_shared/nimbuspost.ts`](../supabase/functions/_shared/nimbuspost.ts) and [`_shared/bookNimbuspost.ts`](../supabase/functions/_shared/bookNimbuspost.ts). |
| `NIMBUSPOST_WEBHOOK_SECRET` | If set, [`nimbuspost-webhook`](../supabase/functions/nimbuspost-webhook/index.ts) requires `?secret=<value>` or header `x-nimbus-webhook-secret`. |

## Webhook URL

Register (when Nimbuspost supports it):

`https://<project-ref>.supabase.co/functions/v1/nimbuspost-webhook?secret=<NIMBUSPOST_WEBHOOK_SECRET>`

The handler updates `order_carrier_shipments` by **AWB** when the JSON body includes a recognizable `awb` field.

## Deploying functions

Deploy these functions to Supabase:

- `book-nimbuspost-orders`
- `nimbuspost-webhook`

 along with existing functions. Apply migration `20260531120000_nimbuspost_carrier.sql`.

## Testing

1. Save Nimbuspost settings and enable booking.
2. Place a storefront order (prepaid or postpaid).
3. In SaaS → Orders, confirm **Delivery** shows AWB or an error message you can use to fix the payload/path against Nimbuspost’s live API docs.
