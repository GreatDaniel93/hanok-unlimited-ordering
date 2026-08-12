import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const COOKIE = 'hanok_access';
const LEGACY_COOKIE = 'hanok_staff';

export async function loginWithPin(pin) {
  const { data, error } = await db().rpc('login_with_pin', { p_pin: String(pin || '') });
  if (error) throw new Error(error.message);
  const store = await cookies();
  store.set(COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
  // Clear any legacy cookie left by the first prototype auth system.
  store.set(LEGACY_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return data.role;
}

export async function clearRoleCookie() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  // Server-side session revocation is best-effort. A Supabase/network failure
  // must never prevent the browser cookie from being deleted.
  if (token) {
    try {
      await db().rpc('logout_access_session', { p_token: token });
    } catch {
      // Intentionally ignored; local logout still proceeds below.
    }
  }

  const expired = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
  store.set(COOKIE, '', expired);
  store.set(LEGACY_COOKIE, '', expired);
}

export async function getAccessToken() {
  const store = await cookies();
  return store.get(COOKIE)?.value || null;
}

export async function getRole() {
  const token = await getAccessToken();
  if (!token) return null;
  const { data, error } = await db().rpc('session_role', { p_token: token });
  if (error) return null;
  return data || null;
}

export async function requireRole(allowed) {
  const role = await getRole();
  if (!role || !allowed.includes(role)) return null;
  return role;
}
