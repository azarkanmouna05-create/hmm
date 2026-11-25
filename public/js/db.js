/* Supabase client: auth + data. Local-first: reads are cached on the device so screens open instantly,
   then refreshed from the database (the approach the course recommends for snappy mobile apps). */
import { DEFAULT_POLICY } from "./engine/engine.js";

let client = null, configured = false;
const cache = {
  get(k, d) { try { const v = localStorage.getItem("hmm.c." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hmm.c." + k, JSON.stringify(v)); } catch {} },
  clear() { try { Object.keys(localStorage).filter((k) => k.startsWith("hmm.")).forEach((k) => localStorage.removeItem(k)); } catch {} },
};

export async function initDb() {
  if (client) return client;
  try {
    const cfg = await (await fetch("/api/config")).json();
    configured = cfg.configured;
    if (configured && window.supabase) {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "hmm.auth" },
      });
    }
  } catch { configured = false; }
  return client;
}
export const isConfigured = () => configured;

/* ---------- auth ---------- */
export async function currentUser() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user || null;
}
export async function accessToken() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token || null;
}
export async function signIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw friendly(error);
  return data.user;
}
export async function signUp(email, password) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw friendly(error);
  if (!data.session) throw new Error("Check your inbox to confirm your email, then sign in.");
  return data.user;
}
export async function resetPassword(email) {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/#/login" });
  if (error) throw friendly(error);
}
export async function demoEnabled() {
  try { return (await (await fetch("/api/demo-login")).json()).enabled; } catch { return false; }
}
export async function demoSignIn(role) {
  const r = await fetch("/api/demo-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Demo sign-in failed.");
  const { error } = await client.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
  if (error) throw friendly(error);
}
export async function signOut() { await client?.auth.signOut(); cache.clear(); }

function friendly(e) {
  const m = String(e.message || e);
  if (/invalid login credentials/i.test(m)) return new Error("That email and password don't match. Try again, or reset your password.");
  if (/already registered/i.test(m)) return new Error("You already have an account. Sign in instead.");
  if (/password/i.test(m) && /6/.test(m)) return new Error("Use at least 6 characters for your password.");
  if (/university email|database error saving new user/i.test(m)) return new Error("Please use your university email (for example name@aui.ma).");
  if (/rate limit/i.test(m)) return new Error("Too many tries. Wait a minute and try again.");
  return new Error(m);
}

/* ---------- role, policy ---------- */
export async function myRole() { return (await myAccount()).role; }
export async function myAccount() {
  const cached = cache.get("account", null);
  if (!client) return cached || { role: "student", demo: true };
  let { data, error } = await client.rpc("my_account");
  if (error) { // migration 002 not run yet: fall back to the role table
    const r = await client.from("user_roles").select("role").maybeSingle();
    data = r.data ? { role: r.data.role, demo: false } : null;
  }
  const acct = data || cached || { role: "student", demo: false };
  cache.set("account", acct);
  return acct;
}
export async function getPolicy() {
  if (!client) return DEFAULT_POLICY;
  const { data } = await client.from("policy").select("*").eq("id", 1).maybeSingle();
  if (!data) return cache.get("policy", DEFAULT_POLICY);
  const p = { chars: data.chars, maxHints: data.max_hints, minGroup: data.min_group, retention: data.retention,
    challengeMin: data.challenge_min, challengeMax: data.challenge_max, langs: data.langs };
  cache.set("policy", p);
  return p;
}

