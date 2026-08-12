import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { clampInt, jsonError } from '@/lib/helpers';

export async function POST(request) {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'start') return jsonError('Unsupported action.');
  try {
    const { data, error } = await db().rpc('staff_start_session', {
      p_secret: token,
      p_table_id: String(body.table_id || ''),
      p_adults: clampInt(body.adults,0,30),
      p_children_8_12: clampInt(body.children_8_12,0,30),
      p_children_4_7: clampInt(body.children_4_7,0,30),
      p_under_4: clampInt(body.under_4,0,30)
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) { return jsonError(error.message, 503); }
}

export async function PATCH(request) {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  const token = await getAccessToken();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const sessionId = String(body.session_id || '');
  if (!sessionId) return jsonError('Missing session.');
  const payload = action==='extend' ? { minutes: clampInt(body.minutes,1,30) }
    : action==='move' ? { table_id: String(body.table_id||'') }
    : action==='edit_guests' ? { adults: clampInt(body.adults,0,30), children_8_12: clampInt(body.children_8_12,0,30), children_4_7: clampInt(body.children_4_7,0,30), under_4: clampInt(body.under_4,0,30) }
    : {};
  try {
    const { data, error } = await db().rpc('staff_session_action', {
      p_secret: token,
      p_session_id: sessionId,
      p_action: action,
      p_payload: payload
    });
    if (error) return jsonError(error.message, 409);
    return Response.json(data);
  } catch (error) { return jsonError(error.message,503); }
}
