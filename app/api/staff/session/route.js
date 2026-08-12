import { db, isConfigured } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { clampInt, jsonError } from '@/lib/helpers';
import { STARTER_RECIPES, starterEquivalent, starterSizes } from '@/lib/starter';

async function createStarterOrders(supabase, session, storeId, sizes) {
  const names = [...new Set(sizes.flatMap((size) => STARTER_RECIPES[size].map(([name]) => name)))];
  const { data: menu, error } = await supabase.from('menu_items').select('id,name').eq('store_id', storeId).in('name', names);
  if (error) throw error;
  const byName = new Map((menu || []).map((m) => [m.name, m]));
  for (const size of sizes) {
    const { data: order, error: orderError } = await supabase.from('orders').insert({ session_id: session.id, station: 'meat', source: 'starter', round_no: 0, label: `HANOK STARTER – ${size}P` }).select('id').single();
    if (orderError) throw orderError;
    const items = STARTER_RECIPES[size].map(([name, qty]) => ({ order_id: order.id, menu_item_id: byName.get(name)?.id || null, item_name: name, qty }));
    const { error: itemsError } = await supabase.from('order_items').insert(items);
    if (itemsError) throw itemsError;
  }
}

export async function POST(request) {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503);
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'start') return jsonError('Unsupported action.');
  const tableId = String(body.table_id || '');
  if (!tableId) return jsonError('Missing table.');
  const adults = clampInt(body.adults, 0, 30);
  const children_8_12 = clampInt(body.children_8_12, 0, 30);
  const children_4_7 = clampInt(body.children_4_7, 0, 30);
  const under_4 = clampInt(body.under_4, 0, 30);
  const total = adults + children_8_12 + children_4_7 + under_4;
  if (total < 1) return jsonError('Guest count must be at least 1.');
  const supabase = db();
  const { data: table, error: tableError } = await supabase.from('dining_tables').select('id,name,store_id,stores(*)').eq('id', tableId).single();
  if (tableError || !table) return jsonError(tableError?.message || 'Table not found.', 404);
  const now = new Date();
  const store = table.stores;
  const ends = new Date(now.getTime() + store.dining_minutes * 60_000);
  const lastOrder = new Date(ends.getTime() - store.last_order_minutes * 60_000);
  const meatAvailable = new Date(now.getTime() + store.meat_cooldown_minutes * 60_000);
  const equivalent = starterEquivalent({ adults, children_8_12, children_4_7 });
  const sizes = starterSizes(equivalent);
  const { data: session, error: sessionError } = await supabase.from('table_sessions').insert({ table_id: table.id, adults, children_8_12, children_4_7, under_4, starter_equivalent: equivalent, started_at: now.toISOString(), ends_at: ends.toISOString(), last_order_at: lastOrder.toISOString(), meat_order_available_at: meatAvailable.toISOString(), hot_order_available_at: now.toISOString(), created_by: role }).select('*').single();
  if (sessionError) return jsonError(sessionError.message, 409);
  try { await createStarterOrders(supabase, session, table.store_id, sizes); }
  catch (error) { await supabase.from('table_sessions').delete().eq('id', session.id); return jsonError(`Starter platter could not be created: ${error.message}`, 500); }
  await supabase.from('audit_logs').insert({ store_id: table.store_id, session_id: session.id, actor: role, action: 'session_started', metadata: { table: table.name, guests: total, starter_sizes: sizes } });
  return Response.json({ ok: true, session, starter_sizes: sizes });
}

export async function PATCH(request) {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const sessionId = String(body.session_id || '');
  if (!sessionId) return jsonError('Missing session.');
  const supabase = db();
  const { data: session, error } = await supabase.from('table_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) return jsonError(error?.message || 'Session not found.', 404);
  if (['extend', 'unlock', 'edit_guests', 'move'].includes(action) && role !== 'manager') return jsonError('Manager PIN required for this action.', 403);
  if (action === 'extend') {
    const minutes = clampInt(body.minutes, 1, 30);
    const ends = new Date(new Date(session.ends_at).getTime() + minutes * 60_000);
    const lastOrder = new Date(new Date(session.last_order_at).getTime() + minutes * 60_000);
    const { error: updateError } = await supabase.from('table_sessions').update({ ends_at: ends.toISOString(), last_order_at: lastOrder.toISOString() }).eq('id', sessionId);
    if (updateError) return jsonError(updateError.message, 500);
    return Response.json({ ok: true });
  }
  if (action === 'unlock') {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from('table_sessions').update({ meat_order_available_at: now, hot_order_available_at: now }).eq('id', sessionId);
    if (updateError) return jsonError(updateError.message, 500);
    return Response.json({ ok: true });
  }
  if (action === 'edit_guests') {
    const adults = clampInt(body.adults, 0, 30), children_8_12 = clampInt(body.children_8_12, 0, 30), children_4_7 = clampInt(body.children_4_7, 0, 30), under_4 = clampInt(body.under_4, 0, 30);
    const equivalent = starterEquivalent({ adults, children_8_12, children_4_7 });
    const { error: updateError } = await supabase.from('table_sessions').update({ adults, children_8_12, children_4_7, under_4, starter_equivalent: equivalent }).eq('id', sessionId);
    if (updateError) return jsonError(updateError.message, 500);
    return Response.json({ ok: true });
  }
  if (action === 'move') {
    const tableId = String(body.table_id || ''); if (!tableId) return jsonError('Missing destination table.');
    const { error: updateError } = await supabase.from('table_sessions').update({ table_id: tableId }).eq('id', sessionId);
    if (updateError) return jsonError(updateError.message, 409);
    return Response.json({ ok: true });
  }
  if (action === 'close') {
    const { error: updateError } = await supabase.from('table_sessions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', sessionId);
    if (updateError) return jsonError(updateError.message, 500);
    return Response.json({ ok: true });
  }
  return jsonError('Unsupported action.');
}
