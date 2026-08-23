create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('rating','single','multi','text')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  service_modes text[] not null default array['lunch','bbq']::text[],
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(service_modes) > 0),
  check (service_modes <@ array['lunch','bbq']::text[])
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  table_id uuid references public.dining_tables(id) on delete set null,
  session_id uuid references public.table_sessions(id) on delete set null,
  service_mode text check (service_mode in ('lunch','bbq')),
  submitted_at timestamptz not null default now()
);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete restrict,
  question_text_snapshot text not null,
  question_type_snapshot text not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  unique(response_id,question_id)
);

alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

create index if not exists survey_questions_store_active_sort_idx on public.survey_questions(store_id,active,sort_order);
create index if not exists survey_responses_store_submitted_idx on public.survey_responses(store_id,submitted_at desc);
create index if not exists survey_responses_session_idx on public.survey_responses(session_id);
create index if not exists survey_answers_question_idx on public.survey_answers(question_id,response_id);

with s as (select id from public.stores where slug='wagga-wagga' limit 1), seed(question_text,question_type,options,required,service_modes,sort_order) as (
 values
 ('How would you rate the freshness of the BBQ meats?','rating','[]'::jsonb,true,array['bbq']::text[],10),
 ('How would you rate the flavor / seasoning of the BBQ meats?','rating','[]'::jsonb,true,array['bbq']::text[],20),
 ('How would you rate the texture / tenderness of the BBQ meats?','rating','[]'::jsonb,true,array['bbq']::text[],30),
 ('How would you rate the value for money of your buffet?','rating','[]'::jsonb,true,array['lunch','bbq']::text[],40),
 ('How do our prices compare with similar Korean BBQ / buffet restaurants?','single','["Much higher","Slightly higher","About the same","Slightly lower","Much lower"]'::jsonb,true,array['lunch','bbq']::text[],50),
 ('What would you most like us to improve?','multi','["Flavor / seasoning","Texture / food quality","Food variety","Ordering / dining instructions","Lower prices / more discounts"]'::jsonb,false,array['lunch','bbq']::text[],60),
 ('How would you rate our staff friendliness and helpfulness?','rating','[]'::jsonb,true,array['lunch','bbq']::text[],70),
 ('How would you rate our service speed and attentiveness?','rating','[]'::jsonb,true,array['lunch','bbq']::text[],80),
 ('Any other comments or suggestions?','text','[]'::jsonb,false,array['lunch','bbq']::text[],90)
)
insert into public.survey_questions(store_id,question_text,question_type,options,required,service_modes,sort_order)
select s.id,seed.question_text,seed.question_type,seed.options,seed.required,seed.service_modes,seed.sort_order from s cross join seed
where not exists (select 1 from public.survey_questions q where q.store_id=s.id);

