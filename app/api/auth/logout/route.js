import { clearRoleCookie } from '@/lib/auth';

export async function POST() {
  await clearRoleCookie();
  return Response.json({ ok: true });
}
