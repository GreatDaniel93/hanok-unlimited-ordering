import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { clampInt, jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  try {
    const { data, error } = await db().rpc('manager_get_order_settings', { p_secret: token });
    if (error) return jsonError(error.message, 500);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Unable to load order settings.', 503);
  }
}

export async function POST(request) {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  const minutes = clampInt(body.meat_cooldown_minutes, 0, 15);
  try {
    const { data, error } = await db().rpc('manager_update_order_settings', {
      p_secret: token,
      p_meat_cooldown_minutes: minutes,
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Order settings update failed.', 503);
  }
}
