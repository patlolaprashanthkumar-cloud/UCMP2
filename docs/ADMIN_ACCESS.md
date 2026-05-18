# Platform admin access

UCMP does not ship hard-coded admin passwords in the app or repository.

## Primary admin account

The **seed-demo** edge function ensures a primary platform admin exists (or updates their password) using Supabase **secrets** / environment variables:

| Variable | Purpose |
|----------|---------|
| `PRIMARY_ADMIN_EMAIL` | Admin login email (default in code: `ruraltechstore@gmail.com` if unset) |
| `PRIMARY_ADMIN_PASSWORD` | **Required** to create the admin user the first time; also used to update password when set |
| `PRIMARY_ADMIN_NAME` | Display name (optional) |

Configure these in your Supabase project (**Edge Function secrets** or local env when running `seed-demo`). **Never commit real passwords** to git.

After deployment, sign in at `/login` with the configured email and password.

## Demo quick-login

One-click demo role login has been removed from the UI. Use normal email/password authentication only.
