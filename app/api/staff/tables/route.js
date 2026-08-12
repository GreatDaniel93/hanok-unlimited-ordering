import { db, backendSecret } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  try {
    const { data, error } = await db().rpc('staff_get_tables', { p_secret: backendSecret() });
    if (error) return jsonError(error.message, 500);
    return Response.json({ ...data, role });
  } catch (error) {
    return jsonError(error.message, 503, { setup: true });
  }
}
