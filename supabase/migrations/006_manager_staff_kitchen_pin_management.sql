create or replace function public.manager_change_role_pin(p_secret text, p_role text, p_new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_cfg public.backend_config%rowtype;
  v_hash text;
  v_store public.stores%rowtype;
begin
  v_role := public.access_role(p_secret);
  if v_role <> 'manager' then raise exception 'Manager login required.'; end if;
  if p_role not in ('staff','kitchen') then raise exception 'Only Staff and Kitchen PINs can be changed here.'; end if;
  if coalesce(p_new_pin,'') !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4 to 8 digits.'; end if;

  select * into v_cfg from public.backend_config where singleton=true for update;
  v_hash := encode(extensions.digest(p_new_pin,'sha256'),'hex');

  if v_hash = v_cfg.manager_pin_sha256 then raise exception 'New PIN cannot match the Manager PIN.'; end if;
  if p_role='staff' and v_hash = v_cfg.kitchen_pin_sha256 then raise exception 'Staff PIN cannot match the Kitchen PIN.'; end if;
  if p_role='kitchen' and v_hash = v_cfg.staff_pin_sha256 then raise exception 'Kitchen PIN cannot match the Staff PIN.'; end if;

  if p_role='staff' then
    update public.backend_config set staff_pin_sha256=v_hash, updated_at=now() where singleton=true;
  else
    update public.backend_config set kitchen_pin_sha256=v_hash, updated_at=now() where singleton=true;
  end if;

  delete from public.staff_access_sessions where role=p_role;

  select * into v_store from public.stores where slug='wagga-wagga';
  insert into public.audit_logs(store_id,actor,action,metadata)
  values(v_store.id,'manager','role_pin_changed',jsonb_build_object('role',p_role));

  return jsonb_build_object('ok',true,'role',p_role,'sessions_revoked',true);
end;
$$;

grant execute on function public.manager_change_role_pin(text,text,text) to anon, authenticated;
