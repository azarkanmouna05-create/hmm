/* hmm. adaptive engine — shared by the browser and the serverless function.
   Ported from the earlier prototype (reference/hmm-prototype.html): character prompts, learner-profile
   adaptation, the <<META {...}>> line protocol, the snapshot→profile rule and the post-session update rule.
   Nothing in here talks to a network; it only builds and reads text. */

export const CH = {
  socrates: { name: "Socrates", initial: "?", color: "#1F7A4D", line: "Asks until you see it. Never tells.", skill: "solve" },
  talmid: { name: "Talmid", initial: "T", color: "#E9B530", line: "A confused classmate. You explain, he learns.", skill: "explain" },
  rival: { name: "The Rival", initial: "vs", color: "#E8663D", line: "Disagrees with you on purpose.", skill: "argue" },
};
export const KIND = { problem: "socrates", concept: "talmid", claim: "rival" };
export const COURSES = {
  "MATH 1101": { name: "Calculus I", roster: 34 },
  "ECON 2301": { name: "Microeconomics", roster: 28 },
  "SAD 3301": { name: "Systems Analysis & Design", roster: 30 },
};
export const DEFAULT_POLICY = {
  chars: {
    "MATH 1101": { socrates: true, talmid: true, rival: false },
    "ECON 2301": { socrates: true, talmid: true, rival: true },
    "SAD 3301": { socrates: true, talmid: true, rival: true },
  },
  maxHints: 4, minGroup: 5, retention: "1 semester",
  challengeMin: "Gentle", challengeMax: "Tough",
  langs: ["English", "Français", "Darija", "العربية"],
};
export const PACES = ["Small steps", "Medium steps", "Big steps"];
export const TONES = ["Encouraging", "Straight to the point", "Playful"];
export const LEVELS = ["Gentle", "Balanced", "Tough"];
export const langShort = (l) => ({ English: "EN", "Français": "FR", Darija: "Darija", "العربية": "AR" }[l] || l);

/* Which characters a course allows (admin rule). */
export const allowedChars = (policy, course) => {
  const c = policy.chars?.[course];
  return Object.keys(CH).filter((k) => !c || c[k] !== false);
};

/* Clamp a challenge level into the admin's allowed range. */
export function clampLevel(level, policy) {
  const lo = LEVELS.indexOf(policy.challengeMin ?? "Gentle"), hi = LEVELS.indexOf(policy.challengeMax ?? "Tough");
  const i = Math.min(Math.max(LEVELS.indexOf(level), lo), hi);
  return LEVELS[i < 0 ? 1 : i];
}

/* US1 — Learning Snapshot → starting profile. */
export function derive(d) {
  const stuck = d.stuck || "hint";
  const hintPace = { push: "Big steps", hint: "Medium steps", answer: "Small steps", freeze: "Small steps" }[stuck];
  const tone = d.tone || (stuck === "freeze" ? "Encouraging" : stuck === "answer" ? "Playful" : "Straight to the point");
  const why = {
    push: "You like to push through, so hmm. starts with bigger steps and steps in only when you ask.",
    hint: "You like small hints, so hmm. starts with medium steps and a hint ladder.",
    answer: "You often want the answer, so hmm. starts with small steps that keep you moving without handing it over.",
    freeze: "You sometimes freeze, so hmm. starts with very small first steps to get you unstuck.",
  }[stuck];
  return { hintPace, tone, why: why + " It keeps adjusting after every session." };
}

