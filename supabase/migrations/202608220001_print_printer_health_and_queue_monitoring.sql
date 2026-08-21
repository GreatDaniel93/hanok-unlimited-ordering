alter table public.print_bridge_heartbeats
  add column if not exists total_printer_online boolean,
  add column if not exists split_printer_online boolean,
  add column if not exists total_printer_checked_at timestamptz,
  add column if not exists split_printer_checked_at timestamptz,
  add column if not exists total_printer_latency_ms integer,
  add column if not exists split_printer_latency_ms integer;

create or replace function public.print_report_health(
  p_secret text,
  p_total_online boolean,
  p_split_online boolean,
  p_total_latency_ms integer default null,
  p_split_latency_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.print_secret_valid(p_secret) then
    raise exception 'Unauthorized.';
  end if;

  insert into public.print_bridge_heartbeats(
    bridge_id,last_seen_at,
    total_printer_online,split_printer_online,
    total_printer_checked_at,split_printer_checked_at,
    total_printer_latency_ms,split_printer_latency_ms
  )
  values (
    'wagga-main',now(),
    p_total_online,p_split_online,
    now(),now(),
    greatest(0,coalesce(p_total_latency_ms,0)),
    greatest(0,coalesce(p_split_latency_ms,0))
  )
  on conflict (bridge_id) do update set
    last_seen_at=excluded.last_seen_at,
    total_printer_online=excluded.total_printer_online,
    split_printer_online=excluded.split_printer_online,
    total_printer_checked_at=excluded.total_printer_checked_at,
    split_printer_checked_at=excluded.split_printer_checked_at,
    total_printer_latency_ms=excluded.total_printer_latency_ms,
    split_printer_latency_ms=excluded.split_printer_latency_ms;

  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.manager_get_bridge_status(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_last timestamptz;
  v_seconds integer;
  v_total boolean;
  v_split boolean;
  v_total_checked timestamptz;
  v_split_checked timestamptz;
  v_total_latency integer;
  v_split_latency integer;
  v_total_seconds integer;
  v_split_seconds integer;
  v_bridge_online boolean;
  v_pending integer := 0;
  v_oldest_seconds integer := 0;
  v_queue_state text := 'healthy';
begin
  v_role := public.access_role(p_secret);
  if v_role is distinct from 'manager' then
    raise exception 'Manager access required';
  end if;

  select last_seen_at,
         total_printer_online,split_printer_online,
         total_printer_checked_at,split_printer_checked_at,
         total_printer_latency_ms,split_printer_latency_ms
    into v_last,v_total,v_split,v_total_checked,v_split_checked,v_total_latency,v_split_latency
  from public.print_bridge_heartbeats
  where bridge_id='wagga-main';

  if v_last is not null then
    v_seconds := greatest(0,floor(extract(epoch from (now()-v_last)))::integer);
  end if;
  if v_total_checked is not null then
    v_total_seconds := greatest(0,floor(extract(epoch from (now()-v_total_checked)))::integer);
  end if;
  if v_split_checked is not null then
    v_split_seconds := greatest(0,floor(extract(epoch from (now()-v_split_checked)))::integer);
  end if;

  v_bridge_online := (v_last is not null and v_last >= now() - interval '30 seconds');

  select count(*)::integer,
         coalesce(greatest(0,floor(extract(epoch from (now()-min(created_at))))::integer),0)
    into v_pending,v_oldest_seconds
  from public.orders
  where printed_at is null
    and status <> 'cancelled'
    and created_at >= now() - interval '6 hours';

  if v_pending >= 3 or v_oldest_seconds > 60 then
    v_queue_state := 'critical';
  elsif v_pending > 0 and v_oldest_seconds > 30 then
    v_queue_state := 'warning';
  end if;

  return jsonb_build_object(
    'ok',true,
    'bridge_id','wagga-main',
    'online',v_bridge_online,
    'last_seen_at',v_last,
    'seconds_ago',v_seconds,
    'threshold_seconds',30,
    'total_printer_online',(v_bridge_online and coalesce(v_total,false) and v_total_checked >= now()-interval '90 seconds'),
    'split_printer_online',(v_bridge_online and coalesce(v_split,false) and v_split_checked >= now()-interval '90 seconds'),
    'total_printer_reported',v_total,
    'split_printer_reported',v_split,
    'total_printer_checked_at',v_total_checked,
    'split_printer_checked_at',v_split_checked,
    'total_printer_seconds_ago',v_total_seconds,
    'split_printer_seconds_ago',v_split_seconds,
    'total_printer_latency_ms',v_total_latency,
    'split_printer_latency_ms',v_split_latency,
    'printer_threshold_seconds',90,
    'pending_print_orders',v_pending,
    'oldest_pending_seconds',v_oldest_seconds,
    'queue_state',v_queue_state
  );
end;
$$;
