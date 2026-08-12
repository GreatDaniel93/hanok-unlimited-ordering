-- Hanok Wagga Wagga has 16 dining tables.
-- This migration safely adds T13-T16 to projects initially seeded with T01-T12.

do $$
declare
  v_store uuid;
  i integer;
begin
  select id into v_store from stores where slug = 'wagga-wagga';
  for i in 13..16 loop
    insert into dining_tables(store_id, name, capacity)
    values (v_store, 'T' || lpad(i::text, 2, '0'), 6)
    on conflict (store_id, name) do nothing;
  end loop;
end $$;
