import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return jsonError('Missing table token.');
  try {
    const { data, error } = await db().rpc('get_customer_context', { p_table_token: token });
    if (error) return jsonError(error.message, 404);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message, 503, { setup: true });
  }
}
