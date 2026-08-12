# Required deployment environment

The production/preview Vercel project requires these server-side variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `BACKEND_SECRET`
- `SESSION_SECRET`
- `STAFF_PIN`
- `MANAGER_PIN`
- `KITCHEN_PIN`
- `PRINT_AGENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

Secrets and PIN values must never be committed to this repository.
