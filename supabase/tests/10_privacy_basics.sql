\set ON_ERROR_STOP 0
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
insert into auth.users (id,email) values
 ('11111111-1111-1111-1111-111111111111','mouna@aui.ma'),
 ('22222222-2222-2222-2222-222222222222','dr.salma.prof@aui.ma'),
 ('33333333-3333-3333-3333-333333333333','it.admin@aui.ma'),
 ('44444444-4444-4444-4444-444444444441','s1@aui.ma'),('44444444-4444-4444-4444-444444444442','s2@aui.ma'),
 ('44444444-4444-4444-4444-444444444443','s3@aui.ma'),('44444444-4444-4444-4444-444444444444','s4@aui.ma');
\echo '== roles from email (no role picker)'
select u.email, r.role from auth.users u join public.user_roles r on r.user_id=u.id order by 1;
insert into public.profiles(user_id,data) select id,'{}' from auth.users where email like 's%' or email like 'mouna%';

create function pg_temp.act(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false), set_config('request.jwt.claim.role','authenticated',false) $$;

set role authenticated;
select pg_temp.act('11111111-1111-1111-1111-111111111111');
\echo '== Mouna sees only her own profile (expect 1)'
select count(*) from public.profiles;
\echo '== Mouna saves a private chat; then the professor tries to read it'
insert into public.private_sessions(char,msgs) values ('socrates','[{"role":"user","content":"my secret struggle"}]');
select pg_temp.act('22222222-2222-2222-2222-222222222222');
\echo '== professor reads private chats (expect 0)'
select count(*) from public.private_sessions;
\echo '== professor reads raw aggregates directly (expect 0 rows)'
select count(*) from public.session_aggregates;

\echo '== students add anonymised rows with their OWN anon id'
select pg_temp.act('11111111-1111-1111-1111-111111111111');
insert into public.session_aggregates(course,char,hints,conf,stuck_step,anon_id)
  select 'MATH 1101','socrates',2,2,'combine with product rule',anon_id from public.profiles where user_id=auth.uid();
\echo '== student tries to spoof another anon id (expect ERROR / row-level security)'
insert into public.session_aggregates(course,char,anon_id) values ('MATH 1101','socrates','someone-else');
\echo '== student calls class_insights (expect ERROR not allowed)'
select public.class_insights('MATH 1101');
\echo '== student tries to change admin policy (expect UPDATE 0)'
update public.policy set max_hints = 99 where id=1;
