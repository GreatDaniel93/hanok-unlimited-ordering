import { db, isConfigured } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(request) {
  const role = await requireRole(['kitchen', 'staff', 'manager']);
  if (!role) return jsonError('Kitchen login required.', 401);
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503);
  const station = new URL(request.url).searchParams.get('station');
  if (!['meat', 'hot'].includes(station)) return jsonError('Invalid station.');
  const supabase = db();
  const { data: orders, error } = await supabase.from('orders').select('id,session_id,station,source,label,round_no,status,printed_at,created_at,order_items(item_name,qty,notes)').eq('station', station).in('status', ['new', 'preparing', 'ready']).order('created_at', { ascending: true }).limit(80);
  if (error) return jsonError(error.message, 500);
  const sessionIds = [...new Set((orders || []).map((o) => o.session_id))];
  let sessions = [];
  if (sessionIds.length) { const { data } = await supabase.from('table_sessions').select('id,table_id').in('id', sessionIds); sessions = data || []; }
  const tableIds = [...new Set(sessions.map((s) => s.table_id))];
  let tables = [];
  if (tableIds.length) { const { data } = await supabase.from('dining_tables').select('id,name').in('id', tableIds); tables = data || []; }
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  return Response.json({ ok: true, role, orders: (orders || []).map((o) => { const s = sessionMap.get(o.session_id); return { ...o, table_name: tableMap.get(s?.table_id)?.name || '?' }; }) });
}

export async function PATCH(request) {
  const role = await requireRole(['kitchen', 'staff', 'manager']);
  if (!role) return jsonError('Kitchen login required.', 401);
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.order_id || ''); const action = String(body.action || '');
  if (!orderId) return jsonError('Missing order.');
  const supabase = db();
  if (action === 'status') {
    const status = String(body.status || '');
    if (!['new', 'preparing', 'ready', 'picked_up'].includes(status)) return jsonError('Invalid status.');
    const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (error) return jsonError(error.message, 500);
    return Response.json({ ok: true });
  }
  if (action === 'reprint') {
    const { error } = await supabase.from('orders').update({ printed_at: null, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (error) return jsonError(error.message, 500);
    return Response.json({ ok: true });
  }
  return jsonError('Unsupported action.');
}
