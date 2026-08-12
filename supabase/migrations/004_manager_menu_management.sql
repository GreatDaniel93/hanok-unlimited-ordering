-- Manager-controlled menu management for Hanok Wagga Wagga.
-- Products are soft-disabled with active=false instead of deleted so historical order links remain valid.

create or replace function public.manager_get_menu(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_store stores%rowtype;
  v_items jsonb;
begin
  v_role := public.access_role(p_secret);
  if v_role <> 'manager' then raise exception 'Manager login required.'; end if;
  select * into v_store from stores where slug='wagga-wagga';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'display_name',display_name,'description',description,
    'category',category,'station',station,'portion_label',portion_label,
    'max_per_round',max_per_round,'sort_order',sort_order,'active',active
  ) order by category,sort_order,name),'[]'::jsonb)
  into v_items
  from menu_items
  where store_id=v_store.id;

  return jsonb_build_object('ok',true,'items',v_items);
end;
$$;

create or replace function public.manager_menu_action(
  p_secret text,
  p_action text,
  p_item_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_store stores%rowtype;
  v_item menu_items%rowtype;
  v_name text;
  v_display text;
  v_description text;
  v_category text;
  v_station text;
  v_portion text;
  v_max integer;
  v_sort integer;
begin
  v_role := public.access_role(p_secret);
  if v_role <> 'manager' then raise exception 'Manager login required.'; end if;
  select * into v_store from stores where slug='wagga-wagga';

  if p_action='add' then
    v_name := trim(coalesce(p_payload->>'name',''));
    if v_name='' then raise exception 'Product name is required.'; end if;
    v_display := nullif(trim(coalesce(p_payload->>'display_name','')),'');
    v_description := nullif(trim(coalesce(p_payload->>'description','')),'');
    v_category := coalesce(p_payload->>'category','');
    if v_category not in ('meat','hot','rice_soup') then raise exception 'Invalid category.'; end if;
    v_station := case when v_category='meat' then 'meat' else 'hot' end;
    v_portion := nullif(trim(coalesce(p_payload->>'portion_label','')),'');
    v_max := greatest(1,least(10,coalesce((p_payload->>'max_per_round')::integer,2)));
    v_sort := greatest(0,least(9999,coalesce((p_payload->>'sort_order')::integer,0)));

    if exists(select 1 from menu_items where store_id=v_store.id and lower(name)=lower(v_name)) then
      raise exception 'A product with this name already exists.';
    end if;

    insert into menu_items(store_id,name,display_name,description,category,station,portion_label,max_per_round,sort_order,active)
    values(v_store.id,v_name,coalesce(v_display,v_name),v_description,v_category,v_station,v_portion,v_max,v_sort,true)
    returning * into v_item;

    insert into audit_logs(store_id,actor,action,metadata)
    values(v_store.id,'manager','menu_add',jsonb_build_object('item_id',v_item.id,'name',v_item.name));

  elsif p_action='update' then
    select * into v_item from menu_items where id=p_item_id and store_id=v_store.id;
    if not found then raise exception 'Product not found.'; end if;

    v_name := trim(coalesce(p_payload->>'name',v_item.name));
    if v_name='' then raise exception 'Product name is required.'; end if;
    if exists(select 1 from menu_items where store_id=v_store.id and id<>v_item.id and lower(name)=lower(v_name)) then
      raise exception 'A product with this name already exists.';
    end if;
    v_display := nullif(trim(coalesce(p_payload->>'display_name',coalesce(v_item.display_name,''))),'');
    v_description := nullif(trim(coalesce(p_payload->>'description',coalesce(v_item.description,''))),'');
    v_category := coalesce(p_payload->>'category',v_item.category);
    if v_category not in ('meat','hot','rice_soup') then raise exception 'Invalid category.'; end if;
    v_station := case when v_category='meat' then 'meat' else 'hot' end;
    v_portion := nullif(trim(coalesce(p_payload->>'portion_label',coalesce(v_item.portion_label,''))),'');
    v_max := greatest(1,least(10,coalesce((p_payload->>'max_per_round')::integer,v_item.max_per_round)));
    v_sort := greatest(0,least(9999,coalesce((p_payload->>'sort_order')::integer,v_item.sort_order)));

    update menu_items set
      name=v_name,
      display_name=coalesce(v_display,v_name),
      description=v_description,
      category=v_category,
      station=v_station,
      portion_label=v_portion,
      max_per_round=v_max,
      sort_order=v_sort
    where id=v_item.id
    returning * into v_item;

    insert into audit_logs(store_id,actor,action,metadata)
    values(v_store.id,'manager','menu_update',jsonb_build_object('item_id',v_item.id,'name',v_item.name));

  elsif p_action in ('disable','enable') then
    select * into v_item from menu_items where id=p_item_id and store_id=v_store.id;
    if not found then raise exception 'Product not found.'; end if;

    update menu_items set active=(p_action='enable') where id=v_item.id returning * into v_item;

    insert into audit_logs(store_id,actor,action,metadata)
    values(v_store.id,'manager',case when p_action='enable' then 'menu_enable' else 'menu_disable' end,
      jsonb_build_object('item_id',v_item.id,'name',v_item.name));
  else
    raise exception 'Unsupported menu action.';
  end if;

  return jsonb_build_object('ok',true,'item',jsonb_build_object(
    'id',v_item.id,'name',v_item.name,'display_name',v_item.display_name,
    'description',v_item.description,'category',v_item.category,'station',v_item.station,
    'portion_label',v_item.portion_label,'max_per_round',v_item.max_per_round,
    'sort_order',v_item.sort_order,'active',v_item.active
  ));
end;
$$;

grant execute on function public.manager_get_menu(text) to anon,authenticated;
grant execute on function public.manager_menu_action(text,text,uuid,jsonb) to anon,authenticated;
