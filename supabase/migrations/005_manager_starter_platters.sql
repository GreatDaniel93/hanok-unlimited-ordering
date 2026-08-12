create table if not exists public.starter_recipe_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  party_size integer not null check (party_size between 2 and 6),
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  qty integer not null check (qty between 1 and 10),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, party_size, menu_item_id)
);

alter table public.starter_recipe_items enable row level security;

with s as (
  select id as store_id from public.stores where slug='wagga-wagga'
), recipe(party_size,item_name,qty,sort_order) as (
  values
    (2,'Wagyu Brisket',1,10),(2,'Wagyu Scotch Fillet',1,20),(2,'Marinated LA Short Rib',1,30),(2,'Pork Belly',1,40),
    (3,'Wagyu Brisket',1,10),(3,'Wagyu Scotch Fillet',1,20),(3,'Wagyu Inside Skirt',1,30),(3,'Marinated LA Short Rib',1,40),(3,'Pork Belly',1,50),(3,'Marinated Chicken Thigh',1,60),
    (4,'Wagyu Brisket',1,10),(4,'Wagyu Scotch Fillet',1,20),(4,'Wagyu Inside Skirt',1,30),(4,'Wagyu Intercostal',1,40),(4,'Marinated LA Short Rib',1,50),(4,'Pork Belly',1,60),(4,'Marinated Chicken Thigh',1,70),(4,'Soy Marinated Chicken Thigh',1,80),
    (5,'Wagyu Brisket',1,10),(5,'Wagyu Scotch Fillet',1,20),(5,'Wagyu Inside Skirt',1,30),(5,'Wagyu Intercostal',1,40),(5,'Marinated LA Short Rib',1,50),(5,'Marinated Angus Flap Meat',1,60),(5,'Pork Belly',1,70),(5,'Marinated Chicken Thigh',1,80),(5,'Soy Marinated Chicken Thigh',1,90),(5,'Sausage',1,100),
    (6,'Wagyu Brisket',2,10),(6,'Wagyu Scotch Fillet',1,20),(6,'Wagyu Inside Skirt',1,30),(6,'Wagyu Intercostal',1,40),(6,'Marinated LA Short Rib',1,50),(6,'Marinated Angus Flap Meat',1,60),(6,'Pork Belly',2,70),(6,'Marinated Chicken Thigh',1,80),(6,'Soy Marinated Chicken Thigh',1,90),(6,'Sausage',1,100)
)
insert into public.starter_recipe_items(store_id,party_size,menu_item_id,qty,sort_order)
select s.store_id,r.party_size,m.id,r.qty,r.sort_order
from s join recipe r on true
join public.menu_items m on m.store_id=s.store_id and m.name=r.item_name
on conflict (store_id,party_size,menu_item_id) do update set qty=excluded.qty,sort_order=excluded.sort_order,updated_at=now();

