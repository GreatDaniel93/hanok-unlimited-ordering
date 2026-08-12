import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const items = Array.isArray(body.items) ? body.items : [];
  if (!token || !items.length) return jsonError('Missing table token or order items.');
  const cleanItems = items.map((x) => ({ menu_item_id: String(x.menu_item_id || ''), qty: Number.parseInt(x.qty, 10) })).filter((x) => x.menu_item_id && Number.isFinite(x.qty) && x.qty > 0);
  if (!cleanItems.length) return jsonError('Your order is empty.');
  try {
    const { data, error } = await db().rpc('submit_customer_order', { p_table_token: token, p_items: cleanItems });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message, 503);
  }
}
