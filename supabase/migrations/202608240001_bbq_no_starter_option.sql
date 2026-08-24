alter table public.table_sessions drop constraint if exists table_sessions_starter_preference_check;
alter table public.table_sessions add constraint table_sessions_starter_preference_check check (starter_preference = any (array['standard'::text,'no_pork'::text,'none'::text]));

create or replace function public.staff_start_session_v3(p_secret text, p_actor text, p_table_id uuid, p_adults integer, p_children_8_12 integer, p_children_4_7 integer, p_under_4 integer, p_starter_preference text, p_service_mode text default 'bbq'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if v_pref not in ('standard','no_pork','none') then raise exception 'Invalid Starter preference.'; end if;
  if coalesce(p_adults,0)+coalesce(p_children_8_12,0)+coalesce(p_children_4_7,0)+coalesce(p_under_4,0)<1 then raise exception 'Guest count must be at least 1.'; end if;
  select * into v_table from dining_tables where id=p_table_id and active=true;
  if not found then raise exception 'Table not found.'; end if;
  if exists(select 1 from table_sessions where table_id=v_table.id and status='active') then raise exception 'This table already has an active dining session.'; end if;
  select * into v_store from stores where id=v_table.store_id;
  v_equiv:=greatest(1,coalesce(p_adults,0)+coalesce(p_children_8_12,0)+coalesce(p_children_4_7,0)*0.5);
  if v_mode='lunch' then
    v_session_minutes:=v_store.lunch_dining_minutes;
    v_last_order_minutes:=v_store.lunch_last_order_minutes;
    v_pref:='standard';
  else
    v_session_minutes:=v_store.dining_minutes;
    v_last_order_minutes:=v_store.last_order_minutes;
    if v_pref<>'none' then
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
  end if;
  insert into table_sessions(table_id,adults,children_8_12,children_4_7,under_4,starter_equivalent,starter_preference,service_mode,started_at,ends_at,last_order_at,meat_order_available_at,hot_order_available_at,created_by)
  values(v_table.id,coalesce(p_adults,0),coalesce(p_children_8_12,0),coalesce(p_children_4_7,0),coalesce(p_under_4,0),v_equiv,v_pref,v_mode,v_now,v_now+make_interval(mins=>v_session_minutes),v_now+make_interval(mins=>v_session_minutes-v_last_order_minutes),case when v_mode='lunch' or v_pref='none' then v_now else v_now+make_interval(mins=>v_store.meat_cooldown_minutes) end,v_now,v_role)
  returning * into v_session;
  if v_mode='bbq' and v_pref<>'none' then foreach v_size in array v_sizes loop perform public.add_starter_order_v2(v_session.id,v_table.store_id,v_size,v_pref); end loop; end if;
  insert into audit_logs(store_id,session_id,actor,action,metadata) values(v_table.store_id,v_session.id,v_role,'session_started',jsonb_build_object('table',v_table.name,'service_mode',v_mode,'session_minutes',v_session_minutes,'last_order_minutes',v_last_order_minutes,'starter_sizes',to_jsonb(v_sizes),'starter_preference',case when v_mode='bbq' then v_pref else null end));
  return jsonb_build_object('ok',true,'session',to_jsonb(v_session),'service_mode',v_mode,'session_minutes',v_session_minutes,'last_order_minutes',v_last_order_minutes,'starter_sizes',to_jsonb(v_sizes),'starter_preference',case when v_mode='bbq' then v_pref else null end);
end $function$;
