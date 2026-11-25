-- hmm. database schema (Supabase / Postgres). Run once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: everything is "if not exists" / "or replace".
--
-- Privacy model
--   PRIVATE (owner only):  profiles, private_sessions (chat + reflection text)
--   SHARED (anonymised):   session_aggregates: course, task, character, hints, confidence, stuck step,
--                          misconception. Never names, emails or chat text.
--   Professors never read session_aggregates directly: they call class_insights(), which returns
--   patterns only when the group has at least policy.min_group distinct students (the privacy floor).

-- ───────────────────────── roles ─────────────────────────
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','professor','admin'))
);
alter table public.user_roles enable row level security;
drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles for select using (auth.uid() = user_id);

-- Role comes from the account (no role picker). Demo rule, same as the prototype:
-- email containing "admin" → admin; "prof" or starting with "dr" → professor; otherwise student.
create or replace function public.role_for_email(email text) returns text language sql immutable as $$
  select case
    when lower(email) like '%admin%' then 'admin'
    when lower(email) like '%prof%' or lower(email) like 'dr%' then 'professor'
    else 'student' end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, public.role_for_email(new.email))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

-- ───────────────────────── policy (admin rules) ─────────────────────────
create table if not exists public.policy (
  id int primary key default 1 check (id = 1),
  chars jsonb not null default '{"MATH 1101":{"socrates":true,"talmid":true,"rival":false},"ECON 2301":{"socrates":true,"talmid":true,"rival":true},"SAD 3301":{"socrates":true,"talmid":true,"rival":true}}',
  max_hints int not null default 4 check (max_hints between 0 and 10),
  min_group int not null default 5 check (min_group >= 3),
  retention text not null default '1 semester',
  challenge_min text not null default 'Gentle',
  challenge_max text not null default 'Tough',
  langs text[] not null default array['English','Français','Darija','العربية'],
  updated_at timestamptz not null default now()
);
insert into public.policy (id) values (1) on conflict (id) do nothing;
alter table public.policy enable row level security;
drop policy if exists "everyone signed in reads policy" on public.policy;
create policy "everyone signed in reads policy" on public.policy for select using (auth.role() = 'authenticated');
drop policy if exists "admins change policy" on public.policy;
create policy "admins change policy" on public.policy for update using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ───────────────────────── student-private ─────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,       -- learner profile: snapshot, pace, tone, challenge, langs, noticed…
  anon_id text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 12), -- links aggregates without identity
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.private_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  char text not null, task jsonb not null default '{}'::jsonb,
  msgs jsonb not null default '[]'::jsonb,       -- the dialogue: only the student ever sees this
  reflection jsonb,                              -- where stuck / what unlocked / confidence
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.private_sessions enable row level security;
drop policy if exists "own sessions" on public.private_sessions;
create policy "own sessions" on public.private_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────────────────── shared, anonymised ─────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  course text not null, kind text not null check (kind in ('problem','concept','claim')),
  topic text not null, instructions text default '', steps text[] default '{}', misconceptions text[] default '{}',
  max_hints int, due date, status text not null default 'published', sample boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
drop policy if exists "signed in read tasks" on public.tasks;
create policy "signed in read tasks" on public.tasks for select using (auth.role() = 'authenticated');
drop policy if exists "professors write tasks" on public.tasks;
create policy "professors write tasks" on public.tasks for insert with check (public.my_role() = 'professor');
drop policy if exists "professors edit own tasks" on public.tasks;
create policy "professors edit own tasks" on public.tasks for update using (public.my_role() = 'professor' and created_by = auth.uid());

create table if not exists public.session_aggregates (
  id bigint generated always as identity primary key,
  course text not null, task_id uuid references public.tasks(id) on delete set null,
  char text not null, suggested text,
  hints int, max_hints int, conf int check (conf between 1 and 5), mins int, answer_req int,
  stuck_step text, misconception text, level text, pace text, lang text,
  anon_id text not null,                          -- random per student, NOT the user id
  sample boolean not null default false,          -- demo data is labelled as sample in the UI
  created_at timestamptz not null default now()
);
alter table public.session_aggregates enable row level security;
-- Students may add a row, but only with their own anon id. Nobody can select rows directly.
drop policy if exists "students add own aggregate" on public.session_aggregates;
create policy "students add own aggregate" on public.session_aggregates for insert
  with check (public.my_role() = 'student'
              and anon_id = (select anon_id from public.profiles where user_id = auth.uid()));

-- The privacy floor, enforced in the database: professors/admins get class patterns only for groups ≥ min_group.
create or replace function public.class_insights(p_course text, p_task uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare floor int; n int; uniq int; result jsonb;
begin
  if public.my_role() not in ('professor','admin') then raise exception 'not allowed'; end if;
  select min_group into floor from public.policy where id = 1;
  select count(*), count(distinct anon_id) into n, uniq from public.session_aggregates
    where course = p_course and (p_task is null or task_id = p_task);
  if uniq < floor then
    return jsonb_build_object('hidden', true, 'students', uniq, 'floor', floor);
  end if;
  select jsonb_build_object(
    'hidden', false, 'sessions', n, 'students', uniq, 'floor', floor,
    'sample', bool_or(sample),
    'avg_conf', round(avg(conf)::numeric, 1), 'avg_hints', round(avg(hints)::numeric, 1),
    'answer_requests', sum(coalesce(answer_req,0)),
    'stuck', (select coalesce(jsonb_agg(jsonb_build_object('label', stuck_step, 'n', c) order by c desc), '[]')
              from (select stuck_step, count(*) c from public.session_aggregates
                    where course = p_course and (p_task is null or task_id = p_task)
                      and coalesce(stuck_step,'') not in ('','none') group by stuck_step) x),
    'misconceptions', (select coalesce(jsonb_agg(jsonb_build_object('label', misconception, 'n', c) order by c desc), '[]')
              from (select misconception, count(*) c from public.session_aggregates
                    where course = p_course and (p_task is null or task_id = p_task)
                      and coalesce(misconception,'') not in ('','other') group by misconception) y),
    'chars', (select coalesce(jsonb_object_agg(char, c), '{}')
              from (select char, count(*) c from public.session_aggregates
                    where course = p_course and (p_task is null or task_id = p_task) group by char) z)
  ) into result
  from public.session_aggregates where course = p_course and (p_task is null or task_id = p_task);
  return result;
end $$;
revoke all on function public.class_insights(text, uuid) from public, anon;
grant execute on function public.class_insights(text, uuid) to authenticated;

-- Anonymous help-session invites: professors create them; a student sees one only if their OWN private
-- history shows low confidence on that task (checked in the app against the student's private data).
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  course text not null, task_id uuid references public.tasks(id) on delete cascade,
  topic text, "when" text, created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
drop policy if exists "signed in read invites" on public.invites;
create policy "signed in read invites" on public.invites for select using (auth.role() = 'authenticated');
drop policy if exists "professors create invites" on public.invites;
create policy "professors create invites" on public.invites for insert with check (public.my_role() = 'professor');

-- Sample task used by the demo Home screen (labelled "Sample" in the UI).
insert into public.tasks (id, course, kind, topic, instructions, steps, misconceptions, due, sample)
values ('00000000-0000-4000-8000-000000000101', 'MATH 1101', 'problem', 'Find the derivative of x² · sin x',
        'Use the product rule.', array['identify f and g','differentiate f and g','combine with product rule'],
        array['multiplies the derivatives','forgets one term'], current_date + 5, true)
on conflict (id) do nothing;
