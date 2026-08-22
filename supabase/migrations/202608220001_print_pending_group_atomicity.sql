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

  with eligible as (
    select o.*, t.name as table_name
    from public.orders o
    join public.table_sessions s on s.id=o.session_id
    join public.dining_tables t on t.id=s.table_id
    where o.printed_at is null
      and o.status <> 'cancelled'
      and (p_since is null or o.created_at >= p_since)
      and (p_station is null or o.station = p_station)
  ), picked_groups as (
    select session_id,
           coalesce(source,'') as source_key,
           coalesce(round_no,0) as round_key,
           coalesce(label,'') as label_key,
           min(created_at) as first_created
    from eligible
    group by session_id, coalesce(source,''), coalesce(round_no,0), coalesce(label,'')
    order by min(created_at) asc
    limit 25
  ), picked as (
    select e.*
    from eligible e
    join picked_groups g
      on g.session_id=e.session_id
     and g.source_key=coalesce(e.source,'')
     and g.round_key=coalesce(e.round_no,0)
     and g.label_key=coalesce(e.label,'')
    order by e.created_at asc, e.id asc
  )
  select coalesce(jsonb_agg(obj order by created_at asc),'[]'::jsonb)
    into v_orders
  from (
    select p.created_at,
      jsonb_build_object(
        'id',p.id,'session_id',p.session_id,'station',p.station,'source',p.source,
        'label',p.label,'round_no',p.round_no,'status',p.status,'created_at',p.created_at,
        'table_name',p.table_name,
        'order_items',coalesce((
          select jsonb_agg(jsonb_build_object('item_name',oi.item_name,'qty',oi.qty,'notes',oi.notes) order by oi.id)
          from public.order_items oi where oi.order_id=p.id
        ),'[]'::jsonb)
      ) obj
    from picked p
  ) q;

  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$$;
