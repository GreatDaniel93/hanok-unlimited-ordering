alter table public.print_bridge_heartbeats add column if not exists device_status jsonb not null default '{}'::jsonb;
alter table public.print_bridge_heartbeats add column if not exists device_reported_at timestamptz;

create or replace function public.print_report_device_health(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.print_secret_valid(p_secret) then
    raise exception 'Unauthorized.';
  end if;

  insert into public.print_bridge_heartbeats(bridge_id,last_seen_at,device_status,device_reported_at)
  values ('wagga-main',now()-interval '1 day',coalesce(p_payload,'{}'::jsonb),now())
  on conflict (bridge_id) do update set
    device_status=excluded.device_status,
    device_reported_at=excluded.device_reported_at;

  return jsonb_build_object('ok',true);
end;
$$;
