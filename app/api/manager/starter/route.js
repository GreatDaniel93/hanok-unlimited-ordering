import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  try {
    const { data, error } = await db().rpc('manager_get_starters_v2', { p_secret: token });
    if (error) return jsonError(error.message, 500);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Unable to load Starter configuration.', 503);
  }
}

export async function POST(request) {
  const role = await requireRole(['manager']);
  if (!role) return jsonError('Manager login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  const partySize = Number.parseInt(body.party_size, 10);
  const recipeType = ['standard','no_pork'].includes(body.recipe_type) ? body.recipe_type : 'standard';
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(partySize) || partySize < 2 || partySize > 6) return jsonError('Invalid Starter size.');
  if (!items.length) return jsonError('Starter must contain at least one product.');
  const clean = items.map((x) => ({ menu_item_id: String(x.menu_item_id || ''), qty: Number.parseInt(x.qty, 10) }))
    .filter((x) => x.menu_item_id && Number.isInteger(x.qty) && x.qty > 0 && x.qty <= 10);
  if (clean.length !== items.length) return jsonError('Starter contains invalid quantities.');
  try {
    const { data, error } = await db().rpc('manager_starter_action_v2', {
      p_secret: token,
      p_recipe_type: recipeType,
      p_party_size: partySize,
      p_items: clean,
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || 'Starter update failed.', 503);
  }
}
