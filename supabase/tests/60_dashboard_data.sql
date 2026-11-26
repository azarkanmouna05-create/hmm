\set ON_ERROR_STOP 0
create function pg_temp.act(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
\echo '== demo professor MATH insights now have enrolled + levels'
select pg_temp.act('22222222-2222-2222-2222-222222222222');
select (public.class_insights('MATH 1101'))->'enrolled' enrolled, (public.class_insights('MATH 1101'))->'levels' levels;
\echo '== admin campus stats: active_week, by_level, alerts'
select pg_temp.act('33333333-3333-3333-3333-333333333333');
select (public.campus_stats())->'active_week' active, (public.campus_stats())->'by_level' levels, (public.campus_stats())->'alerts' alerts;
\echo '== student still gets null'
select pg_temp.act('44444444-4444-4444-4444-444444444441'); select public.campus_stats() is null as is_null;
