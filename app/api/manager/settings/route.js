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
  const kind = String(body.kind || 'meat');
  try {
    if (kind === 'lunch') {
      const dining = clampInt(body.lunch_dining_minutes, 30, 120);
      const lastOrder = clampInt(body.lunch_last_order_minutes, 0, 30);
      const cooldown = clampInt(body.lunch_cooldown_minutes, 0, 15);
      const itemsPerGuest = clampInt(body.lunch_items_per_guest, 1, 10);
      const sameItemMax = clampInt(body.lunch_same_item_max, 1, 10);
      if (lastOrder >= dining) return jsonError('Last order must be before the end of the dining session.', 400);
      const { data, error } = await db().rpc('manager_update_lunch_settings', {
        p_secret: token,
        p_lunch_dining_minutes: dining,
        p_lunch_last_order_minutes: lastOrder,
        p_lunch_cooldown_minutes: cooldown,
        p_lunch_items_per_guest: itemsPerGuest,
        p_lunch_same_item_max: sameItemMax,
      });
      if (error) return jsonError(error.message, 409);
      return Response.json(data);
    }

    const minutes = clampInt(body.meat_cooldown_minutes, 0, 15);
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
