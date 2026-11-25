-- hmm. migration 004: professor + admin features and labelled sample data. Run AFTER 003. Safe to re-run.

-- ───────── professor ─────────
-- Private lesson notes ("Plan lesson" on a suggested teaching move).
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course text not null, text text not null, created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anonymous help-session invites: visible to members of the course; created by its teachers.
drop policy if exists "signed in read invites" on public.invites;
drop policy if exists "course members read invites" on public.invites;
create policy "course members read invites" on public.invites for select using (
  exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.course_code = invites.course)
  or exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = invites.course)
  or public.my_role() = 'admin');
drop policy if exists "professors create invites" on public.invites;
create policy "professors create invites" on public.invites for insert with check (
  exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = course));

-- ───────── admin ─────────
-- Professors can be assigned before they ever sign up.
create table if not exists public.teaching_pending (
  email text not null, course_code text not null references public.courses(code) on delete cascade,
  primary key (email, course_code)
);
alter table public.teaching_pending enable row level security;
drop policy if exists "admins see pending teaching" on public.teaching_pending;
create policy "admins see pending teaching" on public.teaching_pending for select using (public.my_role() = 'admin');

create or replace function public.assign_teacher(p_email text, p_course text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; e text := lower(trim(p_email));
begin
  if public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.courses where code = p_course) then raise exception 'hmm: no such course'; end if;
  insert into public.role_assignments (email, role) values (e, 'professor')
    on conflict (email) do update set role = 'professor' where public.role_assignments.role <> 'admin';
  select id into uid from auth.users where lower(email) = e;
  if uid is null then
    insert into public.teaching_pending values (e, p_course) on conflict do nothing;
    return 'pending';
  end if;
  update public.user_roles set role = 'professor' where user_id = uid and role = 'student';
  insert into public.teaching values (uid, p_course) on conflict do nothing;
  return 'assigned';
end $$;
grant execute on function public.assign_teacher(text, text) to authenticated;

create or replace function public.course_teachers() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_role() <> 'admin' then '[]'::jsonb else coalesce((
    select jsonb_agg(x) from (
      select t.course_code as course, u.email, false as pending from public.teaching t join auth.users u on u.id = t.user_id
      union all select course_code, email, true from public.teaching_pending) x), '[]'::jsonb) end;
$$;
grant execute on function public.course_teachers() to authenticated;

