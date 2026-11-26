-- hmm. migration 006: data for the wireframe charts. Run AFTER 005. Safe to re-run.
--  - class insights: how many students are enrolled (for "28/34 completed")
--  - campus stats: active students this week, adaptation split (Gentle/Balanced/Tough), answer requests per
--    course, and integrity alerts (a course whose answer-request rate is far above the campus average)
--  - class reminders ("Remind the class") reuse the invites table with kind = 'reminder'

alter table public.invites add column if not exists kind text not null default 'help';

create or replace function public.class_insights_unchecked(p_course text, p_task uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare floor int; n int; uniq int; result jsonb; demo_viewer boolean := public.is_demo(); enrolled int;
begin
  if public.my_role() not in ('professor','admin') then raise exception 'not allowed'; end if;
  select min_group into floor from public.policy where id = 1;
  -- class size: real enrollments, plus the sample class for demo viewers
  select count(*) into enrolled from public.enrollments e join public.user_roles r using (user_id)
    where e.course_code = p_course and (demo_viewer or not r.demo);
  create temp table if not exists _rows on commit drop as select * from public.session_aggregates limit 0;
  truncate _rows;
  insert into _rows select * from public.session_aggregates
    where course = p_course and (p_task is null or task_id = p_task) and (demo_viewer or not sample);
  select count(*), count(distinct anon_id) into n, uniq from _rows;
  if demo_viewer then enrolled := greatest(enrolled, (select count(distinct anon_id) from public.session_aggregates where course = p_course)); end if;
  if uniq < floor then
    return jsonb_build_object('hidden', true, 'students', uniq, 'floor', floor, 'enrolled', enrolled);
  end if;
  select jsonb_build_object(
    'hidden', false, 'sessions', n, 'students', uniq, 'floor', floor, 'enrolled', enrolled,
    'includes_sample', (select bool_or(sample) from _rows),
    'avg_conf', (select round(avg(conf)::numeric, 1) from _rows),
    'avg_hints', (select round(avg(hints)::numeric, 1) from _rows),
    'answer_requests', (select sum(coalesce(answer_req, 0)) from _rows),
    'stuck', (select coalesce(jsonb_agg(jsonb_build_object('label', stuck_step, 'n', c) order by c desc), '[]')
              from (select stuck_step, count(*) c from _rows where coalesce(stuck_step,'') not in ('','none') group by stuck_step) x),
    'misconceptions', (select coalesce(jsonb_agg(jsonb_build_object('label', misconception, 'n', c) order by c desc), '[]')
              from (select misconception, count(*) c from _rows where coalesce(misconception,'') not in ('','other') group by misconception) y),
    'chars', (select coalesce(jsonb_object_agg(char, c), '{}') from (select char, count(*) c from _rows group by char) z),
    'levels', (select coalesce(jsonb_object_agg(level, c), '{}') from (select level, count(*) c from _rows where level is not null group by level) l)
  ) into result;
  return result;
end $$;
revoke all on function public.class_insights_unchecked(text, uuid) from public, anon, authenticated;

create or replace function public.campus_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select * from public.session_aggregates),
       avg_rate as (select coalesce(sum(answer_req)::numeric / nullif(count(*), 0), 0) r from s)
  select case when public.my_role() <> 'admin' then null else jsonb_build_object(
    'students', (select count(*) from public.user_roles where role = 'student'),
    'professors', (select count(*) from public.user_roles where role = 'professor'),
    'active_week', (select count(distinct anon_id) from s where created_at > now() - interval '7 days'),
    'sessions_total', (select count(*) from s),
    'sessions_week', (select count(*) from s where created_at > now() - interval '7 days'),
    'sample_rows', (select count(*) from s where sample),
    'avg_conf', (select round(avg(conf)::numeric, 1) from s),
    'avg_hints', (select round(avg(hints)::numeric, 1) from s),
    'answer_requests', (select coalesce(sum(answer_req), 0) from s),
    'by_char', (select coalesce(jsonb_object_agg(char, n), '{}') from (select char, count(*) n from s group by char) a),
    'by_level', (select coalesce(jsonb_object_agg(level, n), '{}') from (select level, count(*) n from s where level is not null group by level) b),
    'by_course', (select coalesce(jsonb_agg(jsonb_build_object('course', c.code, 'name', c.name, 'demo', c.demo,
        'students', (select count(*) from public.enrollments e where e.course_code = c.code),
        'sessions', (select count(*) from s where s.course = c.code),
        'answer_requests', (select coalesce(sum(answer_req), 0) from s where s.course = c.code),
        'avg_conf', (select round(avg(conf)::numeric, 1) from s where s.course = c.code)) order by c.code), '[]')
      from public.courses c),
    -- integrity alert: ≥10 sessions and an answer-request rate at least 1.5× the campus average
    'alerts', (select coalesce(jsonb_agg(jsonb_build_object('course', x.course, 'rate', round(x.rate, 2), 'campus', round((select r from avg_rate), 2))), '[]')
      from (select course, sum(answer_req)::numeric / count(*) rate from s group by course having count(*) >= 10) x
      where x.rate >= 1.5 * (select r from avg_rate) and (select r from avg_rate) > 0)
  ) end;
$$;
grant execute on function public.campus_stats() to authenticated;

-- "Remind the class": professors of a course can post a reminder visible to its members.
drop policy if exists "professors create invites" on public.invites;
create policy "professors create invites" on public.invites for insert with check (
  exists (select 1 from public.teaching t where t.user_id = auth.uid() and t.course_code = course));

-- Sample class: SAD 3301 is answer-request heavy, so the demo always shows one integrity alert
-- (also after "Start the demo over", which re-runs this).
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
        case when c.course = 'SAD 3301' then (array[2,3,3,4,5])[1 + floor(random()*5)::int] else (array[0,0,0,1,2])[1 + floor(random()*5)::int] end,
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
