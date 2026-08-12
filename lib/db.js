import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pycuztuyrhdkqlepbinh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GM3A4rh1URAiVcUopu3yuw_JlMbbC3A';

let cached;

export function db() {
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isConfigured() {
  return true;
}
