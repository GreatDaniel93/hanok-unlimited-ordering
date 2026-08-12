import { roleForPin, setRoleCookie } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const role = roleForPin(String(body.pin || ''));
  if (!role) return jsonError('Invalid PIN.', 401);
  await setRoleCookie(role);
  return Response.json({ ok: true, role });
}