create or replace function public.create_course(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare jc text := upper(regexp_replace(split_part(trim(p_code), ' ', 1), '[^A-Za-z]', '', 'g')) || '-' || upper(substr(md5(random()::text), 1, 4));
begin
  if public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  insert into public.courses (code, name, join_code) values (upper(trim(p_code)), trim(p_name), jc);
  return jsonb_build_object('code', upper(trim(p_code)), 'join_code', jc);
end $$;
grant execute on function public.create_course(text, text) to authenticated;

-- new professors pick up pending assignments when they sign up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.role_assignments; dom text := lower(split_part(new.email, '@', 2)); ok boolean;
begin
  select * into a from public.role_assignments where email = lower(new.email);
  select dom = any(allowed_domains) into ok from public.policy where id = 1;
  if a.email is null and not coalesce(ok, false) then
    raise exception 'hmm: please use your university email' using errcode = 'P0001';
  end if;
  insert into public.user_roles (user_id, role, demo)
  values (new.id, coalesce(a.role, 'student'), coalesce(a.demo, false))
  on conflict (user_id) do nothing;
  if coalesce(a.demo, false) then perform public.setup_demo_account(new.id, a.role); end if;
  insert into public.teaching (user_id, course_code)
    select new.id, course_code from public.teaching_pending where email = lower(new.email) on conflict do nothing;
  delete from public.teaching_pending where email = lower(new.email);
  return new;
end $$;

-- Campus dashboard: counts only (no names, no chat text). Demo admins see everything incl. sample.
create or replace function public.campus_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_role() <> 'admin' then null else jsonb_build_object(
    'students', (select count(*) from public.user_roles where role = 'student'),
    'professors', (select count(*) from public.user_roles where role = 'professor'),
    'sessions_total', (select count(*) from public.session_aggregates),
    'sessions_week', (select count(*) from public.session_aggregates where created_at > now() - interval '7 days'),
    'sample_rows', (select count(*) from public.session_aggregates where sample),
    'avg_conf', (select round(avg(conf)::numeric, 1) from public.session_aggregates),
    'avg_hints', (select round(avg(hints)::numeric, 1) from public.session_aggregates),
    'answer_requests', (select coalesce(sum(answer_req), 0) from public.session_aggregates),
    'by_char', (select coalesce(jsonb_object_agg(char, n), '{}') from (select char, count(*) n from public.session_aggregates group by char) a),
    'by_course', (select coalesce(jsonb_agg(jsonb_build_object('course', c.code, 'name', c.name, 'demo', c.demo,
        'students', (select count(*) from public.enrollments e where e.course_code = c.code),
        'sessions', (select count(*) from public.session_aggregates s where s.course = c.code),
        'avg_conf', (select round(avg(conf)::numeric, 1) from public.session_aggregates s where s.course = c.code)) order by c.code), '[]')
      from public.courses c)
  ) end;
$$;
grant execute on function public.campus_stats() to authenticated;

-- Retention is enforced, not just displayed: delete private chats/reflections older than the policy.
create or replace function public.apply_retention() returns int
language plpgsql security definer set search_path = public as $$
declare keep interval; n int;
begin
  if public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  select case retention when '30 days' then interval '30 days' when '1 semester' then interval '120 days'
                        when '1 year' then interval '365 days' else interval '120 days' end into keep from public.policy where id = 1;
  delete from public.private_sessions where updated_at < now() - keep;
  get diagnostics n = row_count;
  delete from public.session_aggregates where created_at < now() - keep and not sample;
  return n;
end $$;
grant execute on function public.apply_retention() to authenticated;

-- ───────── labelled sample data for the demo ─────────
create or replace function public.seed_sample_data() returns void
language plpgsql security definer set search_path = public as $$
declare c record; i int; anon text; st text[]; mi text[]; ch text[];
begin
  insert into public.tasks (id, course, kind, topic, instructions, steps, misconceptions, due, sample) values
    ('00000000-0000-4000-8000-000000000101','MATH 1101','problem','Find the derivative of x² · sin x','Use the product rule.',
      array['identify f and g','differentiate f and g','combine with product rule'], array['multiplies the derivatives','forgets one term'], current_date + 5, true),
    ('00000000-0000-4000-8000-000000000201','ECON 2301','concept','Explain why demand curves slope downward','Teach it to Talmid in your own words.',
      array['income effect','substitution effect','law of demand'], array['confuses demand with quantity demanded','thinks price causes supply shift'], current_date + 7, true),
    ('00000000-0000-4000-8000-000000000301','SAD 3301','claim','Agile is always better than Waterfall','Defend or refine this claim against the Rival.',
      array['define both methods','give a supporting case','handle a counterexample'], array['treats Agile as no planning','ignores regulated projects'], current_date + 9, true)
  on conflict (id) do update set due = excluded.due, steps = excluded.steps, misconceptions = excluded.misconceptions;

  delete from public.session_aggregates where sample and anon_id like 'sample-%';
  for c in select * from (values
      ('MATH 1101','00000000-0000-4000-8000-000000000101'::uuid, 22, 'socrates'),
      ('ECON 2301','00000000-0000-4000-8000-000000000201'::uuid, 17, 'talmid'),
      ('SAD 3301', '00000000-0000-4000-8000-000000000301'::uuid, 19, 'rival')) v(course, task, n, chr) loop
    select steps, misconceptions into st, mi from public.tasks where id = c.task;
    for i in 1..c.n loop
      anon := 'sample-' || substr(md5(c.course || i), 1, 8);
      insert into public.session_aggregates (course, task_id, char, hints, max_hints, conf, mins, answer_req,
          stuck_step, misconception, level, pace, lang, anon_id, sample, created_at)
      values (c.course, c.task, c.chr,
        (array[0,1,1,2,2,3,4])[1 + floor(random()*7)::int], 4,
        (array[2,2,3,3,3,4,4,5])[1 + floor(random()*8)::int], 6 + floor(random()*14)::int,
        (array[0,0,0,1,2])[1 + floor(random()*5)::int],
        case when random() < 0.55 then st[3] when random() < 0.6 then st[2] else st[1] end,
        case when random() < 0.45 then mi[1] when random() < 0.35 then mi[2] else '' end,
        (array['Gentle','Balanced','Balanced','Tough'])[1 + floor(random()*4)::int],
        (array['Small steps','Medium steps','Medium steps','Big steps'])[1 + floor(random()*4)::int],
        (array['English','English','Français','Darija'])[1 + floor(random()*4)::int],
        anon, true, now() - (random() * interval '6 days'));
    end loop;
  end loop;
end $$;
revoke all on function public.seed_sample_data() from public, anon, authenticated;
select public.seed_sample_data();

-- Admin button before a presentation: default rules back + fresh sample data. Real students' data is untouched.
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.my_role() = 'admin' and public.is_demo()) then raise exception 'only the demo admin can reset the demo'; end if;
  update public.policy set chars = '{"MATH 1101":{"socrates":true,"talmid":true,"rival":false},"ECON 2301":{"socrates":true,"talmid":true,"rival":true},"SAD 3301":{"socrates":true,"talmid":true,"rival":true}}',
    max_hints = 4, min_group = 5, retention = '1 semester', challenge_min = 'Gentle', challenge_max = 'Tough',
    langs = array['English','Français','Darija','العربية'], updated_at = now() where id = 1;
  -- demo student starts fresh: Learning Snapshot again, empty private history (real students untouched)
  update public.profiles set data = '{}'::jsonb where user_id in (select user_id from public.user_roles where demo and role = 'student');
  delete from public.private_sessions where user_id in (select user_id from public.user_roles where demo and role = 'student');
  perform public.seed_sample_data();
end $$;
grant execute on function public.reset_demo() to authenticated;

-- Admins may change every rule (policy row), incl. allowed_domains.
drop policy if exists "admins change policy" on public.policy;
create policy "admins change policy" on public.policy for update using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
