# UCMP

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-9ddn2vwz)

## Local setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply migrations (`supabase db push` or SQL editor).
3. **Optional primary admin:** For `ruraltechstore@gmail.com`, set Supabase Edge Function secrets `PRIMARY_ADMIN_EMAIL` (optional override) and **`PRIMARY_ADMIN_PASSWORD`**, then invoke the **`seed-demo`** function once. The function upserts this user as `ADMIN` with wallet row (idempotent). Do not commit passwords to git.
4. **Demo data:** With an empty project (no `demo.affiliate@ucmp.in` profile), `seed-demo` also creates demo users, products, a SaaS tenant, and **`tenant_products`** links so the marketplace is populated.

### Razorpay (storefront + SaaS platform dues)

1. Apply migrations (includes checkout sessions, webhook idempotency, and order RLS so buyers cannot self-mark prepaid storefront orders paid).
2. Deploy Edge Functions: `create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`, `create-razorpay-saas-due-order`, `verify-razorpay-saas-due-payment`.
3. Set **Edge secrets**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and ensure `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are available to functions (per Supabase docs for your project).
4. In Razorpay Dashboard, add a **webhook** to  
   `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`  
   and enable at least `payment.captured`, `payment.authorized`, and `payment.failed`.
5. Storefront **prepaid** checkout uses Razorpay after `create-razorpay-order`; **postpaid/COD** still creates pending orders from the app. Never put `RAZORPAY_KEY_SECRET` in Vite. The Checkout `key_id` is returned from `create-razorpay-order` / SaaS due create.

### Nimbuspost (store delivery)

1. Apply migration `20260531120000_nimbuspost_carrier.sql`.
2. Deploy Edge Functions: **`book-nimbuspost-orders`**, **`nimbuspost-webhook`** (optional; for tracking callbacks).
3. SaaS owners configure API user email/password and optional **warehouse id** in the dashboard (**Nimbuspost delivery**).
4. See **[docs/NIMBUSPOST.md](docs/NIMBUSPOST.md)** for env vars, webhook URL, and aligning the booking payload with Nimbuspost’s current API.

### Marketplace payouts (MVP)

Settlements to vendors, affiliates, and tenants can stay **ledger-only** using **`wallets`** / **`transactions`** while all customer funds land in the platform Razorpay balance; use manual payouts or a future Razorpay Route / splits design when you need automated splits.

### Demo logins (after seed)

| Role       | Email                   | Password   |
| ---------- | ----------------------- | ---------- |
| Admin      | demo.admin@ucmp.in     | demo123456 |
| Customer   | demo.customer@ucmp.in   | demo123456 |
| (others)   | demo.affiliate@ucmp.in | demo123456 |

Primary admin email (after bootstrap above): **ruraltechstore@gmail.com** — use the password you set in Supabase Auth / `PRIMARY_ADMIN_PASSWORD`.

## Storage

Buckets **`product-media`** (vendor uploads under `{userId}/…`) and **`store-assets`** (store logo under `{tenantId}/…`) are created by migration. Public read is enabled for storefront URLs.
