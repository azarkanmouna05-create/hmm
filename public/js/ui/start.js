/* Starting sessions: the student chooses the character; hmm. suggests one (prototype's suggestFor rule). */
import { CH, KIND, allowedChars } from "../engine/engine.js";
import { store } from "../store.js";
import { openSheet } from "./sheet.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PROMPT = {
  socrates: { label: "Your problem", ph: "e.g. Find the derivative of x³ · eˣ" },
  talmid: { label: "What will you teach Talmid?", ph: "e.g. Why demand curves slope down" },
  rival: { label: "Your claim, in one sentence", ph: "e.g. Agile is always better than Waterfall" },
};

export function suggestFor(task) {
  const ok = allowedChars(store.policy, task.course);
  let k = KIND[task.kind] || "socrates";
  const P = store.profile;
  const last = (P.history || []).filter((h) => h.course === task.course && h.conf != null).slice(-1)[0];
  let why = `This is a ${task.kind === "claim" ? "claim to defend" : task.kind === "concept" ? "concept to explain" : "problem to solve"}.`;
  if (last && last.conf <= 2 && ok.includes("socrates") && k !== "socrates") { k = "socrates"; why = `Your last ${task.course} session felt hard (${last.conf}/5), so a guided start first.`; }
  else if (P.snap?.stuck === "answer" && k === "rival" && ok.includes("talmid")) { k = "talmid"; why = "Teaching it first builds the case before you defend it."; }
  if (!ok.includes(k)) k = ok[0] || "socrates";
  return { k, why };
}

/* A professor's task: pick any allowed character; the suggestion is marked with its reason. */
export function pickCharacter(task) {
  const s = suggestFor(task), ok = allowedChars(store.policy, task.course);
  const sheet = openSheet(task.course, `
    <p class="sheet__topic">${esc(task.topic)}</p>
    ${task.instructions ? `<p class="note__meta">${esc(task.instructions)}</p>` : ""}
    <aside class="engine"><span class="note__cham" data-chameleon="30" style="width:30px"></span><div><span class="engine__label">Adaptive engine</span><br>Suggested: <b>${CH[s.k].name}</b>. ${esc(s.why)} You can switch.</div></aside>
    <ul class="thinkers">${ok.map((k) => `<li class="thinker"><span class="initial initial--${k}" aria-hidden="true">${CH[k].initial}</span>
      <span class="thinker__text"><b>${CH[k].name}${k === s.k ? ' <span class="sample-label">· suggested</span>' : ""}</b><span>${CH[k].line}</span></span>
      <button class="btn btn--sm ${k === s.k ? "btn--ink" : "btn--ghost"}" data-k="${k}">Start</button></li>`).join("")}</ul>
    ${Object.keys(CH).filter((k) => !ok.includes(k)).map((k) => `<p class="note__meta">${CH[k].name} is turned off for ${esc(task.course)} by your university.</p>`).join("")}`);
  sheet.el.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
    const sess = store.startSession(b.dataset.k, task); sess.suggested = s.k; store.saveSession(sess);
    location.hash = "#/session/" + b.dataset.k;
  });
}

/* "Start a session" from Home (Flows 2 and 4): choose the character on S03; the problem/claim is typed in the
   session screen itself (S04a/S04c). Only asks which course first if the student has more than one. */
export function freeStart(k) {
  const courses = store.courses.filter((c) => allowedChars(store.policy, c.code).includes(k));
  if (!store.courses.length) { location.hash = "#/courses"; return; }
  const go = (course) => { store.startFree(k, course, ""); location.hash = "#/session/" + k; };
  if (courses.length === 1) return go(courses[0].code);
  const sheet = openSheet(CH[k].name, courses.length ? `
    <p class="note__meta">Which course is this for?</p>
    <div class="cards">${courses.map((c) => `<button class="card-row" data-c="${esc(c.code)}"><span class="card-row__text"><b data-no-i18n>${esc(c.code)}</b><span data-no-i18n>${esc(c.name)}</span></span><span class="card-row__end">›</span></button>`).join("")}</div>
    ${courses.length < store.courses.length ? `<p class="note__meta">${CH[k].name} is turned off in some of your courses by your university.</p>` : ""}`
    : `<p class="dek">${CH[k].name} is turned off in all your courses by your university.</p>`);
  sheet.el.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => go(b.dataset.c));
}
