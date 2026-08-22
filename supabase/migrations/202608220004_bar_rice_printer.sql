alter table public.menu_items drop constraint if exists menu_items_station_check;
alter table public.menu_items add constraint menu_items_station_check check (station = any (array['meat'::text,'hot'::text,'bar'::text]));
alter table public.orders drop constraint if exists orders_station_check;
alter table public.orders add constraint orders_station_check check (station = any (array['meat'::text,'hot'::text,'bar'::text]));

alter table public.print_bridge_heartbeats
  add column if not exists bar_printer_online boolean,
  add column if not exists bar_printer_checked_at timestamptz,
  add column if not exists bar_printer_latency_ms integer;

create or replace function public.print_report_health_v2(
  p_secret text,p_total_online boolean,p_split_online boolean,p_bar_online boolean,
  p_total_latency_ms integer default null,p_split_latency_ms integer default null,p_bar_latency_ms integer default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.print_secret_valid(p_secret) then raise exception 'Unauthorized.'; end if;
  insert into public.print_bridge_heartbeats(
    bridge_id,last_seen_at,total_printer_online,split_printer_online,bar_printer_online,
    total_printer_checked_at,split_printer_checked_at,bar_printer_checked_at,
    total_printer_latency_ms,split_printer_latency_ms,bar_printer_latency_ms
  ) values (
    'wagga-main',now()-interval '1 day',p_total_online,p_split_online,p_bar_online,now(),now(),now(),
    greatest(0,coalesce(p_total_latency_ms,0)),greatest(0,coalesce(p_split_latency_ms,0)),greatest(0,coalesce(p_bar_latency_ms,0))
  ) on conflict (bridge_id) do update set
    total_printer_online=excluded.total_printer_online,split_printer_online=excluded.split_printer_online,bar_printer_online=excluded.bar_printer_online,
    total_printer_checked_at=excluded.total_printer_checked_at,split_printer_checked_at=excluded.split_printer_checked_at,bar_printer_checked_at=excluded.bar_printer_checked_at,
    total_printer_latency_ms=excluded.total_printer_latency_ms,split_printer_latency_ms=excluded.split_printer_latency_ms,bar_printer_latency_ms=excluded.bar_printer_latency_ms;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.print_get_pending_v2(p_secret text,p_since timestamptz default null,p_station text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_orders jsonb;
begin
  if not public.print_secret_valid(p_secret) then raise exception 'Unauthorized.'; end if;
  if p_station is not null and p_station not in ('meat','hot','bar') then raise exception 'Invalid station.'; end if;
  if p_station is null then
    insert into public.print_bridge_heartbeats(bridge_id,last_seen_at) values('wagga-main',now())
    on conflict (bridge_id) do update set last_seen_at=excluded.last_seen_at
    where public.print_bridge_heartbeats.last_seen_at<now()-interval '5 seconds';
  end if;
  with eligible as (
    select o.*,t.name as table_name from public.orders o
    join public.table_sessions s on s.id=o.session_id join public.dining_tables t on t.id=s.table_id
    where o.printed_at is null and o.status<>'cancelled' and (p_since is null or o.created_at>=p_since)
      and ((p_station is null and o.station in ('meat','hot')) or (p_station is not null and o.station=p_station))
  ), picked_groups as (
    select session_id,coalesce(source,'') source_key,coalesce(round_no,0) round_key,coalesce(label,'') label_key,min(created_at) first_created
    from eligible group by session_id,coalesce(source,''),coalesce(round_no,0),coalesce(label,'') order by min(created_at) asc limit 25
  ), picked as (
    select e.* from eligible e join picked_groups g on g.session_id=e.session_id and g.source_key=coalesce(e.source,'') and g.round_key=coalesce(e.round_no,0) and g.label_key=coalesce(e.label,'') order by e.created_at,e.id
  )
  select coalesce(jsonb_agg(obj order by created_at),'[]'::jsonb) into v_orders from (
    select p.created_at,jsonb_build_object('id',p.id,'session_id',p.session_id,'station',p.station,'source',p.source,'label',p.label,'round_no',p.round_no,'status',p.status,'created_at',p.created_at,'table_name',p.table_name,
      'order_items',coalesce((select jsonb_agg(jsonb_build_object('item_name',oi.item_name,'qty',oi.qty,'notes',oi.notes) order by oi.id) from public.order_items oi where oi.order_id=p.id),'[]'::jsonb)) obj
    from picked p
  ) q;
  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$$;

create or replace function public.manager_menu_action(p_secret text,p_action text,p_item_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_role text; v_store stores%rowtype; v_item menu_items%rowtype; v_name text; v_display text; v_description text; v_category text; v_station text; v_portion text; v_max integer; v_sort integer; v_pork boolean;
begin
  v_role:=public.access_role(p_secret); if v_role<>'manager' then raise exception 'Manager login required.'; end if;
  select * into v_store from stores where slug='wagga-wagga';
  if p_action='add' then
    v_name:=trim(coalesce(p_payload->>'name','')); if v_name='' then raise exception 'Product name is required.'; end if;
    v_display:=nullif(trim(coalesce(p_payload->>'display_name','')),''); v_description:=nullif(trim(coalesce(p_payload->>'description','')),'');
    v_category:=coalesce(p_payload->>'category',''); if v_category not in ('meat','hot','rice_soup') then raise exception 'Invalid category.'; end if;
    v_station:=case when v_category='meat' then 'meat' when v_category='hot' then 'hot' when coalesce(p_payload->>'station','hot')='bar' then 'bar' else 'hot' end;
    v_portion:=nullif(trim(coalesce(p_payload->>'portion_label','')),''); v_max:=greatest(1,least(10,coalesce((p_payload->>'max_per_round')::integer,2))); v_sort:=greatest(0,least(9999,coalesce((p_payload->>'sort_order')::integer,0))); v_pork:=coalesce((p_payload->>'contains_pork')::boolean,false);
    if exists(select 1 from menu_items where store_id=v_store.id and lower(name)=lower(v_name)) then raise exception 'A product with this name already exists.'; end if;
    insert into menu_items(store_id,name,display_name,description,category,station,portion_label,max_per_round,sort_order,active,contains_pork)
    values(v_store.id,v_name,coalesce(v_display,v_name),v_description,v_category,v_station,v_portion,v_max,v_sort,true,v_pork) returning * into v_item;
    insert into audit_logs(store_id,actor,action,metadata) values(v_store.id,'manager','menu_add',jsonb_build_object('item_id',v_item.id,'name',v_item.name,'station',v_item.station));
  elsif p_action='update' then
    select * into v_item from menu_items where id=p_item_id and store_id=v_store.id; if not found then raise exception 'Product not found.'; end if;
    v_name:=trim(coalesce(p_payload->>'name',v_item.name)); if v_name='' then raise exception 'Product name is required.'; end if;
    if exists(select 1 from menu_items where store_id=v_store.id and id<>v_item.id and lower(name)=lower(v_name)) then raise exception 'A product with this name already exists.'; end if;
    v_display:=nullif(trim(coalesce(p_payload->>'display_name',coalesce(v_item.display_name,''))),''); v_description:=nullif(trim(coalesce(p_payload->>'description',coalesce(v_item.description,''))),'');
    v_category:=coalesce(p_payload->>'category',v_item.category); if v_category not in ('meat','hot','rice_soup') then raise exception 'Invalid category.'; end if;
    if v_item.category='meat' and v_category<>'meat' and exists(select 1 from starter_recipe_items where menu_item_id=v_item.id) then raise exception 'This product is used in a Starter platter. Remove it from Starter configuration before changing its category.'; end if;
    v_pork:=coalesce((p_payload->>'contains_pork')::boolean,v_item.contains_pork);
    if v_pork=true and exists(select 1 from starter_recipe_items where menu_item_id=v_item.id and recipe_type='no_pork') then raise exception 'This product is used in a No Pork Starter. Remove it from No Pork Starter recipes before marking it as pork.'; end if;
    v_station:=case when v_category='meat' then 'meat' when v_category='hot' then 'hot' when coalesce(p_payload->>'station',v_item.station)='bar' then 'bar' else 'hot' end;
    v_portion:=nullif(trim(coalesce(p_payload->>'portion_label',coalesce(v_item.portion_label,''))),''); v_max:=greatest(1,least(10,coalesce((p_payload->>'max_per_round')::integer,v_item.max_per_round))); v_sort:=greatest(0,least(9999,coalesce((p_payload->>'sort_order')::integer,v_item.sort_order)));
    update menu_items set name=v_name,display_name=coalesce(v_display,v_name),description=v_description,category=v_category,station=v_station,portion_label=v_portion,max_per_round=v_max,sort_order=v_sort,contains_pork=v_pork where id=v_item.id returning * into v_item;
    insert into audit_logs(store_id,actor,action,metadata) values(v_store.id,'manager','menu_update',jsonb_build_object('item_id',v_item.id,'name',v_item.name,'station',v_item.station));
  elsif p_action in ('disable','enable') then
    select * into v_item from menu_items where id=p_item_id and store_id=v_store.id; if not found then raise exception 'Product not found.'; end if;
    if p_action='disable' and exists(select 1 from starter_recipe_items where menu_item_id=v_item.id) then raise exception 'This product is used in a Starter platter. Remove it from Starter configuration before hiding it.'; end if;
    update menu_items set active=(p_action='enable') where id=v_item.id returning * into v_item;
    insert into audit_logs(store_id,actor,action,metadata) values(v_store.id,'manager',case when p_action='enable' then 'menu_enable' else 'menu_disable' end,jsonb_build_object('item_id',v_item.id,'name',v_item.name));
  else raise exception 'Unsupported menu action.'; end if;
  return jsonb_build_object('ok',true,'item',jsonb_build_object('id',v_item.id,'name',v_item.name,'display_name',v_item.display_name,'description',v_item.description,'category',v_item.category,'station',v_item.station,'portion_label',v_item.portion_label,'max_per_round',v_item.max_per_round,'sort_order',v_item.sort_order,'active',v_item.active,'contains_pork',v_item.contains_pork));
end;
$$;

create or replace function public.submit_customer_order(p_table_token text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_table dining_tables%rowtype; v_store stores%rowtype; v_session table_sessions%rowtype; v_rec record; v_round integer;
  v_meat_total integer:=0; v_meat_limit integer:=0; v_has_meat boolean:=false; v_has_hot boolean:=false; v_order_id uuid; v_station text;
  v_order_ids jsonb:='[]'::jsonb; v_now timestamptz:=now(); v_valid_count integer:=0; v_input_count integer:=0;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your order is empty.'; end if;
  select * into v_table from dining_tables where token=p_table_token and active=true; if not found then raise exception 'Invalid table QR code.'; end if;
  select * into v_store from stores where id=v_table.store_id;
  select * into v_session from table_sessions where table_id=v_table.id and status='active' for update; if not found then raise exception 'This table does not have an active dining session.'; end if;
  if v_now>=v_session.last_order_at then raise exception 'Last order has closed for this dining session.'; end if;
  v_input_count:=jsonb_array_length(p_items);
  select count(*) into v_valid_count from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid
   where mi.store_id=v_store.id and mi.active=true and coalesce((x->>'qty')::integer,0)>0;
  if v_valid_count<>v_input_count then raise exception 'One or more menu items are invalid or unavailable.'; end if;
  for v_rec in select mi.id,mi.name,mi.category,mi.station,mi.max_per_round,sum((x->>'qty')::integer)::integer qty
    from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid
    where mi.store_id=v_store.id and mi.active=true group by mi.id,mi.name,mi.category,mi.station,mi.max_per_round
  loop
    if v_rec.qty>v_rec.max_per_round then raise exception '% is limited to % portions per round.',v_rec.name,v_rec.max_per_round; end if;
    if v_rec.station='meat' then v_has_meat:=true; v_meat_total:=v_meat_total+v_rec.qty;
    elsif v_rec.station='hot' then v_has_hot:=true; end if;
  end loop;
  if v_session.starter_equivalent<=2 then v_meat_limit:=4; elsif v_session.starter_equivalent<=4 then v_meat_limit:=6; elsif v_session.starter_equivalent<=6 then v_meat_limit:=8; else v_meat_limit:=10; end if;
  if v_has_meat and v_now<v_session.meat_order_available_at then raise exception 'Meat ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_has_hot and v_now<v_session.hot_order_available_at then raise exception 'Hot dish ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_meat_total>v_meat_limit then raise exception 'This table can order up to % meat portions in this round.',v_meat_limit; end if;
  v_round:=v_session.round_count+1;
  for v_station in select distinct mi.station from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid where mi.store_id=v_store.id and mi.active=true
  loop
    insert into orders(session_id,station,source,round_no,label) values(v_session.id,v_station,'customer',v_round,'Customer Order') returning id into v_order_id;
    insert into order_items(order_id,menu_item_id,item_name,qty)
    select v_order_id,mi.id,mi.name,sum((x->>'qty')::integer)::integer from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid
    where mi.store_id=v_store.id and mi.active=true and mi.station=v_station group by mi.id,mi.name;
    v_order_ids:=v_order_ids||jsonb_build_array(v_order_id);
  end loop;
  update table_sessions set round_count=v_round,
    meat_order_available_at=case when v_has_meat then v_now+make_interval(mins=>v_store.meat_cooldown_minutes) else meat_order_available_at end,
    hot_order_available_at=case when v_has_hot then v_now+make_interval(mins=>v_store.hot_cooldown_minutes) else hot_order_available_at end
  where id=v_session.id;
  return jsonb_build_object('ok',true,'round',v_round,'order_ids',v_order_ids,'meat_limit',v_meat_limit,
    'meat_available_at',case when v_has_meat then v_now+make_interval(mins=>v_store.meat_cooldown_minutes) else v_session.meat_order_available_at end,
    'hot_available_at',case when v_has_hot then v_now+make_interval(mins=>v_store.hot_cooldown_minutes) else v_session.hot_order_available_at end);
end;
$$;

insert into public.menu_items(store_id,name,display_name,description,category,station,portion_label,max_per_round,sort_order,active,contains_pork)
select id,'Steamed Rice','Steamed Rice','Fresh steamed rice','rice_soup','bar','1 bowl',10,300,true,false from public.stores where slug='wagga-wagga'
on conflict (store_id,name) do update set display_name=excluded.display_name,description=excluded.description,category='rice_soup',station='bar',portion_label='1 bowl',max_per_round=10,sort_order=300,active=true;
