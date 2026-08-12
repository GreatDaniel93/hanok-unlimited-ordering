import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'hanok_staff';

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-change-me';
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function roleForPin(pin) {
  if (pin && pin === process.env.MANAGER_PIN) return 'manager';
  if (pin && pin === process.env.STAFF_PIN) return 'staff';
  if (pin && pin === process.env.KITCHEN_PIN) return 'kitchen';
  return null;
}

export async function setRoleCookie(role) {
  const store = await cookies();
  const token = sign({ role, exp: Date.now() + 12 * 60 * 60 * 1000 });
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
}

export async function clearRoleCookie() {
  const store = await cookies();
  store.set(COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getRole() {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value)?.role || null;
}

export async function requireRole(allowed) {
  const role = await getRole();
  if (!role || !allowed.includes(role)) return null;
  return role;
}
