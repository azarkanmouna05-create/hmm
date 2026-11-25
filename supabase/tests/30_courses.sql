\set ON_ERROR_STOP 0
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
create function pg_temp.act(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
\echo '== demo student Mouna: my courses (expect 3 demo courses, NO join codes visible)'
select pg_temp.act('11111111-1111-1111-1111-111111111111'); select public.my_courses();
\echo '== real student s1: my courses before joining (expect [])'
select pg_temp.act('44444444-4444-4444-4444-444444444441'); select public.my_courses();
\echo '== s1 reads the course list directly to find codes (expect 0 rows)'
select count(*) from public.courses;
\echo '== s1 joins with a wrong code (expect ERROR no course)'
select public.join_course('NOPE-0000');
\echo '== s1 joins MATH with the code from class (lower case ok)'
select public.join_course('calc-7q2k');
select public.my_courses();
\echo '== s1 logs data for ECON which they did not join (expect RLS ERROR)'
insert into public.session_aggregates(course,char,anon_id,sample) select 'ECON 2301','socrates',anon_id,false from public.profiles where user_id=auth.uid();
\echo '== s1 sees the sample MATH task (expect 1) '
select count(*) from public.tasks;
\echo '== demo professor: my courses (expect 3 WITH join codes)'
select pg_temp.act('22222222-2222-2222-2222-222222222222'); select public.my_courses();
\echo '== demo professor asks insights for MATH (expect NOT hidden: 4 real classmates + demo Mouna = 5, includes_sample true)'
select public.class_insights('MATH 1101');
reset role;
set role authenticated;
\echo '== real professor (teaches nothing yet) asks MATH insights (expect ERROR you do not teach)'
select pg_temp.act('55555555-5555-5555-5555-555555555555'); select public.class_insights('MATH 1101');
\echo '== professor tries to join a course as a student (expect ERROR only students)'
select public.join_course('CALC-7Q2K');
\echo '== real professor assigned to MATH sees real students only (expect 4 → hidden under floor 5)'
reset role;
insert into public.teaching(user_id, course_code) values ('55555555-5555-5555-5555-555555555555','MATH 1101');
set role authenticated;
select pg_temp.act('55555555-5555-5555-5555-555555555555'); select public.class_insights('MATH 1101');
