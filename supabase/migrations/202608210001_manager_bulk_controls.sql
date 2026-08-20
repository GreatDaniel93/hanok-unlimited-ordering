create or replace function public.manager_bulk_action(p_secret text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_sessions integer := 0;
  v_orders integer := 0;
begin
  v_role := public.access_role(p_secret);
  if v_role is distinct from 'manager' then
    raise exception 'Manager access required';
  end if;

  if p_action = 'close_all_tables' then
    update public.table_sessions
       set status = 'closed', closed_at = now()
     where status = 'active';
    get diagnostics v_sessions = row_count;

    insert into public.audit_logs(actor, action, payload)
    values ('manager','bulk_close_all_tables',jsonb_build_object('sessions_closed',v_sessions));

    return jsonb_build_object('ok',true,'action',p_action,'sessions_closed',v_sessions);
  elsif p_action = 'clear_all_orders' then
    update public.orders
       set status = 'cancelled',
           printed_at = coalesce(printed_at, now()),
           updated_at = now()
     where status in ('new','preparing','ready');
    get diagnostics v_orders = row_count;

    insert into public.audit_logs(actor, action, payload)
    values ('manager','bulk_clear_all_orders',jsonb_build_object('orders_cancelled',v_orders));

    return jsonb_build_object('ok',true,'action',p_action,'orders_cancelled',v_orders);
  else
    raise exception 'Unsupported bulk action';
  end if;
end;
$$;

revoke all on function public.manager_bulk_action(text,text) from public;
grant execute on function public.manager_bulk_action(text,text) to anon, authenticated;
