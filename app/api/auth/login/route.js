import { loginWithPin } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  try {
    const role = await loginWithPin(String(body.pin || ''));
    return Response.json({ ok: true, role });
  } catch (error) {
    return jsonError(error.message || 'Invalid PIN.', 401);
  }
}
