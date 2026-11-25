\set ON_ERROR_STOP 0
\echo '== Ines signs up via the demo button → seeded history, enrolled in 3 courses'
insert into auth.users(id,email) values ('77777777-7777-7777-7777-777777777777','ines.demo@aui.ma');
select r.role, r.demo, (p.data->>'sessions') sessions, jsonb_array_length(p.data->'history') history, (p.data->'noticed'->>'text') noticed,
  (select count(*) from public.enrollments e where e.user_id = r.user_id) courses
from public.user_roles r join public.profiles p using (user_id) where r.user_id = '77777777-7777-7777-7777-777777777777';
create function pg_temp.act(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
\echo '== Ines sees the MATH help invite (expect 1)'
select pg_temp.act('77777777-7777-7777-7777-777777777777'); select count(*) from public.invites where course = 'MATH 1101';
\echo '== demo professor publishes a task, then the demo is reset → task gone, Ines history back, Mouna fresh'
select pg_temp.act('22222222-2222-2222-2222-222222222222'); insert into public.tasks(course,kind,topic) values ('ECON 2301','concept','demo scribble');
select pg_temp.act('33333333-3333-3333-3333-333333333333'); select public.reset_demo();
reset role;
select (select count(*) from public.tasks where topic = 'demo scribble') scribble_left,
       (select jsonb_array_length(data->'history') from public.profiles where user_id = '77777777-7777-7777-7777-777777777777') ines_history,
       (select data from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') mouna_profile,
       (select count(*) from public.tasks where sample) sample_tasks;
