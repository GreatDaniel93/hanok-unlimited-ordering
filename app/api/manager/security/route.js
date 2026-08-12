import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(request) {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  const targetRole = String(body.role || '');
  const newPin = String(body.new_pin || '').trim();
  if (!['staff','kitchen'].includes(targetRole)) return jsonError('Only Staff and Kitchen PINs can be changed here.');
  if (!/^\d{4,8}$/.test(newPin)) return jsonError('PIN must be 4 to 8 digits.');
  try {
    const { data, error } = await db().rpc('manager_change_role_pin', {
      p_secret: token,
      p_role: targetRole,
      p_new_pin: newPin,
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Unable to change PIN.', 503);
  }
}
