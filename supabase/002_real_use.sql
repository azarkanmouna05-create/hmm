-- hmm. migration 002: make the app safe for REAL use, while keeping the class demo working.
-- Run once in Supabase → SQL Editor, AFTER schema.sql. Safe to re-run.
--
-- What changes
--  1. Roles are ASSIGNED, not guessed from the email text. Everyone who signs up is a student unless their
--     email is on role_assignments (managed by admins). The old "contains admin/prof" demo rule is gone.
--  2. Only university emails can sign up (policy.allowed_domains, default aui.ma), unless pre-assigned.
--  3. Demo accounts are flagged. Their session data is stored as sample=true, and class_insights() only
--     mixes data of the same kind: real professors see real students only; demo professor sees demo data.

-- 1 · who gets which role
create table if not exists public.role_assignments (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('student','professor','admin')),
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.role_assignments enable row level security;
drop policy if exists "admins manage role assignments" on public.role_assignments;
create policy "admins manage role assignments" on public.role_assignments for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

insert into public.role_assignments (email, role, demo) values
  ('mouna@aui.ma', 'student', true),
  ('dr.salma.prof@aui.ma', 'professor', true),
  ('it.admin@aui.ma', 'admin', true)
on conflict (email) do update set role = excluded.role, demo = excluded.demo;

alter table public.user_roles add column if not exists demo boolean not null default false;

-- 2 · university emails only
alter table public.policy add column if not exists allowed_domains text[] not null default array['aui.ma'];

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
  return new;
end $$;

-- bring accounts created before this migration in line with the assignments
update public.user_roles r set role = coalesce(a.role, 'student'), demo = coalesce(a.demo, false)
from auth.users u left join public.role_assignments a on a.email = lower(u.email)
where r.user_id = u.id;

create or replace function public.is_demo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select demo from public.user_roles where user_id = auth.uid()), false);
$$;

-- 3 · demo data stays labelled and separate
drop policy if exists "students add own aggregate" on public.session_aggregates;
create policy "students add own aggregate" on public.session_aggregates for insert
  with check (public.my_role() = 'student'
              and anon_id = (select anon_id from public.profiles where user_id = auth.uid())
              and sample = public.is_demo());

create or replace function public.class_insights(p_course text, p_task uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare floor int; n int; uniq int; result jsonb; want_sample boolean := public.is_demo();
begin
  if public.my_role() not in ('professor','admin') then raise exception 'not allowed'; end if;
  select min_group into floor from public.policy where id = 1;
  create temp table if not exists _rows on commit drop as select * from public.session_aggregates limit 0;
  truncate _rows;
  insert into _rows select * from public.session_aggregates
    where course = p_course and (p_task is null or task_id = p_task) and sample = want_sample;
  select count(*), count(distinct anon_id) into n, uniq from _rows;
  if uniq < floor then
    return jsonb_build_object('hidden', true, 'students', uniq, 'floor', floor, 'sample', want_sample);
  end if;
  select jsonb_build_object(
    'hidden', false, 'sessions', n, 'students', uniq, 'floor', floor, 'sample', want_sample,
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
revoke all on function public.class_insights(text, uuid) from public, anon;
grant execute on function public.class_insights(text, uuid) to authenticated;

-- my_role() also tells the app whether this is a demo account
create or replace function public.my_account() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('role', role, 'demo', demo) from public.user_roles where user_id = auth.uid();
$$;
grant execute on function public.my_account() to authenticated;

-- rows that demo accounts created before this migration become sample data too
update public.session_aggregates set sample = true
where anon_id in (select p.anon_id from public.profiles p join public.user_roles r using (user_id) where r.demo);
