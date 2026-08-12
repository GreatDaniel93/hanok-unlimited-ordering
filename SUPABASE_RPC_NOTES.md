# Supabase RPC backend

The live `hanokwagga buffet` database has the RPC authorization layer installed. Customer access uses table-token RPCs; staff, kitchen and print access uses a server-only `BACKEND_SECRET` validated by SHA-256 in `backend_config`. Direct table access is protected by RLS.

The full live definitions can be inspected from the Supabase project. The lightweight migration note in `supabase/migrations/002_rpc_backend.sql` records the installed function set.
