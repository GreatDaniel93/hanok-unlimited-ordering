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
    'wagga-main',now()-interval '1 day',
    p_total_online,p_split_online,
    now(),now(),
    greatest(0,coalesce(p_total_latency_ms,0)),
    greatest(0,coalesce(p_split_latency_ms,0))
  )
  on conflict (bridge_id) do update set
    total_printer_online=excluded.total_printer_online,
    split_printer_online=excluded.split_printer_online,
    total_printer_checked_at=excluded.total_printer_checked_at,
    split_printer_checked_at=excluded.split_printer_checked_at,
    total_printer_latency_ms=excluded.total_printer_latency_ms,
    split_printer_latency_ms=excluded.split_printer_latency_ms;

  return jsonb_build_object('ok',true);
end;
$$;
