-- hmm. migration 005: a demo with a story. Run AFTER 004. Safe to re-run.
--  - a second demo student, Ines (ines.demo@aui.ma), who has used hmm. for a few weeks:
--    past sessions + reflections, skills, a profile that already adapted, a pending "hmm. noticed", and a
--    help-session invite (she found MATH hard)
--  - 2–3 sample tasks per course (a believable semester)
--  - "Start the demo over" also removes tasks/notes/invites the DEMO professor made during a demo
--  Real students and real professors are never touched.

insert into public.role_assignments (email, role, demo) values ('ines.demo@aui.ma', 'student', true)
on conflict (email) do update set role = 'student', demo = true;

-- Seed Ines's profile (private to her, like any student) and her anonymised class rows.
create or replace function public.seed_returning_student(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare anon text;
begin
  insert into public.profiles (user_id, data) values (p_user, '{}'::jsonb) on conflict (user_id) do nothing;
  update public.profiles set updated_at = now(), data = jsonb_build_object(
    'name', 'Ines', 'program', 'BAI · 2nd year', 'langs', jsonb_build_array('English', 'Français'),
    'hintPace', 'Medium steps', 'challenge', 'Balanced', 'tone', 'Encouraging',
    'snap', jsonb_build_object('stuck', 'answer', 'hard', 'calculus', 'done', 1),
    'skills', jsonb_build_object('solve', 7, 'explain', 4, 'argue', 4),
    'sessions', 4,
    'lastChange', 'You felt 5/5 with 0 hints, so hmm. now takes medium steps.',
    'noticed', jsonb_build_object('text', 'You do better when you see a worked example first, then try your own.', 'confirmed', null),
    'history', jsonb_build_array(
      jsonb_build_object('course', 'MATH 1101', 'char', 'socrates', 'topic', 'Find the derivative of x² · sin x', 'conf', 2, 'hints', 4,
        'stuck', 'Putting the two terms together', 'unlocked', 'Socrates asked what f′g means on its own', 'ts', (extract(epoch from now() - interval '12 days') * 1000)::bigint),
      jsonb_build_object('course', 'MATH 1101', 'char', 'socrates', 'topic', 'Derivative of eˣ · cos x', 'conf', 3, 'hints', 2,
        'stuck', 'Sign of the derivative of cos x', 'unlocked', 'A worked example with sin x first', 'ts', (extract(epoch from now() - interval '8 days') * 1000)::bigint),
      jsonb_build_object('course', 'ECON 2301', 'char', 'talmid', 'topic', 'Explain why demand curves slope downward', 'conf', 4, 'hints', 0,
        'stuck', 'Separating income and substitution effects', 'unlocked', 'Talmid asked about tea vs coffee', 'ts', (extract(epoch from now() - interval '5 days') * 1000)::bigint),
      jsonb_build_object('course', 'SAD 3301', 'char', 'rival', 'topic', 'Agile is always better than Waterfall', 'conf', 5, 'hints', 0,
        'stuck', 'The regulated-project counterexample', 'unlocked', 'Narrowing my claim to changing requirements', 'ts', (extract(epoch from now() - interval '2 days') * 1000)::bigint)
    )) where user_id = p_user
  returning anon_id into anon;
  insert into public.enrollments (user_id, course_code) select p_user, code from public.courses where demo on conflict do nothing;
  delete from public.session_aggregates where anon_id = anon;
  insert into public.session_aggregates (course, task_id, char, hints, max_hints, conf, mins, answer_req, stuck_step, level, pace, lang, anon_id, sample, created_at) values
    ('MATH 1101', '00000000-0000-4000-8000-000000000101', 'socrates', 4, 4, 2, 14, 3, 'combine with product rule', 'Gentle', 'Small steps', 'English', anon, true, now() - interval '12 days'),
    ('ECON 2301', '00000000-0000-4000-8000-000000000201', 'talmid', 0, 4, 4, 9, 0, 'substitution effect', 'Balanced', 'Medium steps', 'English', anon, true, now() - interval '5 days'),
    ('SAD 3301', '00000000-0000-4000-8000-000000000301', 'rival', 0, 4, 5, 11, 0, 'handle a counterexample', 'Balanced', 'Medium steps', 'English', anon, true, now() - interval '2 days');
end $$;
revoke all on function public.seed_returning_student(uuid) from public, anon, authenticated;

-- Demo accounts get their setup when created (Ines also gets her history).
create or replace function public.setup_demo_account(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.enrollments (user_id, course_code) select p_user, code from public.courses where demo and p_role = 'student' on conflict do nothing;
  insert into public.teaching (user_id, course_code) select p_user, code from public.courses where demo and p_role = 'professor' on conflict do nothing;
  if exists (select 1 from auth.users where id = p_user and lower(email) = 'ines.demo@aui.ma') then
    perform public.seed_returning_student(p_user);
  end if;
end $$;
revoke all on function public.setup_demo_account(uuid, text) from public, anon, authenticated;

-- More sample tasks: a believable semester.
insert into public.tasks (id, course, kind, topic, instructions, steps, misconceptions, due, sample) values
  ('00000000-0000-4000-8000-000000000102','MATH 1101','problem','Find the derivative of eˣ · cos x','Product rule again; watch the sign.',
    array['identify f and g','differentiate f and g','combine with product rule'], array['wrong sign on the derivative of cos x','multiplies the derivatives'], current_date + 12, true),
  ('00000000-0000-4000-8000-000000000103','MATH 1101','concept','Explain what a derivative means, without formulas','Teach it to Talmid.',
    array['rate of change','slope of the tangent','limit idea'], array['thinks the derivative is the function value'], current_date + 19, true),
  ('00000000-0000-4000-8000-000000000202','ECON 2301','claim','Rent control always helps tenants','Defend or refine this claim against the Rival.',
    array['state the mechanism','give evidence','handle a counterexample'], array['ignores supply response','treats short run as long run'], current_date + 14, true),
  ('00000000-0000-4000-8000-000000000302','SAD 3301','problem','Draw the use-case boundary for a library loan system','Work it out step by step with Socrates.',
    array['identify actors','list use cases','decide what is outside the system'], array['puts the database as an actor'], current_date + 16, true)
on conflict (id) do update set due = excluded.due;

-- "Start the demo over": also clean up what the demo professor created during a demo.
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if not (public.my_role() = 'admin' and public.is_demo()) then raise exception 'only the demo admin can reset the demo'; end if;
  update public.policy set chars = '{"MATH 1101":{"socrates":true,"talmid":true,"rival":false},"ECON 2301":{"socrates":true,"talmid":true,"rival":true},"SAD 3301":{"socrates":true,"talmid":true,"rival":true}}',
    max_hints = 4, min_group = 5, retention = '1 semester', challenge_min = 'Gentle', challenge_max = 'Tough',
    langs = array['English','Français','Darija','العربية'], updated_at = now() where id = 1;
  delete from public.tasks where not sample and created_by in (select user_id from public.user_roles where demo);
  delete from public.plans where user_id in (select user_id from public.user_roles where demo);
  delete from public.invites where created_by in (select user_id from public.user_roles where demo);
  -- demo students: Mouna fresh (Learning Snapshot), Ines back to her few weeks of history
  for u in select r.user_id, lower(a.email) email from public.user_roles r join auth.users a on a.id = r.user_id where r.demo and r.role = 'student' loop
    delete from public.private_sessions where user_id = u.user_id;
    if u.email = 'ines.demo@aui.ma' then perform public.seed_returning_student(u.user_id);
    else update public.profiles set data = '{}'::jsonb where user_id = u.user_id; end if;
  end loop;
  perform public.seed_sample_data();
  -- a help-session invite in MATH (Ines found it hard, so she sees it; nobody learns who)
  insert into public.invites (course, topic, "when", created_by)
    select 'MATH 1101', 'Help session · MATH 1101', 'Thu 4pm · Building 8, room 104', r.user_id
    from public.user_roles r where r.demo and r.role = 'professor' limit 1;
end $$;
grant execute on function public.reset_demo() to authenticated;

-- If Ines already exists (e.g. the button was tapped before this script ran), make her the demo account and seed her.
update public.user_roles set role = 'student', demo = true
where user_id in (select id from auth.users where lower(email) = 'ines.demo@aui.ma');
select public.seed_returning_student(u.id) from auth.users u where lower(u.email) = 'ines.demo@aui.ma';

-- One help-session invite exists from the start of the demo.
insert into public.invites (course, topic, "when", created_by)
select 'MATH 1101', 'Help session · MATH 1101', 'Thu 4pm · Building 8, room 104', r.user_id
from public.user_roles r where r.demo and r.role = 'professor'
  and not exists (select 1 from public.invites i where i.course = 'MATH 1101' and i.created_by = r.user_id)
limit 1;
