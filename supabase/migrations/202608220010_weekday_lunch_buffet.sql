alter table public.table_sessions add column if not exists service_mode text not null default 'bbq';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='table_sessions_service_mode_check' and conrelid='public.table_sessions'::regclass) then
    alter table public.table_sessions add constraint table_sessions_service_mode_check check (service_mode in ('bbq','lunch'));
  end if;
end $$;

create or replace function public.staff_start_session_v3(
  p_secret text,
  p_actor text,
  p_table_id uuid,
  p_adults integer,
  p_children_8_12 integer,
  p_children_4_7 integer,
  p_under_4 integer,
  p_starter_preference text,
  p_service_mode text default 'bbq'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text; v_table dining_tables%rowtype; v_store stores%rowtype; v_session table_sessions%rowtype;
  v_equiv numeric; v_n integer; v_sizes integer[]:='{}'; v_size integer; v_now timestamptz:=now(); v_pref text;
  v_mode text; v_session_minutes integer; v_last_order_minutes integer; v_local_dow integer;
begin
  v_role:=public.access_role(p_secret);
  if v_role not in ('staff','manager') then raise exception 'Unauthorized.'; end if;
  v_mode:=coalesce(nullif(p_service_mode,''),'bbq');
  if v_mode not in ('bbq','lunch') then raise exception 'Invalid service mode.'; end if;
  v_local_dow:=extract(isodow from (v_now at time zone 'Australia/Sydney'))::integer;
  if v_mode='lunch' and v_local_dow>5 and v_role<>'manager' then raise exception 'Weekday Lunch Buffet is available Monday to Friday.'; end if;
  v_pref:=coalesce(nullif(p_starter_preference,''),'standard');
  if v_pref not in ('standard','no_pork') then raise exception 'Invalid Starter preference.'; end if;
  if coalesce(p_adults,0)+coalesce(p_children_8_12,0)+coalesce(p_children_4_7,0)+coalesce(p_under_4,0)<1 then raise exception 'Guest count must be at least 1.'; end if;
  select * into v_table from dining_tables where id=p_table_id and active=true; if not found then raise exception 'Table not found.'; end if;
  if exists(select 1 from table_sessions where table_id=v_table.id and status='active') then raise exception 'This table already has an active dining session.'; end if;
  select * into v_store from stores where id=v_table.store_id;
  v_equiv:=greatest(1,coalesce(p_adults,0)+coalesce(p_children_8_12,0)+coalesce(p_children_4_7,0)*0.5);
  if v_mode='lunch' then
    v_session_minutes:=60; v_last_order_minutes:=10; v_pref:='standard';
  else
    v_session_minutes:=v_store.dining_minutes; v_last_order_minutes:=v_store.last_order_minutes;
    v_n:=greatest(2,ceil(v_equiv)::integer);
    while v_n>6 loop
      if v_n=7 then v_sizes:=v_sizes||array[4,3]; v_n:=0;
      elsif v_n=8 then v_sizes:=v_sizes||array[4,4]; v_n:=0;
      elsif v_n=9 then v_sizes:=v_sizes||array[5,4]; v_n:=0;
      elsif v_n=10 then v_sizes:=v_sizes||array[5,5]; v_n:=0;
      elsif v_n=11 then v_sizes:=v_sizes||array[6,5]; v_n:=0;
      else v_sizes:=v_sizes||6; v_n:=v_n-6; end if;
    end loop;
    if v_n>0 then v_sizes:=v_sizes||greatest(2,v_n); end if;
  end if;
  insert into table_sessions(table_id,adults,children_8_12,children_4_7,under_4,starter_equivalent,starter_preference,service_mode,started_at,ends_at,last_order_at,meat_order_available_at,hot_order_available_at,created_by)
  values(v_table.id,coalesce(p_adults,0),coalesce(p_children_8_12,0),coalesce(p_children_4_7,0),coalesce(p_under_4,0),v_equiv,v_pref,v_mode,v_now,v_now+make_interval(mins=>v_session_minutes),v_now+make_interval(mins=>v_session_minutes-v_last_order_minutes),case when v_mode='lunch' then v_now else v_now+make_interval(mins=>v_store.meat_cooldown_minutes) end,v_now,v_role) returning * into v_session;
  if v_mode='bbq' then foreach v_size in array v_sizes loop perform public.add_starter_order_v2(v_session.id,v_table.store_id,v_size,v_pref); end loop; end if;
  insert into audit_logs(store_id,session_id,actor,action,metadata) values(v_table.store_id,v_session.id,v_role,'session_started',jsonb_build_object('table',v_table.name,'service_mode',v_mode,'session_minutes',v_session_minutes,'last_order_minutes',v_last_order_minutes,'starter_sizes',to_jsonb(v_sizes),'starter_preference',case when v_mode='bbq' then v_pref else null end));
  return jsonb_build_object('ok',true,'session',to_jsonb(v_session),'service_mode',v_mode,'session_minutes',v_session_minutes,'last_order_minutes',v_last_order_minutes,'starter_sizes',to_jsonb(v_sizes),'starter_preference',case when v_mode='bbq' then v_pref else null end);
end;
$$;

create or replace function public.get_customer_context(p_table_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_table dining_tables%rowtype; v_store stores%rowtype; v_session table_sessions%rowtype; v_menu jsonb := '[]'::jsonb; v_orders jsonb := '[]'::jsonb;
begin
  select * into v_table from dining_tables where token=p_table_token and active=true; if not found then raise exception 'Invalid table QR code.'; end if;
  select * into v_store from stores where id=v_table.store_id;
  select * into v_session from table_sessions where table_id=v_table.id and status='active' order by created_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'description',description,'category',category,'station',station,'portion_label',portion_label,'max_per_round',max_per_round,'sort_order',sort_order) order by sort_order),'[]'::jsonb)
    into v_menu from menu_items where store_id=v_table.store_id and active=true and (v_session.id is null or v_session.service_mode<>'lunch' or category<>'meat');
  if v_session.id is not null then
    select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb) into v_orders from (
      select o.created_at,jsonb_build_object('id',o.id,'round_no',o.round_no,'station',o.station,'source',o.source,'status',o.status,'created_at',o.created_at,'order_items',coalesce((select jsonb_agg(jsonb_build_object('item_name',oi.item_name,'qty',oi.qty,'notes',oi.notes) order by oi.id) from order_items oi where oi.order_id=o.id),'[]'::jsonb)) obj
      from orders o where o.session_id=v_session.id and o.source='customer' order by o.created_at desc limit 8
    ) x;
  end if;
  return jsonb_build_object('ok',true,'table',jsonb_build_object('id',v_table.id,'name',v_table.name),'store',to_jsonb(v_store),'session',case when v_session.id is null then null else to_jsonb(v_session)||jsonb_build_object('total_guests',v_session.adults+v_session.children_8_12+v_session.children_4_7+v_session.under_4) end,'menu',v_menu,'recent_orders',v_orders);
