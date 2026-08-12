import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  try {
    const { data, error } = await db().rpc('manager_get_menu', { p_secret: token });
    if (error) return jsonError(error.message, 500);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Unable to load menu.', 503);
  }
}

export async function POST(request) {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  if (!['add','update','disable','enable'].includes(action)) return jsonError('Unsupported menu action.');
  try {
    const { data, error } = await db().rpc('manager_menu_action', {
      p_secret: token,
      p_action: action,
      p_item_id: body.item_id || null,
      p_payload: body.payload || {},
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Menu update failed.', 503);
  }
}
