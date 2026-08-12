create extension if not exists pgcrypto;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  timezone text not null default 'Australia/Sydney',
  dining_minutes integer not null default 90,
  last_order_minutes integer not null default 15,
  meat_cooldown_minutes integer not null default 5,
  hot_cooldown_minutes integer not null default 5,
  created_at timestamptz not null default now()
);

create table if not exists dining_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  token text unique not null default encode(gen_random_bytes(8), 'hex'),
  capacity integer not null default 6,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  display_name text,
  description text,
  category text not null check (category in ('meat','hot','rice_soup')),
  station text not null check (station in ('meat','hot')),
  portion_label text,
  max_per_round integer not null default 2,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references dining_tables(id) on delete restrict,
  status text not null default 'active' check (status in ('active','closed')),
  adults integer not null default 0,
  children_8_12 integer not null default 0,
  children_4_7 integer not null default 0,
  under_4 integer not null default 0,
  starter_equivalent numeric(5,2) not null default 0,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  last_order_at timestamptz not null,
  meat_order_available_at timestamptz not null,
  hot_order_available_at timestamptz not null,
  round_count integer not null default 0,
  created_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_session_per_table on table_sessions(table_id) where status = 'active';

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id) on delete cascade,
  station text not null check (station in ('meat','hot')),
  source text not null default 'customer' check (source in ('customer','starter','staff')),
  label text,
  round_no integer not null default 0,
  status text not null default 'new' check (status in ('new','preparing','ready','picked_up','cancelled')),
  printed_at timestamptz,
  print_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  item_name text not null,
  qty integer not null check (qty > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  store_id uuid references stores(id) on delete cascade,
  session_id uuid references table_sessions(id) on delete set null,
  actor text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;
alter table dining_tables enable row level security;
alter table menu_items enable row level security;
alter table table_sessions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table audit_logs enable row level security;

create or replace function submit_customer_order(p_table_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_store stores%rowtype;
  v_session table_sessions%rowtype;
  v_rec record;
  v_round integer;
  v_meat_total integer := 0;
  v_meat_limit integer := 0;
  v_has_meat boolean := false;
  v_has_hot boolean := false;
  v_order_id uuid;
  v_station text;
  v_order_ids jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_valid_count integer := 0;
  v_input_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your order is empty.';
  end if;

  select * into v_table from dining_tables where token = p_table_token and active = true;
  if not found then raise exception 'Invalid table QR code.'; end if;
  select * into v_store from stores where id = v_table.store_id;
  select * into v_session from table_sessions where table_id = v_table.id and status = 'active' for update;
  if not found then raise exception 'This table does not have an active dining session.'; end if;
  if v_now >= v_session.last_order_at then raise exception 'Last order has closed for this dining session.'; end if;

  v_input_count := jsonb_array_length(p_items);
  select count(*) into v_valid_count
  from jsonb_array_elements(p_items) x
  join menu_items mi on mi.id = (x->>'menu_item_id')::uuid
  where mi.store_id = v_store.id and mi.active = true and coalesce((x->>'qty')::integer, 0) > 0;
  if v_valid_count <> v_input_count then raise exception 'One or more menu items are invalid or unavailable.'; end if;

  for v_rec in
    select mi.id, mi.name, mi.category, mi.station, mi.max_per_round, sum((x->>'qty')::integer)::integer as qty
    from jsonb_array_elements(p_items) x
    join menu_items mi on mi.id = (x->>'menu_item_id')::uuid
    where mi.store_id = v_store.id and mi.active = true
    group by mi.id, mi.name, mi.category, mi.station, mi.max_per_round
  loop
    if v_rec.qty > v_rec.max_per_round then raise exception '% is limited to % portions per round.', v_rec.name, v_rec.max_per_round; end if;
    if v_rec.category = 'meat' then v_has_meat := true; v_meat_total := v_meat_total + v_rec.qty; else v_has_hot := true; end if;
  end loop;

  if v_session.starter_equivalent <= 2 then v_meat_limit := 4;
  elsif v_session.starter_equivalent <= 4 then v_meat_limit := 6;
  elsif v_session.starter_equivalent <= 6 then v_meat_limit := 8;
  else v_meat_limit := 10; end if;

  if v_has_meat and v_now < v_session.meat_order_available_at then raise exception 'Meat ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_has_hot and v_now < v_session.hot_order_available_at then raise exception 'Hot dish ordering is temporarily paused. Please wait a little longer.'; end if;
  if v_meat_total > v_meat_limit then raise exception 'This table can order up to % meat portions in this round.', v_meat_limit; end if;

  v_round := v_session.round_count + 1;
  for v_station in
    select distinct mi.station
    from jsonb_array_elements(p_items) x
    join menu_items mi on mi.id = (x->>'menu_item_id')::uuid
    where mi.store_id = v_store.id and mi.active = true
  loop
    insert into orders(session_id, station, source, round_no, label) values (v_session.id, v_station, 'customer', v_round, 'Customer Order') returning id into v_order_id;
    insert into order_items(order_id, menu_item_id, item_name, qty)
    select v_order_id, mi.id, mi.name, sum((x->>'qty')::integer)::integer
    from jsonb_array_elements(p_items) x
    join menu_items mi on mi.id = (x->>'menu_item_id')::uuid
    where mi.store_id = v_store.id and mi.active = true and mi.station = v_station
    group by mi.id, mi.name;
    v_order_ids := v_order_ids || jsonb_build_array(v_order_id);
  end loop;

  update table_sessions set round_count = v_round,
    meat_order_available_at = case when v_has_meat then v_now + make_interval(mins => v_store.meat_cooldown_minutes) else meat_order_available_at end,
    hot_order_available_at = case when v_has_hot then v_now + make_interval(mins => v_store.hot_cooldown_minutes) else hot_order_available_at end
  where id = v_session.id;

  return jsonb_build_object('ok', true,'round', v_round,'order_ids', v_order_ids,'meat_limit', v_meat_limit,
    'meat_available_at', case when v_has_meat then v_now + make_interval(mins => v_store.meat_cooldown_minutes) else v_session.meat_order_available_at end,
    'hot_available_at', case when v_has_hot then v_now + make_interval(mins => v_store.hot_cooldown_minutes) else v_session.hot_order_available_at end);
end;
$$;

revoke all on function submit_customer_order(text, jsonb) from public;
grant execute on function submit_customer_order(text, jsonb) to service_role;

insert into stores(slug, name, timezone) values ('wagga-wagga', 'Hanok Wagga Wagga', 'Australia/Sydney') on conflict (slug) do update set name = excluded.name;

do $$
declare v_store uuid; i integer;
begin
  select id into v_store from stores where slug = 'wagga-wagga';
  for i in 1..12 loop
    insert into dining_tables(store_id, name, capacity) values (v_store, 'T' || lpad(i::text, 2, '0'), 6) on conflict (store_id, name) do nothing;
  end loop;
  insert into menu_items(store_id,name,display_name,description,category,station,portion_label,sort_order) values
  (v_store,'Wagyu Scotch Fillet','Wagyu Scotch Fillet','Premium wagyu beef','meat','meat','100g / order',10),
  (v_store,'Wagyu Intercostal','Wagyu Intercostal','Wagyu intercostal','meat','meat','100g / order',20),
  (v_store,'Wagyu Inside Skirt','Wagyu Inside Skirt','Wagyu inside skirt','meat','meat','100g / order',30),
  (v_store,'Marinated LA Short Rib','Marinated LA Short Rib','Hanok marinated LA short rib','meat','meat','100g / order',40),
  (v_store,'Marinated Angus Flap Meat','Marinated Angus Flap Meat','Hanok marinated Angus flap meat','meat','meat','100g / order',50),
  (v_store,'Wagyu Brisket','Wagyu Brisket','Thin sliced wagyu brisket','meat','meat','100g / order',60),
  (v_store,'Pork Belly','Pork Belly','Korean BBQ pork belly','meat','meat','100g / order',70),
  (v_store,'Sausage','Sausage','BBQ sausage','meat','meat','100g / order',80),
  (v_store,'Marinated Chicken Thigh','Marinated Chicken Thigh','Hanok marinated chicken thigh','meat','meat','100g / order',90),
  (v_store,'Soy Marinated Chicken Thigh','Soy Marinated Chicken Thigh','Soy marinated chicken thigh','meat','meat','100g / order',100),
  (v_store,'Spicy Squid','Spicy Squid','Spicy marinated squid','meat','meat','100g / order',110),
  (v_store,'Korean Fried Chicken','Korean Fried Chicken','Choose from current Hanok flavours','hot','hot','Small sharing portion',210),
  (v_store,'Fried Dumplings','Fried Dumplings','Freshly fried dumplings','hot','hot','Small sharing portion',220),
  (v_store,'Tteokbokki','Tteokbokki','Korean spicy rice cakes','hot','hot','Small sharing portion',230),
  (v_store,'Seafood Pancake','Seafood Pancake','Freshly cooked Korean seafood pancake','hot','hot','4 pieces',240),
  (v_store,'Japchae','Japchae','Korean glass noodles with vegetables','hot','hot','Small sharing portion',250),
  (v_store,'Korean Rolled Egg','Korean Rolled Egg','Freshly prepared rolled egg','hot','hot','4 slices',260),
  (v_store,'French Fries','French Fries','Freshly fried fries','hot','hot','Small sharing portion',270),
  (v_store,'Dolsot Bibimbap','Dolsot Bibimbap','Stone pot mixed rice with egg','rice_soup','hot','1 small stone bowl',310),
  (v_store,'Soup of the Day','Soup of the Day','Daily Korean soup','rice_soup','hot','1 small bowl',320)
  on conflict (store_id, name) do update set display_name = excluded.display_name, description = excluded.description, category = excluded.category, station = excluded.station, portion_label = excluded.portion_label, sort_order = excluded.sort_order, active = true;
end $$;
