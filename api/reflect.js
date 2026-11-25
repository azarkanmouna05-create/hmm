/* POST /api/reflect — after a session, extract what the class-level insights and the profile need.
   Ported from the prototype's post-session extraction. Returns ONLY labels, never quotes or names.
   If the AI is unavailable, returns rule-based fallbacks so the reflection still saves. */
import { CH } from "../public/js/engine/engine.js";
import { authAndPolicy, chat, bad, aiConfigured } from "./_shared.js";

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function POST(request) {
  const auth = await authAndPolicy(request);
  if (!auth.ok) return bad(401, "Please sign in again.");
  let b; try { b = await request.json(); } catch { return bad(400, "Bad JSON"); }
  const { char, task = {}, hints = 0, maxHints = 4, conf = 3, stuck = "", unlocked = "", transcript = [], step = "" } = b || {};
  if (!CH[char]) return bad(400, "Unknown character");

  const steps = Array.isArray(task.steps) ? task.steps.slice(0, 10).map((x) => clip(x, 60)) : [];
  const mis = Array.isArray(task.misconceptions) ? task.misconceptions.slice(0, 10).map((x) => clip(x, 60)) : [];
  const fallback = { stuckStep: steps[0] || clip(step, 40) || "", misconception: "", noticed: "", fallback: true };
  if (!aiConfigured()) return Response.json(fallback);

  const lines = (Array.isArray(transcript) ? transcript : []).slice(-30)
    .map((m) => (m.role === "assistant" ? CH[char].name : "Student") + ": " + clip(m.content, 400)).join("\n").slice(-6000);

  const prompt = `You analyse one study session in a Socratic learning app. Return ONLY JSON: {"stuckStep": string, "misconception": string, "noticed": string}.
- stuckStep: ${steps.length ? "exactly one of " + JSON.stringify(steps) + ' or "none"' : 'a 2-5 word label of the concept where the student got stuck, or "none"'}.
- misconception: ${mis.length ? "exactly one of " + JSON.stringify(mis) + ' or "other" or ""' : 'a 3-8 word label of their main misconception, or ""'}.
- noticed: ONE short sentence starting with "You" about HOW this student learns best (e.g. "You do better with an example before a question."), based on the evidence, or "".
Do not include names or quotes from the student.
Topic: ${clip(task.topic, 200)}. Character: ${CH[char].name}. Hints used: ${Number(hints) || 0}/${Number(maxHints) || 0}. Confidence after: ${Number(conf) || 3}/5.
Reflection, stuck: ${clip(stuck, 300) || "(blank)"}; unlocked by: ${clip(unlocked, 300) || "(blank)"}
Transcript:
${lines}`;

  try {
    const r = await chat([{ role: "user", content: prompt }], { temperature: 0.2, maxTokens: 300, json: true, deadlineMs: 8000 });
    if (!r.ok) return Response.json(fallback);
    const m = r.text.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : {};
    const pickFrom = (v, list) => (list.length ? (list.includes(v) ? v : "") : clip(v, 60));
    return Response.json({
      stuckStep: j.stuckStep === "none" ? "" : pickFrom(j.stuckStep, steps),
      misconception: ["other", "none"].includes(j.misconception) ? "" : pickFrom(j.misconception, mis),
      noticed: /^you\b/i.test(j.noticed || "") ? clip(j.noticed, 160) : "",
      model: r.model,
    });
  } catch { return Response.json(fallback); }
}