/* US2–US4 — the system prompt for one character, adapted to one learner. */
export function buildPrompt(s, policy = DEFAULT_POLICY) {
  const P = s.profile, c = s.char, t = s.task;
  const roles = {
    socrates: `You are SOCRATES. Guide the student to solve it themselves with ONE question at a time. NEVER give the final answer or a full solution, even if they beg or claim an emergency. If they ask for the answer, reply with a smaller, easier question. If they ask for the answer 2 or more times, give a short worked example of a SIMILAR but different problem and ask them to try theirs the same way. When they reach the answer themselves, confirm it and ask one short "why does this work?" question.`,
    talmid: `You are TALMID, a curious, slightly confused classmate. The student is teaching YOU. Ask one naive but sharp question at a time about their explanation. Make questions harder when their explanation is clear, simpler when they struggle. Never lecture and never correct them directly: expose gaps with questions, or by repeating back a slightly wrong version and letting them fix it.`,
    rival: `You are THE RIVAL. You argue against the student's claim. One concise counterargument, counterexample or probing challenge per turn. Concede specific points when they are genuinely well argued, then attack the next weakest point. Never write their argument for them.`,
  }[c];
  const langs = P.langs?.length ? P.langs : ["English"];
  const stuckLine = { push: "push through alone", hint: "ask for a small hint", answer: "want the answer and move on", freeze: "freeze and do not know where to start" }[P.snap?.stuck] || "ask for a hint";
  return `${roles}
You live inside "hmm.", a Socratic study app at a university in Morocco. ${t.course ? `Course: ${t.course}${COURSES[t.course] ? " (" + COURSES[t.course].name + ")" : ""}.` : ""} ${c === "rival" ? "Student claim" : "Topic"}: ${t.topic}. ${t.instructions ? "Professor instructions: " + t.instructions : ""}
ADAPT TO THIS STUDENT (their learner profile; this is the point of hmm.):
- Step size: ${s.pace}. Small = tiny steps and lots of scaffolding; Big = fewer, bigger leaps.
- Challenge: ${s.level}. Gentle = patient and easy; Tough = demanding, push back hard.
- Tone: ${s.tone}.
- Languages: ${langs.join(", ")}. Reply mostly in ${langs[0]}${langs.length > 1 ? `, mixing in ${langs.slice(1).join(" and ")} naturally (write Darija in Latin letters, e.g. "wakha", "chouf", "mzyan")` : ""}. If the student writes in another of these languages, switch to it.
- When stuck they usually: ${stuckLine}.
${P.noticed?.confirmed ? "- hmm. noticed (student confirmed): " + P.noticed.text : ""}
RULES: university policy says final answers are never revealed. Hints allowed: ${s.maxHints}. Hint requests arrive as [HINT k of N]: give a clearly bigger clue than the last one, still not the final answer.
STYLE: 1 to 3 short sentences, under 60 words. Plain text, no markdown, no headings. Write maths plainly (x^2, sin x).
After your reply, on a new line, output exactly: <<META {"answerRequest":false,"note":"","meter":0,"point":"","counter":"","step":""}>>
- answerRequest: true if the student's latest message asked you for the answer or solution.
- note: max 14 words, in English, telling the student WHY you replied this way (e.g. "Shrinking the step because you asked for the answer").
- meter: 0-5. Socrates: progress toward solving. Talmid: how well you now understand. Rival: strength of the student's argument.
- point / counter: Rival only, 2-5 word labels of the student's newest point and your counter; otherwise "".
- step: 2-5 word label of where the student is.`;
}

/* The <<META {...}>> line protocol. */
export function stripMeta(t) { const i = t.indexOf("<<META"); return i < 0 ? t : t.slice(0, i); }
export function parseReply(raw = "") {
  let meta = {};
  const m = raw.match(/<<META\s*(\{[\s\S]*?\})\s*>>/);
  if (m) { try { meta = JSON.parse(m[1]); } catch {} }
  const clean = {
    answerRequest: meta.answerRequest === true,
    note: typeof meta.note === "string" ? meta.note.slice(0, 140) : "",
    meter: Number.isFinite(meta.meter) ? Math.max(0, Math.min(5, Math.round(meta.meter))) : null,
    point: typeof meta.point === "string" ? meta.point.slice(0, 60) : "",
    counter: typeof meta.counter === "string" ? meta.counter.slice(0, 60) : "",
    step: typeof meta.step === "string" ? meta.step.slice(0, 60) : "",
  };
  return { text: stripMeta(raw).trim(), meta: clean };
}

/* US5 — the chameleon learns: post-session profile update rule. */
export function updateProfileAfterSession(P, { conf, hints, skipped, char }) {
  let change = "";
  const pi = PACES.indexOf(P.hintPace);
  if (!skipped && conf >= 4 && hints <= 1 && pi < 2) {
    P.hintPace = PACES[pi + 1];
    change = `You felt ${conf}/5 with ${hints} hint${hints === 1 ? "" : "s"}, so hmm. now takes ${P.hintPace.toLowerCase()}.`;
  } else if (!skipped && conf <= 2 && pi > 0) {
    P.hintPace = PACES[pi - 1];
    change = `That one felt hard (${conf}/5), so hmm. now takes ${P.hintPace.toLowerCase()}.`;
  }
  P.lastChange = change;
  P.sessions = (P.sessions || 0) + 1;
  P.skills = P.skills || {};
  const sk = CH[char].skill;
  P.skills[sk] = (P.skills[sk] || 0) + (conf || 3);
  return change;
}