end;
$$;

create or replace function public.submit_customer_order(p_table_token text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_table dining_tables%rowtype; v_store stores%rowtype; v_session table_sessions%rowtype; v_rec record; v_round integer; v_meat_total integer:=0; v_meat_limit integer:=0; v_has_meat boolean:=false; v_has_hot boolean:=false; v_order_id uuid; v_station text; v_order_ids jsonb:='[]'::jsonb; v_now timestamptz:=now(); v_valid_count integer:=0; v_input_count integer:=0;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your order is empty.'; end if;
  select * into v_table from dining_tables where token=p_table_token and active=true; if not found then raise exception 'Invalid table QR code.'; end if;
  select * into v_store from stores where id=v_table.store_id;
  select * into v_session from table_sessions where table_id=v_table.id and status='active' for update; if not found then raise exception 'This table does not have an active dining session.'; end if;
  if v_now>=v_session.last_order_at then raise exception 'Last order has closed for this dining session.'; end if;
  v_input_count:=jsonb_array_length(p_items);
  select count(*) into v_valid_count from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid where mi.store_id=v_store.id and mi.active=true and coalesce((x->>'qty')::integer,0)>0;
  if v_valid_count<>v_input_count then raise exception 'One or more menu items are invalid or unavailable.'; end if;
  for v_rec in select mi.id,mi.name,mi.category,mi.station,mi.max_per_round,sum((x->>'qty')::integer)::integer qty from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid where mi.store_id=v_store.id and mi.active=true group by mi.id,mi.name,mi.category,mi.station,mi.max_per_round loop
    if v_rec.qty>v_rec.max_per_round then raise exception '% is limited to % portions per round.',v_rec.name,v_rec.max_per_round; end if;
    if v_session.service_mode='lunch' and v_rec.category='meat' then raise exception 'BBQ meat is not included in the Weekday Lunch Buffet.'; end if;
    if v_rec.station='meat' then v_has_meat:=true; v_meat_total:=v_meat_total+v_rec.qty; elsif v_rec.station='hot' then v_has_hot:=true; end if;
  end loop;
  if v_session.starter_equivalent<=2 then v_meat_limit:=4; elsif v_session.starter_equivalent<=4 then v_meat_limit:=6; elsif v_session.starter_equivalent<=6 then v_meat_limit:=8; else v_meat_limit:=10; end if;
  if v_has_meat and v_now<v_session.meat_order_available_at then raise exception 'Meat ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_has_hot and v_now<v_session.hot_order_available_at then raise exception 'Hot dish ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_meat_total>v_meat_limit then raise exception 'This table can order up to % meat portions in this round.',v_meat_limit; end if;
  v_round:=v_session.round_count+1;
  for v_station in select distinct mi.station from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid where mi.store_id=v_store.id and mi.active=true loop
    insert into orders(session_id,station,source,round_no,label) values(v_session.id,v_station,'customer',v_round,case when v_session.service_mode='lunch' then 'Lunch Buffet Order' else 'Customer Order' end) returning id into v_order_id;
    insert into order_items(order_id,menu_item_id,item_name,qty) select v_order_id,mi.id,mi.name,sum((x->>'qty')::integer)::integer from jsonb_array_elements(p_items) x join menu_items mi on mi.id=(x->>'menu_item_id')::uuid where mi.store_id=v_store.id and mi.active=true and mi.station=v_station group by mi.id,mi.name;
    v_order_ids:=v_order_ids||jsonb_build_array(v_order_id);
  end loop;
  update table_sessions set round_count=v_round,meat_order_available_at=case when v_has_meat then v_now+make_interval(mins=>v_store.meat_cooldown_minutes) else meat_order_available_at end,hot_order_available_at=case when v_has_hot then v_now+make_interval(mins=>v_store.hot_cooldown_minutes) else hot_order_available_at end where id=v_session.id;
  return jsonb_build_object('ok',true,'round',v_round,'order_ids',v_order_ids,'service_mode',v_session.service_mode,'meat_limit',case when v_session.service_mode='lunch' then 0 else v_meat_limit end,'meat_available_at',case when v_has_meat then v_now+make_interval(mins=>v_store.meat_cooldown_minutes) else v_session.meat_order_available_at end,'hot_available_at',case when v_has_hot then v_now+make_interval(mins=>v_store.hot_cooldown_minutes) else v_session.hot_order_available_at end);
end;
$$;

create or replace function public.manager_get_analytics_v2(p_secret text, p_from timestamptz, p_to timestamptz, p_service_mode text default 'all')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_store uuid; v_result jsonb; v_mode text;
begin
 if public.access_role(p_secret) <> 'manager' then raise exception 'Manager login required'; end if;
 v_mode:=coalesce(nullif(p_service_mode,''),'all'); if v_mode not in ('all','bbq','lunch') then raise exception 'Invalid service mode'; end if;
 select s.id into v_store from stores s where s.slug='wagga-wagga' limit 1;
 if p_to<=p_from or p_to-p_from>interval '367 days' then raise exception 'Invalid date range'; end if;
 with ss as (
  select ts.*,dt.name table_name,(ts.adults+ts.children_8_12+ts.children_4_7+ts.under_4) guests,extract(epoch from (coalesce(ts.closed_at,least(now(),ts.ends_at))-ts.started_at))/60.0 duration_min
  from table_sessions ts join dining_tables dt on dt.id=ts.table_id where dt.store_id=v_store and ts.started_at>=p_from and ts.started_at<p_to and (v_mode='all' or ts.service_mode=v_mode)
 ), oo as (select o.* from orders o join ss on ss.id=o.session_id), ii as (select oi.*,o.station,o.source,o.session_id from order_items oi join oo o on o.id=oi.order_id),
 table_session_agg as (select table_name,count(*)::int sessions,sum(guests)::int guests,round(avg(duration_min)::numeric,1) avg_duration_min from ss group by table_name),
 table_order_agg as (select s.table_name,count(o.id)::int orders from ss s left join orders o on o.session_id=s.id group by s.table_name),
 daily_session_agg as (select (started_at at time zone 'Australia/Sydney')::date report_date,count(*)::int sessions,sum(guests)::int guests from ss group by (started_at at time zone 'Australia/Sydney')::date),
 daily_order_agg as (select (s.started_at at time zone 'Australia/Sydney')::date report_date,count(o.id)::int orders from ss s left join orders o on o.session_id=s.id group by (s.started_at at time zone 'Australia/Sydney')::date)
 select jsonb_build_object('from',p_from,'to',p_to,'service_mode',v_mode,'kpi',jsonb_build_object('sessions',(select count(*) from ss),'lunch_sessions',(select count(*) from ss where service_mode='lunch'),'bbq_sessions',(select count(*) from ss where service_mode='bbq'),'guests',(select coalesce(sum(guests),0) from ss),'adults',(select coalesce(sum(adults),0) from ss),'children',(select coalesce(sum(children_8_12+children_4_7+under_4),0) from ss),'orders',(select count(*) from oo),'meat_orders',(select count(*) from oo where station='meat'),'hot_orders',(select count(*) from oo where station='hot'),'bar_orders',(select count(*) from oo where station='bar'),'meat_serves',(select coalesce(sum(qty),0) from ii where station='meat'),'starter_meat_serves',(select coalesce(sum(qty),0) from ii where station='meat' and source='starter'),'customer_meat_serves',(select coalesce(sum(qty),0) from ii where station='meat' and source<>'starter'),'hot_serves',(select coalesce(sum(qty),0) from ii where station='hot'),'bar_serves',(select coalesce(sum(qty),0) from ii where station='bar'),'avg_guests_per_table',(select round(coalesce(avg(guests),0),2) from ss),'avg_duration_min',(select round(coalesce(avg(duration_min),0)::numeric,1) from ss),'avg_orders_per_table',(select round(case when count(*)=0 then 0 else (select count(*) from oo)::numeric/count(*) end,2) from ss),'no_pork_sessions',(select count(*) from ss where service_mode='bbq' and starter_preference='no_pork')),
 'products',(select coalesce(jsonb_agg(x order by x.total_serves desc,x.item_name),'[]'::jsonb) from (select ii.item_name,ii.station,sum(ii.qty)::int total_serves,sum(case when ii.source='starter' then ii.qty else 0 end)::int starter_serves,sum(case when ii.source<>'starter' then ii.qty else 0 end)::int customer_serves,case when ii.station='meat' then round(sum(ii.qty)*0.1,1) else null end estimated_kg from ii group by ii.item_name,ii.station) x),
 'tables',(select coalesce(jsonb_agg(jsonb_build_object('table_name',s.table_name,'sessions',s.sessions,'guests',s.guests,'orders',coalesce(o.orders,0),'avg_duration_min',s.avg_duration_min) order by s.sessions desc,s.table_name),'[]'::jsonb) from table_session_agg s left join table_order_agg o using(table_name)),
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('report_date',s.report_date,'sessions',s.sessions,'guests',s.guests,'orders',coalesce(o.orders,0)) order by s.report_date),'[]'::jsonb) from daily_session_agg s left join daily_order_agg o using(report_date)),
 'audit',(select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) from (select action,actor,created_at,metadata from audit_logs where store_id=v_store and created_at>=p_from and created_at<p_to order by created_at desc limit 100) x)) into v_result;
 return v_result;
end $$;
