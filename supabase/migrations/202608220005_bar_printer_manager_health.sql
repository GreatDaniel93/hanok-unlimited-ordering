create or replace function public.manager_get_bridge_status(p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_role text; v_last timestamptz; v_seconds integer;
  v_total boolean; v_split boolean; v_bar boolean;
  v_total_checked timestamptz; v_split_checked timestamptz; v_bar_checked timestamptz;
  v_total_latency integer; v_split_latency integer; v_bar_latency integer;
  v_total_seconds integer; v_split_seconds integer; v_bar_seconds integer;
  v_bridge_online boolean; v_pending integer:=0; v_oldest_seconds integer:=0; v_queue_state text:='healthy';
  v_device jsonb:='{}'::jsonb; v_device_at timestamptz; v_device_seconds integer;
begin
  v_role:=public.access_role(p_secret); if v_role is distinct from 'manager' then raise exception 'Manager access required'; end if;
  select last_seen_at,total_printer_online,split_printer_online,bar_printer_online,
         total_printer_checked_at,split_printer_checked_at,bar_printer_checked_at,
         total_printer_latency_ms,split_printer_latency_ms,bar_printer_latency_ms,device_status,device_reported_at
    into v_last,v_total,v_split,v_bar,v_total_checked,v_split_checked,v_bar_checked,v_total_latency,v_split_latency,v_bar_latency,v_device,v_device_at
  from public.print_bridge_heartbeats where bridge_id='wagga-main';
  if v_last is not null then v_seconds:=greatest(0,floor(extract(epoch from (now()-v_last)))::integer); end if;
  if v_total_checked is not null then v_total_seconds:=greatest(0,floor(extract(epoch from (now()-v_total_checked)))::integer); end if;
  if v_split_checked is not null then v_split_seconds:=greatest(0,floor(extract(epoch from (now()-v_split_checked)))::integer); end if;
  if v_bar_checked is not null then v_bar_seconds:=greatest(0,floor(extract(epoch from (now()-v_bar_checked)))::integer); end if;
  if v_device_at is not null then v_device_seconds:=greatest(0,floor(extract(epoch from (now()-v_device_at)))::integer); end if;
  v_bridge_online:=(v_last is not null and v_last>=now()-interval '30 seconds');
  select count(*)::integer,coalesce(greatest(0,floor(extract(epoch from (now()-min(created_at))))::integer),0)
    into v_pending,v_oldest_seconds from public.orders where printed_at is null and status<>'cancelled' and created_at>=now()-interval '6 hours';
  if v_pending>=3 or v_oldest_seconds>60 then v_queue_state:='critical'; elsif v_pending>0 and v_oldest_seconds>30 then v_queue_state:='warning'; end if;
  return jsonb_build_object(
    'ok',true,'bridge_id','wagga-main','online',v_bridge_online,'last_seen_at',v_last,'seconds_ago',v_seconds,'threshold_seconds',30,
    'total_printer_online',(v_bridge_online and coalesce(v_total,false) and v_total_checked>=now()-interval '90 seconds'),
    'split_printer_online',(v_bridge_online and coalesce(v_split,false) and v_split_checked>=now()-interval '90 seconds'),
    'bar_printer_online',(v_bridge_online and coalesce(v_bar,false) and v_bar_checked>=now()-interval '90 seconds'),
    'total_printer_reported',v_total,'split_printer_reported',v_split,'bar_printer_reported',v_bar,
    'total_printer_checked_at',v_total_checked,'split_printer_checked_at',v_split_checked,'bar_printer_checked_at',v_bar_checked,
    'total_printer_seconds_ago',v_total_seconds,'split_printer_seconds_ago',v_split_seconds,'bar_printer_seconds_ago',v_bar_seconds,
    'total_printer_latency_ms',v_total_latency,'split_printer_latency_ms',v_split_latency,'bar_printer_latency_ms',v_bar_latency,
    'printer_threshold_seconds',90,'pending_print_orders',v_pending,'oldest_pending_seconds',v_oldest_seconds,'queue_state',v_queue_state,
    'device_status',coalesce(v_device,'{}'::jsonb),'device_reported_at',v_device_at,'device_seconds_ago',v_device_seconds
  );
end;
$$;

create or replace function public.manager_opening_check(p_secret text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_role text; v_print jsonb; v_active_tables integer:=0; v_active_meat integer:=0; v_active_hot integer:=0; v_active_bar integer:=0;
  v_bridge_ok boolean:=false; v_total_ok boolean:=false; v_split_ok boolean:=false; v_bar_ok boolean:=false; v_queue_ok boolean:=false; v_tables_ok boolean:=false; v_menu_ok boolean:=false; v_ready boolean:=false;
begin
  v_role:=public.access_role(p_secret); if v_role is distinct from 'manager' then raise exception 'Manager access required'; end if;
  v_print:=public.manager_get_bridge_status(p_secret);
  select count(*)::integer into v_active_tables from public.dining_tables where active=true;
  select count(*) filter(where station='meat')::integer,count(*) filter(where station='hot')::integer,count(*) filter(where station='bar')::integer
    into v_active_meat,v_active_hot,v_active_bar from public.menu_items where active=true;
  v_bridge_ok:=coalesce((v_print->>'online')::boolean,false); v_total_ok:=coalesce((v_print->>'total_printer_online')::boolean,false);
  v_split_ok:=coalesce((v_print->>'split_printer_online')::boolean,false); v_bar_ok:=coalesce((v_print->>'bar_printer_online')::boolean,false);
  v_queue_ok:=coalesce(v_print->>'queue_state','critical')='healthy'; v_tables_ok:=v_active_tables>0; v_menu_ok:=v_active_meat>0 and v_active_hot>0 and v_active_bar>0;
  v_ready:=v_bridge_ok and v_total_ok and v_split_ok and v_bar_ok and v_queue_ok and v_tables_ok and v_menu_ok;
  return jsonb_build_object('ok',true,'ready',v_ready,'checked_at',now(),'checks',jsonb_build_array(
    jsonb_build_object('key','cloud_db','label','Cloud & Database','ok',true,'detail','Manager API and database responded successfully.'),
    jsonb_build_object('key','bridge','label','Android Bridge','ok',v_bridge_ok,'detail',case when v_bridge_ok then 'Bridge heartbeat is current.' else 'Bridge heartbeat is missing or stale.' end),
    jsonb_build_object('key','total_printer','label','Total Printer','ok',v_total_ok,'detail',case when v_total_ok then 'TOTAL ORDER printer is reachable on the store LAN.' else 'TOTAL ORDER printer is not currently reachable.' end),
    jsonb_build_object('key','split_printer','label','Split Printer','ok',v_split_ok,'detail',case when v_split_ok then 'SPLIT ORDER printer is reachable on the store LAN.' else 'SPLIT ORDER printer is not currently reachable.' end),
    jsonb_build_object('key','bar_printer','label','Bar Rice Printer','ok',v_bar_ok,'detail',case when v_bar_ok then 'BAR RICE printer is reachable on the store LAN.' else 'BAR RICE printer is not currently reachable.' end),
    jsonb_build_object('key','print_queue','label','Print Queue','ok',v_queue_ok,'detail',format('%s pending · oldest %ss',coalesce(v_print->>'pending_print_orders','0'),coalesce(v_print->>'oldest_pending_seconds','0'))),
    jsonb_build_object('key','tables','label','Dining Tables','ok',v_tables_ok,'detail',format('%s active table QR target(s) available.',v_active_tables)),
    jsonb_build_object('key','menu','label','Ordering Menu','ok',v_menu_ok,'detail',format('%s meat · %s hot · %s bar-routed item(s).',v_active_meat,v_active_hot,v_active_bar))
  ),'print_status',v_print,'active_tables',v_active_tables,'active_meat_items',v_active_meat,'active_hot_items',v_active_hot,'active_bar_items',v_active_bar);
end;
$$;