/* ---------- student-private ---------- */
export function cachedProfile() { return cache.get("profile", null); }
export async function loadProfile() {
  if (!client) return cachedProfile();
  const { data } = await client.from("profiles").select("data, anon_id").maybeSingle();
  if (!data) return null;
  const p = Object.keys(data.data || {}).length ? { ...data.data, anon: data.anon_id } : null;
  cache.set("profile", p);
  return p;
}
export async function saveProfile(p) {
  cache.set("profile", p);
  if (!client) return;
  const user = await currentUser();
  const { anon, ...data } = p;
  await client.from("profiles").upsert({ user_id: user.id, data, updated_at: new Date().toISOString() });
}
export async function savePrivateSession(s) {
  if (!client) return;
  const row = { char: s.char, task: s.task, msgs: s.msgs.filter((m) => !m.err && !m.pending), reflection: s.reflection || null, updated_at: new Date().toISOString() };
  if (s.dbId) await client.from("private_sessions").update(row).eq("id", s.dbId);
  else {
    const { data } = await client.from("private_sessions").insert(row).select("id").single();
    if (data) s.dbId = data.id;
  }
}

/* ---------- shared, anonymised ---------- */
export async function addAggregate(row) {
  if (!client) return;
  await client.from("session_aggregates").insert(row);
}
export function cachedCourses() { return cache.get("courses", []); }
export async function myCourses() {
  if (!client) return cachedCourses();
  const { data, error } = await client.rpc("my_courses");
  if (error) return cachedCourses();          // migration 003 not run yet
  cache.set("courses", data || []);
  return data || [];
}
export async function joinCourse(code) {
  const { data, error } = await client.rpc("join_course", { p_code: code });
  if (error) {
    if (/no course/i.test(error.message)) throw new Error("No course has that code. Check it with your professor.");
    if (/only students/i.test(error.message)) throw new Error("Only student accounts join courses.");
    throw new Error("Couldn’t join right now. Try again in a moment.");
  }
  await myCourses();
  return data;
}
export async function getTasks() {
  if (!client) return cache.get("tasks", []);
  const { data } = await client.from("tasks").select("*").eq("status", "published").order("due");
  cache.set("tasks", data || []);
  return data || [];
}

/* ---------- professor ---------- */
const rpc = async (fn, args = {}) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    if (/schema cache|does not exist|PGRST202/i.test(error.message + error.code))
      throw new Error("This screen needs the last database setup step: run supabase/004_staff_and_sample.sql in Supabase → SQL Editor.");
    throw new Error(error.message.replace(/^hmm: /, ""));
  }
  return data;
};
export const classInsights = (course, task = null) => rpc("class_insights", { p_course: course, p_task: task });
export async function createTask(t) {
  const { data, error } = await client.from("tasks").insert(t).select().single();
  if (error) throw new Error(/row-level security/.test(error.message) ? "You can only post to courses you teach." : error.message);
  return data;
}
export async function createInvite(inv) { const { error } = await client.from("invites").insert(inv); if (error) throw new Error(error.message); }
export async function listInvites() { const { data } = await client.from("invites").select("*").order("created_at", { ascending: false }); return data || []; }
export async function addPlan(course, text) { const { error } = await client.from("plans").insert({ course, text }); if (error) throw new Error(error.message); }
export async function listPlans() { const { data } = await client.from("plans").select("*").order("created_at", { ascending: false }); return data || []; }

/* ---------- admin ---------- */
export const campusStats = () => rpc("campus_stats");
export const assignTeacher = (email, course) => rpc("assign_teacher", { p_email: email, p_course: course });
export const createCourse = (code, name) => rpc("create_course", { p_code: code, p_name: name });
export const courseTeachers = () => rpc("course_teachers");
export const resetDemo = () => rpc("reset_demo");
export const applyRetention = () => rpc("apply_retention");
export async function updatePolicy(p) {
  const row = { chars: p.chars, max_hints: p.maxHints, min_group: p.minGroup, retention: p.retention,
    challenge_min: p.challengeMin, challenge_max: p.challengeMax, langs: p.langs, updated_at: new Date().toISOString() };
  if (p.allowedDomains) row.allowed_domains = p.allowedDomains;
  const { error } = await client.from("policy").update(row).eq("id", 1);
  if (error) throw new Error(error.message);
  cache.set("policy", p);
}
export async function policyDomains() { const { data } = await client.from("policy").select("allowed_domains").eq("id", 1).maybeSingle(); return data?.allowed_domains || ["aui.ma"]; }
