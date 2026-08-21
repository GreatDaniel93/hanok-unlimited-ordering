create or replace function public.manager_opening_check(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_print jsonb;
  v_active_tables integer := 0;
  v_active_meat integer := 0;
  v_active_hot integer := 0;
  v_bridge_ok boolean := false;
  v_total_ok boolean := false;
  v_split_ok boolean := false;
  v_queue_ok boolean := false;
  v_tables_ok boolean := false;
  v_menu_ok boolean := false;
  v_ready boolean := false;
begin
  v_role := public.access_role(p_secret);
  if v_role is distinct from 'manager' then
    raise exception 'Manager access required';
  end if;

  -- Reuse the live print-chain health calculation so readiness and dashboard stay aligned.
  v_print := public.manager_get_bridge_status(p_secret);

  select count(*)::integer into v_active_tables
  from public.dining_tables
  where active = true;

  select count(*) filter (where station='meat')::integer,
         count(*) filter (where station='hot')::integer
    into v_active_meat, v_active_hot
  from public.menu_items
  where active = true;

  v_bridge_ok := coalesce((v_print->>'online')::boolean,false);
  v_total_ok := coalesce((v_print->>'total_printer_online')::boolean,false);
  v_split_ok := coalesce((v_print->>'split_printer_online')::boolean,false);
  v_queue_ok := coalesce(v_print->>'queue_state','critical') = 'healthy';
  v_tables_ok := v_active_tables > 0;
  v_menu_ok := v_active_meat > 0 and v_active_hot > 0;

  v_ready := v_bridge_ok and v_total_ok and v_split_ok and v_queue_ok and v_tables_ok and v_menu_ok;

  return jsonb_build_object(
    'ok', true,
    'ready', v_ready,
    'checked_at', now(),
    'checks', jsonb_build_array(
      jsonb_build_object('key','cloud_db','label','Cloud & Database','ok',true,'detail','Manager API and database responded successfully.'),
      jsonb_build_object('key','bridge','label','Android Bridge','ok',v_bridge_ok,'detail',case when v_bridge_ok then 'Bridge heartbeat is current.' else 'Bridge heartbeat is missing or stale.' end),
      jsonb_build_object('key','total_printer','label','Total Printer','ok',v_total_ok,'detail',case when v_total_ok then 'TOTAL ORDER printer is reachable on the store LAN.' else 'TOTAL ORDER printer is not currently reachable.' end),
      jsonb_build_object('key','split_printer','label','Split Printer','ok',v_split_ok,'detail',case when v_split_ok then 'SPLIT ORDER printer is reachable on the store LAN.' else 'SPLIT ORDER printer is not currently reachable.' end),
      jsonb_build_object('key','print_queue','label','Print Queue','ok',v_queue_ok,'detail',format('%s pending · oldest %ss',coalesce(v_print->>'pending_print_orders','0'),coalesce(v_print->>'oldest_pending_seconds','0'))),
      jsonb_build_object('key','tables','label','Dining Tables','ok',v_tables_ok,'detail',format('%s active table QR target(s) available.',v_active_tables)),
      jsonb_build_object('key','menu','label','Ordering Menu','ok',v_menu_ok,'detail',format('%s active meat item(s) · %s active hot item(s).',v_active_meat,v_active_hot))
    ),
    'print_status', v_print,
    'active_tables', v_active_tables,
    'active_meat_items', v_active_meat,
    'active_hot_items', v_active_hot
  );
end;
$$;
