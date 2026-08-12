-- Manager table management: add/rename/capacity/disable/restore without deleting history.
-- Applied to production Supabase on 2026-08-12.

create or replace function public.manager_get_tables(p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_store stores%rowtype; v_tables jsonb;
begin
  v_role:=public.access_role(p_secret); if v_role<>'manager' then raise exception 'Manager login required.'; end if;
  select * into v_store from stores where slug='wagga-wagga';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'token',t.token,'capacity',t.capacity,'active',t.active,'created_at',t.created_at,'has_active_session',exists(select 1 from table_sessions s where s.table_id=t.id and s.status='active')) order by t.active desc,t.name),'[]'::jsonb) into v_tables from dining_tables t where t.store_id=v_store.id;
  return jsonb_build_object('ok',true,'tables',v_tables);
end;$$;

create or replace function public.manager_table_action(p_secret text,p_action text,p_table_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_store stores%rowtype; v_table dining_tables%rowtype; v_name text; v_capacity integer;
begin
  v_role:=public.access_role(p_secret); if v_role<>'manager' then raise exception 'Manager login required.'; end if; select * into v_store from stores where slug='wagga-wagga';
  if p_action='add' then
    v_name:=trim(coalesce(p_payload->>'name','')); if v_name='' then raise exception 'Table name is required.'; end if; if length(v_name)>30 then raise exception 'Table name is too long.'; end if; v_capacity:=greatest(1,least(30,coalesce((p_payload->>'capacity')::integer,6)));
    if exists(select 1 from dining_tables where store_id=v_store.id and lower(name)=lower(v_name)) then raise exception 'A table with this name already exists.'; end if;
    insert into dining_tables(store_id,name,capacity,active) values(v_store.id,v_name,v_capacity,true) returning * into v_table;
  elsif p_action='update' then
    select * into v_table from dining_tables where id=p_table_id and store_id=v_store.id; if not found then raise exception 'Table not found.'; end if; v_name:=trim(coalesce(p_payload->>'name',v_table.name)); if v_name='' then raise exception 'Table name is required.'; end if; if length(v_name)>30 then raise exception 'Table name is too long.'; end if;
    if exists(select 1 from dining_tables where store_id=v_store.id and id<>v_table.id and lower(name)=lower(v_name)) then raise exception 'A table with this name already exists.'; end if; v_capacity:=greatest(1,least(30,coalesce((p_payload->>'capacity')::integer,v_table.capacity))); update dining_tables set name=v_name,capacity=v_capacity where id=v_table.id returning * into v_table;
  elsif p_action in ('disable','enable') then
    select * into v_table from dining_tables where id=p_table_id and store_id=v_store.id; if not found then raise exception 'Table not found.'; end if; if p_action='disable' and exists(select 1 from table_sessions where table_id=v_table.id and status='active') then raise exception 'This table has an active dining session. Close or move the session before disabling the table.'; end if; update dining_tables set active=(p_action='enable') where id=v_table.id returning * into v_table;
  else raise exception 'Unsupported table action.'; end if;
  insert into audit_logs(store_id,actor,action,metadata) values(v_store.id,'manager','table_'||p_action,jsonb_build_object('table_id',v_table.id,'name',v_table.name,'capacity',v_table.capacity));
  return jsonb_build_object('ok',true,'table',jsonb_build_object('id',v_table.id,'name',v_table.name,'token',v_table.token,'capacity',v_table.capacity,'active',v_table.active));
end;$$;

grant execute on function public.manager_get_tables(text) to anon,authenticated;
grant execute on function public.manager_table_action(text,text,uuid,jsonb) to anon,authenticated;
