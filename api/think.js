/* POST /api/think — the adaptive engine's one door to the AI.
   - The AI key lives only here (Vercel environment variable), never in the browser.
   - The system prompt is built HERE from the profile + policy, so a student can't edit the rules
     (e.g. "never reveal the answer", the hint limit, which characters a course allows).
   - Model-agnostic: any OpenAI-compatible chat endpoint works. Default = Google Gemini.
     Swap provider by changing AI_BASE_URL / AI_MODEL / AI_API_KEY in Vercel; no code change. */
import { CH, DEFAULT_POLICY, PACES, TONES, LEVELS, allowedChars, clampLevel, buildPrompt, parseReply, fallbackMeta } from "../public/js/engine/engine.js";

const BASE = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
// One model or a comma-separated fallback chain. On the free tier each model has its own quota,
// so when one is busy (503), out of quota (429) or retired (404), the next one answers.
const MODELS = (process.env.AI_MODEL || "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemma-4-31b-it")
  .split(",").map((m) => m.trim()).filter(Boolean);
const KEY = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "";
const MAX_TURNS = 40, MAX_CHARS = 2000;
const SB_URL = process.env.SUPABASE_URL || "", SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

/* Only signed-in users may spend AI quota. The user's own token is checked with Supabase Auth, and the
   admin policy is read from the database AS that user (row-level security applies). */
async function authAndPolicy(request) {
  if (!SB_URL || !SB_KEY) return { ok: true, policy: DEFAULT_POLICY }; // local dev without Supabase
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false };
  const h = { apikey: SB_KEY, Authorization: `Bearer ${token}` };
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: h, signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!u?.ok) return { ok: false };
  const pr = await fetch(`${SB_URL}/rest/v1/policy?id=eq.1&select=*`, { headers: h, signal: AbortSignal.timeout(5000) }).catch(() => null);
  const row = pr?.ok ? (await pr.json())[0] : null;
  const policy = row ? { chars: row.chars, maxHints: row.max_hints, minGroup: row.min_group, retention: row.retention,
    challengeMin: row.challenge_min, challengeMax: row.challenge_max, langs: row.langs } : DEFAULT_POLICY;
  return { ok: true, policy };
}

const bad = (status, error) => Response.json({ error }, { status });
const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return bad(400, "Bad JSON"); }
  const { char, task = {}, profile = {}, state = {}, messages = [] } = body || {};

  const auth = await authAndPolicy(request);
  if (!auth.ok) return bad(401, "Please sign in again.");
  const policy = auth.policy;

  // ---- enforce rules server-side ----
  if (!CH[char]) return bad(400, "Unknown character");
  if (task.course && !allowedChars(policy, task.course).includes(char))
    return bad(403, `${CH[char].name} is turned off for ${task.course} by your university.`);
  const maxHints = Math.min(Number(task.maxHints ?? policy.maxHints) || policy.maxHints, policy.maxHints);
  const hints = Number(state.hints) || 0;
  if (hints > maxHints) return bad(403, "No hints left for this task.");
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_TURNS) return bad(400, "Bad conversation");

  const s = {
    char,
    task: { course: String(task.course || "").slice(0, 20), topic: String(task.topic || "").slice(0, 300), instructions: String(task.instructions || "").slice(0, 600) },
    profile: {
      langs: (Array.isArray(profile.langs) ? profile.langs : ["English"]).filter((l) => policy.langs.includes(l)).slice(0, 4),
      snap: { stuck: profile.snap?.stuck },
      noticed: profile.noticed?.confirmed ? { text: String(profile.noticed.text).slice(0, 160), confirmed: true } : null,
    },
    pace: pick(state.pace, PACES, "Medium steps"),
    level: clampLevel(pick(state.level, LEVELS, "Balanced"), policy),
    tone: pick(state.tone, TONES, "Encouraging"),
    maxHints,
  };
  if (!s.profile.langs.length) s.profile.langs = ["English"];

  const convo = [
    { role: "system", content: buildPrompt(s, policy) },
    ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, MAX_CHARS) })),
  ];

  if (!KEY) return bad(503, "AI is not configured (missing AI_API_KEY).");

  const call = (model, thinkingOff = true) => fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model, messages: convo, temperature: 0.6, max_tokens: 600,
      // Gemini "thinks" before answering by default; short Socratic turns don't need it and it eats the token budget.
      ...(thinkingOff && BASE.includes("generativelanguage") ? { reasoning_effort: "none" } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });

  try {
    let r, used, tried = [];
    for (const model of MODELS) {
      used = model;
      r = await call(model);
      if (r.status === 400) r = await call(model, false); // model may not accept reasoning_effort
      tried.push(`${model}:${r.status}`);
      if (![404, 429, 503].includes(r.status)) break;
    }
    if (!r.ok) {
      // Pass the provider's own message through (it never contains the key) so setup problems are diagnosable.
      const detail = (await r.text().catch(() => "")).slice(0, 1200);
      return Response.json({ error: `AI provider error ${r.status}`, detail, tried }, { status: 502 });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || "";
    let { text, meta, found } = parseReply(raw);
    if (!text) return bad(502, "Empty reply");
    if (!found || !meta.note) {
      const lastUser = [...messages].reverse().find((m) => m.role !== "assistant")?.content || "";
      const fb = fallbackMeta(String(lastUser), s);
      meta = found ? { ...meta, note: fb.note, fallback: true } : fb;
    }
    return Response.json({ text, meta, model: used, adapted: { pace: s.pace, level: s.level, tone: s.tone, maxHints } });
  } catch {
    return bad(504, "AI timed out");
  }
}
