\set ON_ERROR_STOP 0
create function pg_temp.act(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
\echo '== demo professor: MATH insights now include labelled sample class (expect hidden:false, students ≥ 20, includes_sample true)'
select pg_temp.act('22222222-2222-2222-2222-222222222222');
select (public.class_insights('MATH 1101'))->>'hidden' hidden, (public.class_insights('MATH 1101'))->>'students' students, (public.class_insights('MATH 1101'))->>'includes_sample' includes_sample;
\echo '== demo professor posts a task to a course they teach (expect OK), and to one they do not (expect RLS ERROR)'
insert into public.tasks(course,kind,topic) values ('ECON 2301','concept','Explain elasticity');
reset role; delete from public.teaching where course_code='SAD 3301' and user_id='22222222-2222-2222-2222-222222222222'; set role authenticated;
select pg_temp.act('22222222-2222-2222-2222-222222222222');
insert into public.tasks(course,kind,topic) values ('SAD 3301','claim','x');
\echo '== student calls campus_stats (expect null)'
select pg_temp.act('44444444-4444-4444-4444-444444444441'); select public.campus_stats();
\echo '== student tries reset_demo / assign_teacher (expect ERRORs)'
select public.reset_demo();
select public.assign_teacher('s1@aui.ma','MATH 1101');
\echo '== admin: campus stats has counts only'
select pg_temp.act('33333333-3333-3333-3333-333333333333');
select (public.campus_stats())->>'students' students, (public.campus_stats())->>'sessions_total' sessions, (public.campus_stats())->>'sample_rows' sample_rows;
\echo '== admin assigns a professor who has not signed up yet (expect pending), then creates a course'
select public.assign_teacher('new.prof@aui.ma','SAD 3301');
select (public.create_course('BUS 2201','Marketing'))->>'code' code;
\echo '== admin changes a rule, then resets the demo (expect max_hints back to 4)'
update public.policy set max_hints = 2 where id = 1;
select public.reset_demo();
select max_hints from public.policy;
reset role;
\echo '== new.prof signs up later → automatically teaches SAD 3301 (expect professor + 1 course)'
insert into auth.users(id,email) values ('66666666-6666-6666-6666-666666666666','new.prof@aui.ma');
select r.role, (select count(*) from public.teaching t where t.user_id = r.user_id) teaches from public.user_roles r where r.user_id='66666666-6666-6666-6666-666666666666';
