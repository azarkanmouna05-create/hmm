-- hmm. migration 003: real courses with join codes. Run AFTER schema.sql and 002_real_use.sql. Safe to re-run.
--
--  - courses: code (e.g. "MATH 1101"), name, join_code the professor shares in class
--  - enrollments: which student is in which course (private to that student)
--  - teaching: which professor teaches which course (assigned by admins)
--  - join_course(code): the ONLY way to enroll, so only people with the class code get in
--  - my_courses(): your courses (student: enrolled; professor: teaching, with the join code; admin: all)
--  - class insights only for courses you teach; students only log data for courses they are in

create table if not exists public.courses (
  code text primary key,
  name text not null,
  join_code text not null unique check (join_code = upper(join_code)),
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses" on public.courses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_code text not null references public.courses(code) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, course_code)
);
alter table public.enrollments enable row level security;
drop policy if exists "see own enrollments" on public.enrollments;
create policy "see own enrollments" on public.enrollments for select using (auth.uid() = user_id);
drop policy if exists "leave own courses" on public.enrollments;
create policy "leave own courses" on public.enrollments for delete using (auth.uid() = user_id);

create table if not exists public.teaching (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_code text not null references public.courses(code) on delete cascade,
  primary key (user_id, course_code)
);
alter table public.teaching enable row level security;
drop policy if exists "see own teaching" on public.teaching;
create policy "see own teaching" on public.teaching for select using (auth.uid() = user_id or public.my_role() = 'admin');
drop policy if exists "admins assign teaching" on public.teaching;
create policy "admins assign teaching" on public.teaching for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Demo courses (labelled demo; their join codes can be shown in the presentation).
insert into public.courses (code, name, join_code, demo) values
  ('MATH 1101', 'Calculus I', 'CALC-7Q2K', true),
  ('ECON 2301', 'Microeconomics', 'MICRO-4M8T', true),
  ('SAD 3301', 'Systems Analysis & Design', 'SAD-9H3P', true)
on conflict (code) do update set name = excluded.name, demo = excluded.demo;

-- Join with the code the professor shared.
create or replace function public.join_course(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.courses;
begin
  if public.my_role() <> 'student' then raise exception 'hmm: only students join courses'; end if;
  select * into c from public.courses where join_code = upper(trim(p_code));
  if c.code is null then raise exception 'hmm: no course with that code'; end if;
  insert into public.enrollments (user_id, course_code) values (auth.uid(), c.code) on conflict do nothing;
  return jsonb_build_object('code', c.code, 'name', c.name);
end $$;
revoke all on function public.join_course(text) from public, anon;
grant execute on function public.join_course(text) to authenticated;

-- Your courses. Class size = number of students who joined (a count, never names).
create or replace function public.my_courses() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', c.code, 'name', c.name, 'demo', c.demo,
      'students', (select count(*) from public.enrollments e where e.course_code = c.code),
      'join_code', case when public.my_role() in ('professor','admin') then c.join_code end
    ) order by c.code), '[]'::jsonb)
  from public.courses c
  where (public.my_role() = 'student' and exists (select 1 from public.enrollments e where e.course_code = c.code and e.user_id = auth.uid()))
     or (public.my_role() = 'professor' and exists (select 1 from public.teaching t where t.course_code = c.code and t.user_id = auth.uid()))
     or public.my_role() = 'admin';
$$;
grant execute on function public.my_courses() to authenticated;

-- Students only add anonymised rows for courses they are actually in.
drop policy if exists "students add own aggregate" on public.session_aggregates;
create policy "students add own aggregate" on public.session_aggregates for insert
  with check (public.my_role() = 'student'
              and anon_id = (select anon_id from public.profiles where user_id = auth.uid())
              and sample = public.is_demo()
              and exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.course_code = course));

-- Professors: insights only for the courses they teach (admins: all). Wraps the 002 version.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'class_insights_unchecked') then
    alter function public.class_insights(text, uuid) rename to class_insights_unchecked;
  end if;
