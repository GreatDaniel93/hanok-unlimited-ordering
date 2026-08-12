import { createClient } from '@supabase/supabase-js';

let cached;

export function db() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are not configured.');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export function backendSecret() {
  const secret = process.env.BACKEND_SECRET;
  if (!secret) throw new Error('Backend secret is not configured.');
  return secret;
}

export function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.BACKEND_SECRET);
}
