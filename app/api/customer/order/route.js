import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function POST(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32000) return jsonError('Order request is too large.', 413);

  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const items = Array.isArray(body.items) ? body.items : [];
  if (!token || !items.length) return jsonError('Missing table token or order items.');
  if (items.length > 30) return jsonError('Too many different items in one order.', 413);

  const cleanItems = items
    .map((x) => ({ menu_item_id: String(x.menu_item_id || ''), qty: Number.parseInt(x.qty, 10) }))
    .filter((x) => x.menu_item_id && Number.isFinite(x.qty) && x.qty > 0 && x.qty <= 20);

  if (!cleanItems.length) return jsonError('Your order is empty.');
  if (cleanItems.length !== items.length) return jsonError('One or more order quantities are invalid.');

  try {
    const { data, error } = await db().rpc('submit_customer_order', {
      p_table_token: token,
      p_items: cleanItems,
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return jsonError(error.message, 503);
  }
}
