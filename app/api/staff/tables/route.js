import { db, isConfigured } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const role = await requireRole(['staff', 'manager']);
  if (!role) return jsonError('Staff login required.', 401);
  if (!isConfigured()) return jsonError('System setup is incomplete.', 503, { setup: true });
  const supabase = db();
  const { data: store, error: storeError } = await supabase.from('stores').select('*').eq('slug', 'wagga-wagga').single();
  if (storeError) return jsonError(storeError.message, 500);
  const { data: tables, error: tableError } = await supabase.from('dining_tables').select('*').eq('store_id', store.id).eq('active', true).order('name');
  if (tableError) return jsonError(tableError.message, 500);
  const tableIds = (tables || []).map((t) => t.id);
  let sessions = [];
  if (tableIds.length) {
    const { data, error } = await supabase.from('table_sessions').select('*').in('table_id', tableIds).eq('status', 'active');
    if (error) return jsonError(error.message, 500);
    sessions = data || [];
  }
  const sessionByTable = new Map(sessions.map((s) => [s.table_id, s]));
  return Response.json({ ok: true, role, store, tables: (tables || []).map((table) => ({ ...table, session: sessionByTable.get(table.id) || null })) });
}
