import { db, isConfigured } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

function authorized(request) {
  const expected = process.env.PRINT_AGENT_SECRET;
  return expected && request.headers.get('x-print-secret') === expected;
}
async function decorate(orders, supabase) {
  const sessionIds = [...new Set(orders.map((o) => o.session_id))];
  const { data: sessions } = sessionIds.length ? await supabase.from('table_sessions').select('id,table_id').in('id', sessionIds) : { data: [] };
  const tableIds = [...new Set((sessions || []).map((s) => s.table_id))];
  const { data: tables } = tableIds.length ? await supabase.from('dining_tables').select('id,name').in('id', tableIds) : { data: [] };
  const sMap = new Map((sessions || []).map((s) => [s.id, s])); const tMap = new Map((tables || []).map((t) => [t.id, t]));
  return orders.map((o) => ({ ...o, table_name: tMap.get(sMap.get(o.session_id)?.table_id)?.name || '?' }));
}
export async function GET(request) {
  if (!authorized(request)) return jsonError('Unauthorized.', 401);
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503);
  const supabase = db();
  const { data, error } = await supabase.from('orders').select('id,session_id,station,source,label,round_no,status,created_at,order_items(item_name,qty,notes)').is('printed_at', null).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(25);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true, orders: await decorate(data || [], supabase) });
}
export async function PATCH(request) {
  if (!authorized(request)) return jsonError('Unauthorized.', 401);
  const body = await request.json().catch(() => ({})); const orderId = String(body.order_id || ''); const printed = Boolean(body.printed);
  if (!orderId) return jsonError('Missing order.');
  const supabase = db();
  const changes = printed ? { printed_at: new Date().toISOString(), print_attempts: (Number(body.attempts) || 1), updated_at: new Date().toISOString() } : { print_attempts: (Number(body.attempts) || 1), updated_at: new Date().toISOString() };
  const { error } = await supabase.from('orders').update(changes).eq('id', orderId);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true });
}