create or replace function public.get_customer_survey(p_table_token text, p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table dining_tables%rowtype; v_session table_sessions%rowtype; v_mode text; v_questions jsonb;
begin
 select * into v_table from dining_tables where token=p_table_token and active=true;
 if not found then raise exception 'Invalid table QR code.'; end if;
 if p_session_id is not null then
   select * into v_session from table_sessions where id=p_session_id and table_id=v_table.id;
   if not found then raise exception 'Invalid dining session.'; end if;
 else
   select * into v_session from table_sessions where table_id=v_table.id and status='active' order by created_at desc limit 1;
 end if;
 v_mode:=case when v_session.id is null then null else v_session.service_mode end;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_text',q.question_text,'question_type',q.question_type,'options',q.options,'required',q.required,'sort_order',q.sort_order) order by q.sort_order,q.created_at),'[]'::jsonb)
 into v_questions from survey_questions q
 where q.store_id=v_table.store_id and q.active=true and ((v_mode is null and q.service_modes @> array['lunch','bbq']::text[]) or (v_mode is not null and v_mode=any(q.service_modes)));
 return jsonb_build_object('ok',true,'table',jsonb_build_object('id',v_table.id,'name',v_table.name),'session',case when v_session.id is null then null else jsonb_build_object('id',v_session.id,'service_mode',v_session.service_mode,'status',v_session.status) end,'questions',v_questions);
end $$;

create or replace function public.submit_customer_survey(p_table_token text, p_session_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table dining_tables%rowtype; v_session table_sessions%rowtype; v_mode text; v_response uuid; v_q survey_questions%rowtype; v_x jsonb; v_a jsonb; v_text text; v_count int;
begin
 if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>30 then raise exception 'Invalid survey response.'; end if;
 select * into v_table from dining_tables where token=p_table_token and active=true;
 if not found then raise exception 'Invalid table QR code.'; end if;
 if p_session_id is not null then
   select * into v_session from table_sessions where id=p_session_id and table_id=v_table.id;
   if not found then raise exception 'Invalid dining session.'; end if;
   v_mode:=v_session.service_mode;
 else v_mode:=null; end if;
 for v_q in select * from survey_questions q where q.store_id=v_table.store_id and q.active=true and ((v_mode is null and q.service_modes @> array['lunch','bbq']::text[]) or (v_mode is not null and v_mode=any(q.service_modes))) order by q.sort_order loop
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
 insert into survey_responses(store_id,table_id,session_id,service_mode) values(v_table.store_id,v_table.id,case when v_session.id is null then null else v_session.id end,v_mode) returning id into v_response;
 for v_x in select value from jsonb_array_elements(p_answers) loop
   select * into v_q from survey_questions q where q.id::text=v_x->>'question_id' and q.store_id=v_table.store_id and q.active=true and ((v_mode is null and q.service_modes @> array['lunch','bbq']::text[]) or (v_mode is not null and v_mode=any(q.service_modes)));
   if found then insert into survey_answers(response_id,question_id,question_text_snapshot,question_type_snapshot,answer) values(v_response,v_q.id,v_q.question_text,v_q.question_type,v_x->'answer'); end if;
 end loop;
 return jsonb_build_object('ok',true,'response_id',v_response);
end $$;

create or replace function public.manager_save_survey_question(p_secret text,p_action text,p_question_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_store uuid; v_type text; v_text text; v_options jsonb; v_modes text[]; v_id uuid;
begin
 if public.access_role(p_secret)<>'manager' then raise exception 'Manager login required.'; end if;
 select id into v_store from stores where slug='wagga-wagga' limit 1;
 if p_action='add' then
   v_text:=trim(coalesce(p_payload->>'question_text','')); v_type:=coalesce(p_payload->>'question_type','rating'); v_options:=coalesce(p_payload->'options','[]'::jsonb);
   select coalesce(array_agg(value),array['lunch','bbq']::text[]) into v_modes from jsonb_array_elements_text(coalesce(p_payload->'service_modes','["lunch","bbq"]'::jsonb));
   if length(v_text)<3 or length(v_text)>500 then raise exception 'Question text must be 3-500 characters.'; end if;
   if v_type not in ('rating','single','multi','text') then raise exception 'Invalid question type.'; end if;
   if v_modes is null or cardinality(v_modes)=0 or not (v_modes <@ array['lunch','bbq']::text[]) then raise exception 'Invalid service modes.'; end if;
   if v_type in ('single','multi') and (jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options)<2 or jsonb_array_length(v_options)>20) then raise exception 'Choice questions need 2-20 options.'; end if;
   insert into survey_questions(store_id,question_text,question_type,options,required,service_modes,sort_order) values(v_store,v_text,v_type,case when v_type in ('single','multi') then v_options else '[]'::jsonb end,coalesce((p_payload->>'required')::boolean,false),v_modes,greatest(0,least(9999,coalesce((p_payload->>'sort_order')::int,100)))) returning id into v_id;
 elsif p_action='update' then
   if not exists(select 1 from survey_questions where id=p_question_id and store_id=v_store) then raise exception 'Question not found.'; end if;
   v_text:=trim(coalesce(p_payload->>'question_text','')); v_type:=coalesce(p_payload->>'question_type','rating'); v_options:=coalesce(p_payload->'options','[]'::jsonb);
   select coalesce(array_agg(value),array['lunch','bbq']::text[]) into v_modes from jsonb_array_elements_text(coalesce(p_payload->'service_modes','["lunch","bbq"]'::jsonb));
   if length(v_text)<3 or length(v_text)>500 or v_type not in ('rating','single','multi','text') then raise exception 'Invalid question.'; end if;
   if v_modes is null or cardinality(v_modes)=0 or not (v_modes <@ array['lunch','bbq']::text[]) then raise exception 'Invalid service modes.'; end if;
   if v_type in ('single','multi') and (jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options)<2 or jsonb_array_length(v_options)>20) then raise exception 'Choice questions need 2-20 options.'; end if;
   update survey_questions set question_text=v_text,question_type=v_type,options=case when v_type in ('single','multi') then v_options else '[]'::jsonb end,required=coalesce((p_payload->>'required')::boolean,false),service_modes=v_modes,sort_order=greatest(0,least(9999,coalesce((p_payload->>'sort_order')::int,sort_order))),updated_at=now() where id=p_question_id and store_id=v_store returning id into v_id;
 elsif p_action='delete' then update survey_questions set active=false,updated_at=now() where id=p_question_id and store_id=v_store returning id into v_id;
 elsif p_action='restore' then update survey_questions set active=true,updated_at=now() where id=p_question_id and store_id=v_store returning id into v_id;
 else raise exception 'Unsupported action.'; end if;
 if v_id is null then raise exception 'Question not found.'; end if;
 return jsonb_build_object('ok',true,'question_id',v_id);
end $$;

create or replace function public.manager_get_survey(p_secret text,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_store uuid; v_result jsonb;
begin
 if public.access_role(p_secret)<>'manager' then raise exception 'Manager login required.'; end if;
 if p_to<=p_from or p_to-p_from>interval '367 days' then raise exception 'Invalid date range.'; end if;
 select id into v_store from stores where slug='wagga-wagga' limit 1;
 with rr as (select * from survey_responses where store_id=v_store and submitted_at>=p_from and submitted_at<p_to), aa as (select a.*,r.service_mode,r.submitted_at from survey_answers a join rr r on r.id=a.response_id)
 select jsonb_build_object(
   'from',p_from,'to',p_to,
   'kpi',jsonb_build_object('responses',(select count(*) from rr),'lunch_responses',(select count(*) from rr where service_mode='lunch'),'bbq_responses',(select count(*) from rr where service_mode='bbq'),'unique_sessions',(select count(distinct session_id) from rr where session_id is not null),'rating_average',(select round(avg((answer #>> '{}')::numeric),2) from aa where question_type_snapshot='rating')),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'question_text',q.question_text,'question_type',q.question_type,'options',q.options,'required',q.required,'service_modes',to_jsonb(q.service_modes),'sort_order',q.sort_order,'active',q.active,
      'response_count',(select count(*) from aa where question_id=q.id),
      'rating_average',case when q.question_type='rating' then (select round(avg((answer #>> '{}')::numeric),2) from aa where question_id=q.id and question_type_snapshot='rating') else null end,
      'rating_distribution',case when q.question_type='rating' then (select jsonb_build_object('1',count(*) filter(where (answer #>> '{}')='1'),'2',count(*) filter(where (answer #>> '{}')='2'),'3',count(*) filter(where (answer #>> '{}')='3'),'4',count(*) filter(where (answer #>> '{}')='4'),'5',count(*) filter(where (answer #>> '{}')='5')) from aa where question_id=q.id and question_type_snapshot='rating') else null end,
      'option_counts',case when q.question_type in ('single','multi') then (select coalesce(jsonb_agg(jsonb_build_object('option',opt,'count',cnt) order by ord),'[]'::jsonb) from (select opt,ord,(select count(*) from aa a where a.question_id=q.id and ((a.question_type_snapshot='single' and a.answer #>> '{}'=opt) or (a.question_type_snapshot='multi' and exists(select 1 from jsonb_array_elements_text(a.answer) z where z=opt)))) cnt from jsonb_array_elements_text(q.options) with ordinality z(opt,ord)) x) else null end,
      'comments',case when q.question_type='text' then (select coalesce(jsonb_agg(jsonb_build_object('answer',answer #>> '{}','submitted_at',submitted_at,'service_mode',service_mode) order by submitted_at desc),'[]'::jsonb) from (select * from aa where question_id=q.id and question_type_snapshot='text' and length(trim(answer #>> '{}'))>0 order by submitted_at desc limit 50) c) else null end
   ) order by q.sort_order,q.created_at),'[]'::jsonb) from survey_questions q where q.store_id=v_store),
   'recent_responses',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'submitted_at',r.submitted_at,'service_mode',r.service_mode,'table_name',dt.name) order by r.submitted_at desc),'[]'::jsonb) from (select * from rr order by submitted_at desc limit 50) r left join dining_tables dt on dt.id=r.table_id)
 ) into v_result;
 return v_result;
end $$;