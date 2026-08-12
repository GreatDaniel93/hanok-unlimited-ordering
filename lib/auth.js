import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const COOKIE = 'hanok_access';

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
  return data.role;
}

export async function clearRoleCookie() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db().rpc('logout_access_session', { p_token: token }).catch(() => null);
  store.set(COOKIE, '', { path: '/', maxAge: 0 });
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
