import { db, isConfigured } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function GET(request) {
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503, { setup: true });
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return jsonError('Missing table token.');
  const supabase = db();
  const { data: table, error: tableError } = await supabase.from('dining_tables').select('id,name,store_id,stores(id,name,slug,dining_minutes,last_order_minutes,meat_cooldown_minutes,hot_cooldown_minutes)').eq('token', token).eq('active', true).maybeSingle();
  if (tableError) return jsonError(tableError.message, 500);
  if (!table) return jsonError('Invalid table QR code.', 404);
  const { data: session, error: sessionError } = await supabase.from('table_sessions').select('*').eq('table_id', table.id).eq('status', 'active').maybeSingle();
  if (sessionError) return jsonError(sessionError.message, 500);
  const { data: menu, error: menuError } = await supabase.from('menu_items').select('id,name,display_name,description,category,station,portion_label,max_per_round,sort_order').eq('store_id', table.store_id).eq('active', true).order('sort_order');
  if (menuError) return jsonError(menuError.message, 500);
  let recentOrders = [];
  if (session) {
    const { data } = await supabase.from('orders').select('id,round_no,station,source,status,created_at,order_items(item_name,qty)').eq('session_id', session.id).eq('source', 'customer').order('created_at', { ascending: false }).limit(8);
    recentOrders = data || [];
  }
  const totalGuests = session ? session.adults + session.children_8_12 + session.children_4_7 + session.under_4 : 0;
  return Response.json({ ok: true, table: { id: table.id, name: table.name }, store: table.stores, session: session ? { ...session, total_guests: totalGuests } : null, menu: menu || [], recent_orders: recentOrders });
}
