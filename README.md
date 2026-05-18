# UCMP

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-9ddn2vwz)

## Local setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply migrations (`supabase db push` or SQL editor).
3. **Optional primary admin:** For `ruraltechstore@gmail.com`, set Supabase Edge Function secrets `PRIMARY_ADMIN_EMAIL` (optional override) and **`PRIMARY_ADMIN_PASSWORD`**, then invoke the **`seed-demo`** function once. The function upserts this user as `ADMIN` with wallet row (idempotent). Do not commit passwords to git.
4. **Demo data:** With an empty project (no `demo.affiliate@ucmp.in` profile), `seed-demo` also creates demo users, products, a SaaS tenant, and **`tenant_products`** links so the marketplace is populated.

### Demo logins (after seed)

| Role       | Email                   | Password   |
| ---------- | ----------------------- | ---------- |
| Admin      | demo.admin@ucmp.in     | demo123456 |
| Customer   | demo.customer@ucmp.in   | demo123456 |
| (others)   | demo.affiliate@ucmp.in | demo123456 |

Primary admin email (after bootstrap above): **ruraltechstore@gmail.com** — use the password you set in Supabase Auth / `PRIMARY_ADMIN_PASSWORD`.

## Storage

Buckets **`product-media`** (vendor uploads under `{userId}/…`) and **`store-assets`** (store logo under `{tenantId}/…`) are created by migration. Public read is enabled for storefront URLs.
