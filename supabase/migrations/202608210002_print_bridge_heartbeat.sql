create table if not exists public.print_bridge_heartbeats (
  bridge_id text primary key,
  last_seen_at timestamptz not null default now()
);

alter table public.print_bridge_heartbeats enable row level security;

create or replace function public.print_get_pending_v2(
  p_secret text,
  p_since timestamptz default null,
  p_station text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orders jsonb;
begin
  if not public.print_secret_valid(p_secret) then
    raise exception 'Unauthorized.';
  end if;
  if p_station is not null and p_station not in ('meat','hot') then
    raise exception 'Invalid station.';
  end if;

  insert into public.print_bridge_heartbeats(bridge_id,last_seen_at)
  values ('wagga-main',now())
  on conflict (bridge_id) do update
    set last_seen_at=excluded.last_seen_at
    where public.print_bridge_heartbeats.last_seen_at < now() - interval '5 seconds';

  select coalesce(jsonb_agg(obj order by created_at asc),'[]'::jsonb)
  into v_orders
  from (
    select o.created_at,
      jsonb_build_object(
        'id',o.id,'session_id',o.session_id,'station',o.station,'source',o.source,
        'label',o.label,'round_no',o.round_no,'status',o.status,'created_at',o.created_at,
        'table_name',t.name,
        'order_items',coalesce((
          select jsonb_agg(jsonb_build_object('item_name',oi.item_name,'qty',oi.qty,'notes',oi.notes) order by oi.id)
          from order_items oi where oi.order_id=o.id
        ),'[]'::jsonb)
      ) obj
    from orders o
    join table_sessions s on s.id=o.session_id
    join dining_tables t on t.id=s.table_id
    where o.printed_at is null
      and o.status<>'cancelled'
      and (p_since is null or o.created_at>=p_since)
      and (p_station is null or o.station=p_station)
    order by o.created_at asc
    limit 25
  ) q;

  return jsonb_build_object('ok',true,'orders',v_orders);
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
begin
  v_role := public.access_role(p_secret);
  if v_role is distinct from 'manager' then
    raise exception 'Manager access required';
  end if;

  select last_seen_at into v_last
  from public.print_bridge_heartbeats
  where bridge_id='wagga-main';

  if v_last is not null then
    v_seconds := greatest(0,floor(extract(epoch from (now()-v_last)))::integer);
  end if;

  return jsonb_build_object(
    'ok',true,
    'bridge_id','wagga-main',
    'online',(v_last is not null and v_last >= now() - interval '30 seconds'),
    'last_seen_at',v_last,
    'seconds_ago',v_seconds,
    'threshold_seconds',30
  );
end;
$$;