create or replace function public.add_starter_order(p_session uuid, p_store uuid, p_size integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_count integer; v_bad integer;
begin
  if p_size not between 2 and 6 then raise exception 'Invalid starter size.'; end if;
  select count(*) into v_count from public.starter_recipe_items r where r.store_id=p_store and r.party_size=p_size;
  if v_count=0 then raise exception 'Starter %P has no configured products.',p_size; end if;
  select count(*) into v_bad from public.starter_recipe_items r join public.menu_items m on m.id=r.menu_item_id where r.store_id=p_store and r.party_size=p_size and (m.active=false or m.category<>'meat');
  if v_bad>0 then raise exception 'Starter %P contains unavailable products. Please update Starter configuration.',p_size; end if;
  insert into public.orders(session_id,station,source,round_no,label) values(p_session,'meat','starter',0,'HANOK STARTER – '||p_size||'P') returning id into v_order;
  insert into public.order_items(order_id,menu_item_id,item_name,qty)
  select v_order,m.id,m.name,r.qty from public.starter_recipe_items r join public.menu_items m on m.id=r.menu_item_id where r.store_id=p_store and r.party_size=p_size order by r.sort_order,m.name;
  return v_order;
end; $$;

create or replace function public.manager_get_starters(p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_store public.stores%rowtype; v_recipes jsonb; v_meats jsonb;
begin
  v_role:=public.access_role(p_secret); if v_role<>'manager' then raise exception 'Manager login required.'; end if;
  select * into v_store from public.stores where slug='wagga-wagga';
  select coalesce(jsonb_agg(jsonb_build_object('party_size',sizes.party_size,'items',coalesce((select jsonb_agg(jsonb_build_object('menu_item_id',m.id,'name',m.name,'display_name',m.display_name,'qty',r.qty,'sort_order',r.sort_order,'active',m.active) order by r.sort_order,m.name) from public.starter_recipe_items r join public.menu_items m on m.id=r.menu_item_id where r.store_id=v_store.id and r.party_size=sizes.party_size),'[]'::jsonb)) order by sizes.party_size),'[]'::jsonb)
  into v_recipes from (values(2),(3),(4),(5),(6)) as sizes(party_size);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'active',active,'sort_order',sort_order) order by sort_order,name),'[]'::jsonb) into v_meats from public.menu_items where store_id=v_store.id and category='meat';
  return jsonb_build_object('ok',true,'recipes',v_recipes,'meats',v_meats);
end; $$;

create or replace function public.manager_starter_action(p_secret text,p_party_size integer,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_store public.stores%rowtype; v_input_count integer; v_valid_count integer; v_distinct_count integer;
begin
  v_role:=public.access_role(p_secret); if v_role<>'manager' then raise exception 'Manager login required.'; end if;
  if p_party_size not between 2 and 6 then raise exception 'Starter size must be between 2 and 6.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Starter must contain at least one product.'; end if;
  select * into v_store from public.stores where slug='wagga-wagga';
  v_input_count:=jsonb_array_length(p_items);
  select count(*) into v_valid_count from jsonb_array_elements(p_items) x join public.menu_items m on m.id=(x->>'menu_item_id')::uuid where m.store_id=v_store.id and m.category='meat' and m.active=true and coalesce((x->>'qty')::integer,0) between 1 and 10;
  if v_valid_count<>v_input_count then raise exception 'Starter contains an invalid, hidden or non-meat product.'; end if;
  select count(distinct x->>'menu_item_id') into v_distinct_count from jsonb_array_elements(p_items) x;
  if v_distinct_count<>v_input_count then raise exception 'The same product cannot appear twice in one Starter.'; end if;
  delete from public.starter_recipe_items where store_id=v_store.id and party_size=p_party_size;
  insert into public.starter_recipe_items(store_id,party_size,menu_item_id,qty,sort_order)
  select v_store.id,p_party_size,(x->>'menu_item_id')::uuid,(x->>'qty')::integer,(ord::integer)*10 from jsonb_array_elements(p_items) with ordinality as j(x,ord);
  insert into public.audit_logs(store_id,actor,action,metadata) values(v_store.id,'manager','starter_update',jsonb_build_object('party_size',p_party_size,'items',p_items));
  return jsonb_build_object('ok',true,'party_size',p_party_size);
end; $$;

-- Existing manager_menu_action is upgraded in production to block hiding or recategorising products still used in Starter recipes.
-- Keep this guard in any future replacement of manager_menu_action:
--   if p_action='disable' and exists(select 1 from starter_recipe_items where menu_item_id=v_item.id) then raise exception ...
--   if changing a Starter meat to a non-meat category, require it to be removed from Starter first.

revoke all on public.starter_recipe_items from anon,authenticated;
revoke all on function public.add_starter_order(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.manager_get_starters(text) to anon,authenticated;
grant execute on function public.manager_starter_action(text,integer,jsonb) to anon,authenticated;
