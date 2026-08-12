import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(request) {
  const role = await requireRole(['kitchen','staff','manager']);
  if (!role) return jsonError('Kitchen login required.',401);
  const token = await getAccessToken();
  const station = new URL(request.url).searchParams.get('station');
  if (!['meat','hot'].includes(station)) return jsonError('Invalid station.');
  try {
    const { data, error } = await db().rpc('kitchen_get_orders', { p_secret: token, p_station: station });
    if (error) return jsonError(error.message,500);
    return Response.json({ ...data, role });
  } catch (error) { return jsonError(error.message,503); }
}

export async function PATCH(request) {
  const role = await requireRole(['kitchen','staff','manager']);
  if (!role) return jsonError('Kitchen login required.',401);
  const token = await getAccessToken();
  const body = await request.json().catch(()=>({}));
  try {
    const { data, error } = await db().rpc('kitchen_update_order', {
      p_secret: token,
      p_order_id: String(body.order_id||''),
      p_action: String(body.action||''),
      p_status: body.status ? String(body.status) : null
    });
    if (error) return jsonError(error.message,409);
    return Response.json(data);
  } catch (error) { return jsonError(error.message,503); }
}
