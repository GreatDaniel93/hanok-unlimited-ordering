create or replace function public.get_public_survey(p_service_mode text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_store uuid; v_questions jsonb;
begin
  if p_service_mode not in ('lunch','bbq') then raise exception 'Please choose a valid buffet type.'; end if;
  select id into v_store from stores where slug='wagga-wagga' limit 1;
  if v_store is null then raise exception 'Store not found.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
    'options',q.options,'required',q.required,'sort_order',q.sort_order
  ) order by q.sort_order,q.created_at),'[]'::jsonb)
  into v_questions from survey_questions q
  where q.store_id=v_store and q.active=true and p_service_mode=any(q.service_modes);
  return jsonb_build_object('ok',true,'service_mode',p_service_mode,'questions',v_questions);
end $$;

create or replace function public.submit_public_survey(p_service_mode text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_store uuid; v_response uuid; v_q survey_questions%rowtype; v_x jsonb; v_a jsonb; v_text text; v_count int;
begin
  if p_service_mode not in ('lunch','bbq') then raise exception 'Please choose a valid buffet type.'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>30 then raise exception 'Invalid survey response.'; end if;
  select id into v_store from stores where slug='wagga-wagga' limit 1;
  if v_store is null then raise exception 'Store not found.'; end if;
  for v_q in select * from survey_questions q where q.store_id=v_store and q.active=true and p_service_mode=any(q.service_modes) order by q.sort_order loop
    select x into v_x from jsonb_array_elements(p_answers) x where x->>'question_id'=v_q.id::text limit 1;
    if v_x is null then if v_q.required then raise exception 'Please answer all required questions.'; end if; continue; end if;
    v_a:=v_x->'answer';
    if v_q.question_type='rating' then
      if jsonb_typeof(v_a)<>'number' or (v_a #>> '{}')::int not between 1 and 5 then raise exception 'Invalid rating answer.'; end if;
    elsif v_q.question_type='single' then
      if jsonb_typeof(v_a)<>'string' then raise exception 'Invalid choice answer.'; end if;
      v_text:=v_a #>> '{}'; if not exists(select 1 from jsonb_array_elements_text(v_q.options) o where o=v_text) then raise exception 'Invalid choice answer.'; end if;
    elsif v_q.question_type='multi' then
      if jsonb_typeof(v_a)<>'array' or jsonb_array_length(v_a)>20 then raise exception 'Invalid multiple-choice answer.'; end if;
      select count(*) into v_count from jsonb_array_elements_text(v_a) o where not exists(select 1 from jsonb_array_elements_text(v_q.options) z where z=o);
      if v_count>0 then raise exception 'Invalid multiple-choice answer.'; end if;
    elsif v_q.question_type='text' then
      if jsonb_typeof(v_a)<>'string' or length(v_a #>> '{}')>2000 then raise exception 'Comment is too long.'; end if;
    end if;
  end loop;
  insert into survey_responses(store_id,service_mode) values(v_store,p_service_mode) returning id into v_response;
  for v_x in select value from jsonb_array_elements(p_answers) loop
    select * into v_q from survey_questions q where q.id::text=v_x->>'question_id' and q.store_id=v_store and q.active=true and p_service_mode=any(q.service_modes);
    if found then insert into survey_answers(response_id,question_id,question_text_snapshot,question_type_snapshot,answer) values(v_response,v_q.id,v_q.question_text,v_q.question_type,v_x->'answer'); end if;
  end loop;
  return jsonb_build_object('ok',true,'response_id',v_response);
end $$;
