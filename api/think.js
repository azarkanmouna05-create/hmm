/* POST /api/think — the adaptive engine's one door to the AI.
   - The AI key lives only here (Vercel environment variable), never in the browser.
   - The system prompt is built HERE from the profile + policy, so a student can't edit the rules
     (e.g. "never reveal the answer", the hint limit, which characters a course allows).
   - Model-agnostic: any OpenAI-compatible chat endpoint works. Default = Google Gemini.
     Swap provider by changing AI_BASE_URL / AI_MODEL / AI_API_KEY in Vercel; no code change. */
import { CH, PACES, TONES, LEVELS, allowedChars, clampLevel, buildPrompt, parseReply, fallbackMeta } from "../public/js/engine/engine.js";

import { authAndPolicy, chat, bad, aiConfigured } from "./_shared.js";

const MAX_TURNS = 40, MAX_CHARS = 2000;
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

  if (!aiConfigured()) return bad(503, "AI is not configured (missing AI_API_KEY).");

  try {
    const r = await chat(convo);
    if (!r.ok) return Response.json({ error: `AI provider error ${r.status}`, detail: r.detail, tried: r.tried }, { status: 502 });
    const used = r.model, raw = r.text;
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
