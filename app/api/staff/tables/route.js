import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  const token = await getAccessToken();
  try {
    const { data, error } = await db().rpc('staff_get_tables', { p_secret: token });
    if (error) return jsonError(error.message, 500);
    return Response.json({ ...data, role });
  } catch (error) {
    return jsonError(error.message, 503, { setup: true });
  }
}
