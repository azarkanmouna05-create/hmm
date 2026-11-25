\set ON_ERROR_STOP 0
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
\echo '== roles after migration (s1..s4 were students; demo flags set for the 3 demo emails)'
select u.email, r.role, r.demo from auth.users u join public.user_roles r on r.user_id=u.id order by 1;
\echo '== sign-up with gmail (expect ERROR please use your university email)'
insert into auth.users(email) values ('hacker-admin@gmail.com');
\echo '== sign-up with x-admin@aui.ma (expect student, NOT admin)'
insert into auth.users(email) values ('fake-admin@aui.ma');
select r.role, r.demo from auth.users u join public.user_roles r on r.user_id=u.id where u.email='fake-admin@aui.ma';
create function pg_temp.act(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
\echo '== demo student (mouna) inserts a REAL-looking row (expect RLS ERROR)'
select pg_temp.act('11111111-1111-1111-1111-111111111111');
insert into public.session_aggregates(course,char,anon_id,sample) select 'MATH 1101','socrates',anon_id,false from public.profiles where user_id=auth.uid();
\echo '== demo student inserts sample row (expect OK)'
insert into public.session_aggregates(course,char,anon_id,sample) select 'MATH 1101','socrates',anon_id,true from public.profiles where user_id=auth.uid();
\echo '== DEMO professor sees demo data only (1 demo student → hidden)'
select pg_temp.act('22222222-2222-2222-2222-222222222222');
select public.class_insights('MATH 1101');
select public.my_account();
reset role;
\echo '== a REAL professor (admin sees all) — real rows only (expect 4: s1–s4; demo Mouna's row is now sample)'
insert into public.role_assignments(email,role) values ('real.prof@aui.ma','professor');
insert into auth.users(id,email) values ('55555555-5555-5555-5555-555555555555','real.prof@aui.ma');
set role authenticated;
select pg_temp.act('55555555-5555-5555-5555-555555555555');
select (public.class_insights('MATH 1101'))->>'students' as real_students, (public.class_insights('MATH 1101'))->>'sample' as sample;
\echo '== student tries to make themselves admin via role_assignments (expect 0 rows / RLS ERROR)'
select pg_temp.act('44444444-4444-4444-4444-444444444441');
insert into public.role_assignments(email,role) values ('s1@aui.ma','admin');