end $$;
-- Demo viewers (the demo professor/admin) see EVERYONE in their courses: classmates who signed up as
-- themselves plus labelled sample data. Real professors see real students only.
create or replace function public.class_insights_unchecked(p_course text, p_task uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare floor int; n int; uniq int; result jsonb; demo_viewer boolean := public.is_demo();
begin
  if public.my_role() not in ('professor','admin') then raise exception 'not allowed'; end if;
  select min_group into floor from public.policy where id = 1;
  create temp table if not exists _rows on commit drop as select * from public.session_aggregates limit 0;
  truncate _rows;
  insert into _rows select * from public.session_aggregates
    where course = p_course and (p_task is null or task_id = p_task) and (demo_viewer or not sample);
  select count(*), count(distinct anon_id) into n, uniq from _rows;
  if uniq < floor then
    return jsonb_build_object('hidden', true, 'students', uniq, 'floor', floor);
  end if;
  select jsonb_build_object(
    'hidden', false, 'sessions', n, 'students', uniq, 'floor', floor,
    'includes_sample', (select bool_or(sample) from _rows),
    'avg_conf', (select round(avg(conf)::numeric, 1) from _rows),
    'avg_hints', (select round(avg(hints)::numeric, 1) from _rows),
    'answer_requests', (select sum(coalesce(answer_req, 0)) from _rows),
    'stuck', (select coalesce(jsonb_agg(jsonb_build_object('label', stuck_step, 'n', c) order by c desc), '[]')
              from (select stuck_step, count(*) c from _rows where coalesce(stuck_step,'') not in ('','none') group by stuck_step) x),
    'misconceptions', (select coalesce(jsonb_agg(jsonb_build_object('label', misconception, 'n', c) order by c desc), '[]')
              from (select misconception, count(*) c from _rows where coalesce(misconception,'') not in ('','other') group by misconception) y),
    'chars', (select coalesce(jsonb_object_agg(char, c), '{}') from (select char, count(*) c from _rows group by char) z)
  ) into result;
  return result;
end $$;
revoke all on function public.class_insights_unchecked(text, uuid) from public, anon, authenticated;
create or replace function public.class_insights(p_course text, p_task uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not (public.my_role() = 'admin'
          or exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = p_course)) then
    raise exception 'hmm: you do not teach this course';
  end if;
  return public.class_insights_unchecked(p_course, p_task);
end $$;
revoke all on function public.class_insights(text, uuid) from public, anon;
grant execute on function public.class_insights(text, uuid) to authenticated;

-- Demo accounts: demo student is in all demo courses; demo professor teaches them.
create or replace function public.setup_demo_account(p_user uuid, p_role text) returns void
language sql security definer set search_path = public as $$
  insert into public.enrollments (user_id, course_code) select p_user, code from public.courses where demo and p_role = 'student'
    on conflict do nothing;
  insert into public.teaching (user_id, course_code) select p_user, code from public.courses where demo and p_role = 'professor'
    on conflict do nothing;
$$;
revoke all on function public.setup_demo_account(uuid, text) from public, anon, authenticated;

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
  return new;
end $$;

-- demo accounts that already exist
select public.setup_demo_account(r.user_id, r.role) from public.user_roles r where r.demo;

-- Tasks: students see tasks of courses they are in; professors post only to courses they teach.
drop policy if exists "signed in read tasks" on public.tasks;
drop policy if exists "course members read tasks" on public.tasks;
create policy "course members read tasks" on public.tasks for select using (
  public.my_role() = 'admin'
  or exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.course_code = tasks.course)
  or exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = tasks.course));
drop policy if exists "professors write tasks" on public.tasks;
create policy "professors write tasks" on public.tasks for insert with check (
  public.my_role() = 'professor'
  and exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = course));
-- NOTE: run the scripts in order (schema → 002 → 003). Re-running 002 after 003 would undo the course check.
