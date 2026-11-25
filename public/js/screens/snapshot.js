/* S02 · Learning Snapshot (US1). 4 quick steps → starting learner profile, with the "why".
   Logic from the prototype (derive); copy ideas from the earlier Figma Snapshot frames. */
import { derive, LEVELS, TONES, langShort, clampLevel } from "../engine/engine.js";
import { store } from "../store.js";
import { setChameleonMood } from "../chameleon/chameleon.js";
import { icons } from "../ui/icons.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STUCK = [
  ["freeze", "I don’t know where to start", "The blank-page stare. A classic."],
  ["answer", "I want the answer and move on", "Deadlines are real. Honest answer."],
  ["hint", "I ask for a small hint", "Just a nudge, please."],
  ["push", "I push through on my own", "Challenge me a little."],
];
let draft = null;

export function render({ path }) {
  const step = Math.min(4, Math.max(1, parseInt(path.split("/")[2], 10) || 1));
  const P = store.profile, pol = store.policy;
  draft ||= { name: P.snap ? P.name : "", program: P.snap ? P.program || "" : "", stuck: P.snap?.stuck || "",
    langs: P.snap ? [...(P.langs || ["English"])] : ["English"], challenge: P.snap ? P.challenge : "Balanced", tone: P.snap ? P.tone : "", hard: P.snap?.hard || "" };
  const d = draft;
  const levels = LEVELS.filter((l) => clampLevel(l, pol) === l);
  const chip = (group, v, label, on, sub = "") => `<button type="button" class="pick ${on ? "is-on" : ""}" data-g="${group}" data-v="${esc(v)}" aria-pressed="${on}">
      <span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;

  const bodies = {
    1: `<h1 class="headline">Let hmm. get to know how you think.</h1>
        <p class="dek">Four quick questions so hmm. fits how you learn. You can change any answer later in your profile.</p>
        <label class="field">What should hmm. call you?<input id="name" value="${esc(d.name)}" autocomplete="given-name"></label>
        <label class="field">Program and year<input id="program" value="${esc(d.program)}" placeholder="e.g. BAI · 3rd year"></label>`,
    2: `<h1 class="headline">Where does it get fuzzy?</h1>
        <p class="field-label">When you’re stuck, you usually…</p>
        <div class="picks">${STUCK.map(([v, l, sub]) => chip("stuck", v, l, d.stuck === v, sub)).join("")}</div>
        <p class="field-label">Languages (pick any)</p>
        <div class="picks picks--row">${pol.langs.map((l) => chip("langs", l, l, d.langs.includes(l))).join("")}</div>
        <p class="field-label">How hard should hmm. push you?</p>
        <div class="picks picks--row">${levels.map((l) => chip("challenge", l, l, d.challenge === l)).join("")}</div>`,
    3: `<h1 class="headline">How should hmm. talk to you?</h1>
        <div class="picks">${TONES.map((t) => chip("tone", t, t, d.tone === t)).join("")}</div>
        <label class="field">Your hardest subject right now<input id="hard" value="${esc(d.hard)}" placeholder="e.g. calculus, essays, accounting"></label>`,
    4: (() => { const p = derive(d); return `<h1 class="headline">Here’s how hmm. will start with you.</h1>
        <p class="snap-summary">${esc(p.hintPace)} · ${esc(d.challenge)} · ${esc(p.tone)} · ${d.langs.map(langShort).join(" + ")}</p>
        <aside class="why"><span class="why__cham" data-chameleon="30"></span><p>${esc(p.why)}</p></aside>`; })(),
  };

  const html = `
  <header class="topbar">
    ${step > 1 ? `<a class="snap-back" href="#/snapshot/${step - 1}" aria-label="Back">${icons.back}</a>` : ""}
    <span class="snap-progress" aria-label="Step ${step} of 4">${[1, 2, 3, 4].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</span>
    <span class="sample-label">${step}/4</span>
  </header>
  <section class="feed snap">
    <p class="kicker">Learning Snapshot</p>
    ${bodies[step]}
    <div class="snap__actions">
      <button class="btn btn--ink auth__submit" id="next">${step === 4 ? "Start using hmm." : "Continue"}</button>
      ${step < 4 ? `<button class="btn btn--ghost auth__submit" id="skip" style="border:0">Skip for now</button>` : ""}
      <p class="auth__fine" style="text-align:center">A snapshot, not an exam. Promise.</p>
    </div>
  </section>`;

  return {
    html,
    mount(el) {
      const save = () => {
        for (const k of ["name", "program", "hard"]) { const i = el.querySelector("#" + k); if (i) d[k] = i.value.trim(); }
      };
      el.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => {
        save();
        const g = b.dataset.g, v = b.dataset.v;
        if (g === "langs") { d.langs = d.langs.includes(v) ? d.langs.filter((x) => x !== v) : [...d.langs, v]; if (!d.langs.length) d.langs = [v]; }
        else d[g] = v;
        if (g === "challenge") setChameleonMood(v.toLowerCase());   // the chameleon shows the choice right away
        location.hash = "#/snapshot/" + step + "?" + Date.now();      // re-render this step
      });
      el.querySelector("#next").onclick = async () => {
        save();
        if (step < 4) return (location.hash = "#/snapshot/" + (step + 1));
        const p = derive(d);
        const P = { ...store.profile, name: d.name || store.profile.name || "there", program: d.program,
          snap: { stuck: d.stuck || "hint", hard: d.hard, done: Date.now() }, hintPace: p.hintPace, tone: p.tone,
          challenge: d.challenge, langs: d.langs, skills: store.profile.skills || { solve: 0, explain: 0, argue: 0 },
          sessions: store.profile.sessions || 0, history: store.profile.history || [], lastChange: "" };
        await store.saveProfile(P);
        store.needsSnapshot = false; draft = null;
        location.hash = "#/";
      };
      el.querySelector("#skip")?.addEventListener("click", () => {
        save(); d.stuck ||= "hint"; d.tone ||= "Encouraging"; location.hash = "#/snapshot/4";
      });
    },
  };
}
