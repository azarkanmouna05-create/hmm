\set ON_ERROR_STOP 0
create function pg_temp.act(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;
set role authenticated;
do $$ declare u text; begin
  foreach u in array array['44444444-4444-4444-4444-444444444441','44444444-4444-4444-4444-444444444442','44444444-4444-4444-4444-444444444443'] loop
    perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claim.role','authenticated',false);
    insert into public.session_aggregates(course,char,hints,conf,stuck_step,anon_id)
      select 'MATH 1101','socrates',3,2,'combine with product rule',anon_id from public.profiles where user_id=auth.uid();
  end loop; end $$;
select pg_temp.act('22222222-2222-2222-2222-222222222222');
\echo '== professor, 4 students in MATH 1101 (expect hidden:true)'
select public.class_insights('MATH 1101');
select pg_temp.act('44444444-4444-4444-4444-444444444444');
insert into public.session_aggregates(course,char,hints,conf,stuck_step,misconception,anon_id)
  select 'MATH 1101','socrates',1,4,'identify f and g','multiplies the derivatives',anon_id from public.profiles where user_id=auth.uid();
select pg_temp.act('22222222-2222-2222-2222-222222222222');
\echo '== professor, 5 students (expect patterns, no names)'
select jsonb_pretty(public.class_insights('MATH 1101'));
select pg_temp.act('33333333-3333-3333-3333-333333333333');
\echo '== admin changes max hints (expect UPDATE 1)'
update public.policy set max_hints = 3 where id=1;
