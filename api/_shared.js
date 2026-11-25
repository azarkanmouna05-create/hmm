/* Shared server helpers (files starting with "_" are not routes on Vercel).
   - authAndPolicy: only signed-in users may spend AI quota; the admin policy is read AS that user.
   - chat: OpenAI-compatible call with a model fallback chain (busy/out-of-quota/retired → next model). */
import { DEFAULT_POLICY } from "../public/js/engine/engine.js";

const BASE = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
// One model or a comma-separated fallback chain. On the free tier each model has its own quota.
const MODELS = (process.env.AI_MODEL || "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemma-4-31b-it")
  .split(",").map((m) => m.trim()).filter(Boolean);
const KEY = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "";
const SB_URL = process.env.SUPABASE_URL || "", SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

export const bad = (status, error) => Response.json({ error }, { status });
export const aiConfigured = () => !!KEY;

export async function authAndPolicy(request) {
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

/* Returns { ok, text, model } or { ok:false, status, detail, tried }. */
export async function chat(messages, { temperature = 0.6, maxTokens = 600, json = false } = {}) {
  const call = (model, thinkingOff = true) => fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model, messages, temperature, max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      // Gemini "thinks" before answering by default; short turns don't need it and it eats the token budget.
      ...(thinkingOff && BASE.includes("generativelanguage") ? { reasoning_effort: "none" } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  let r, used, tried = [];
  for (const model of MODELS) {
    used = model;
    r = await call(model);
    if (r.status === 400) r = await call(model, false); // model may not accept reasoning_effort / json mode
    tried.push(`${model}:${r.status}`);
    if (![404, 429, 503].includes(r.status)) break;
  }
  if (!r.ok) return { ok: false, status: r.status, detail: (await r.text().catch(() => "")).slice(0, 1200), tried };
  const data = await r.json();
  return { ok: true, text: data.choices?.[0]?.message?.content || "", model: used };
}
