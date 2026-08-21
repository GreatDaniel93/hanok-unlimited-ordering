create index if not exists idx_orders_kds_station_status_created on public.orders(station,status,created_at) where status in ('new','preparing','ready');
create index if not exists idx_orders_session_source_created on public.orders(session_id,source,created_at desc);
create index if not exists idx_orders_print_pending_created on public.orders(created_at) where printed_at is null and status <> 'cancelled';
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_menu_items_store_active_sort on public.menu_items(store_id,active,sort_order);
create index if not exists idx_access_sessions_token_expiry on public.staff_access_sessions(token_sha256,expires_at);

create or replace function public.access_role(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare v_role text; v_hash text;
begin
  if coalesce(p_token,'')='' then return null; end if;
  v_hash:=encode(extensions.digest(p_token,'sha256'),'hex');
  select role into v_role
  from public.staff_access_sessions
  where token_sha256=v_hash and expires_at>now();
  if v_role is not null then
    update public.staff_access_sessions
       set last_seen_at=now()
     where token_sha256=v_hash
       and (last_seen_at is null or last_seen_at < now()-interval '5 minutes');
  end if;
  return v_role;
end; $function$;
