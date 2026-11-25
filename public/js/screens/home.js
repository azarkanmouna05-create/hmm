/* S03 · Student Home — built from Figma frame "E1 · Home (editorial)".
   "Today's question" comes from the courses the student joined; empty state if none yet. */
import { icons } from "../ui/icons.js";
import * as db from "../db.js";
import { store } from "../store.js";
import { locale } from "../i18n/index.js";
import { CH, KIND } from "../engine/engine.js";
import { tabbar } from "./courses.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HEADLINES = { // editorial headline for known sample tasks; otherwise the task itself is the headline
  "00000000-0000-4000-8000-000000000101": "Why does the product rule add two terms instead of one?",
};
const dueLabel = (d) => { if (!d) return ""; const t = new Date(d + "T12:00"); return isNaN(t) ? d : "Due " + t.toLocaleDateString(locale(), { weekday: "short" }); };

export function render() {
  const P = store.profile;
  const courses = store.courses;
  const enrolled = new Set(courses.map((c) => c.code));
  const task = store.tasks.find((t) => !db.isConfigured() || enrolled.has(t.course));
  const k = task ? KIND[task.kind] || "socrates" : "socrates";
  const paceLine = { "Small steps": "in small steps", "Medium steps": "at a steady pace", "Big steps": "in bigger leaps" }[P.hintPace] || "at your pace";

  const today = task ? `
    <article class="today">
      <p class="kicker">Today's question · ${esc(task.course)}${task.sample ? ' <span class="sample-label" style="color:var(--muted);margin-left:6px">Sample</span>' : ""}</p>
      <h1 class="headline" style="margin-top:10px">${esc(HEADLINES[task.id] || task.topic)}</h1>
      <p class="dek" style="margin-top:10px">${P.lastChange ? esc(P.lastChange) + " " : ""}${CH[k].name} will go ${paceLine} today. You'll get there yourself.</p>
      <div class="byline" style="margin-top:10px">
        <span class="initial initial--sm initial--${k}" aria-hidden="true">${CH[k].initial}</span>
        <span class="byline__who"><b>${CH[k].name}</b><span>${[dueLabel(task.due), "~12 min"].filter(Boolean).join(" · ")}</span></span>
        <span class="byline__spacer"></span>
        <button class="btn btn--ink" id="start">Start thinking</button>
      </div>
    </article>`
    : courses.length ? `
    <article class="today"><p class="kicker">Nothing due</p>
      <h1 class="headline" style="margin-top:10px">No assignments right now. Bring your own question.</h1>
      <p class="dek" style="margin-top:10px">Open one of your courses and start with Socrates, Talmid or the Rival on anything you’re working on.</p>
      <div class="byline" style="margin-top:10px"><span class="byline__spacer"></span><a class="btn btn--ink" href="#/courses">My courses</a></div></article>`
    : `
    <article class="today"><p class="kicker">Welcome to hmm.</p>
      <h1 class="headline" style="margin-top:10px">Join your first course to begin.</h1>
      <p class="dek" style="margin-top:10px">Your professor shares a short code in class. Once you join, your course’s questions show up here.</p>
      <div class="byline" style="margin-top:10px"><span class="byline__spacer"></span><a class="btn btn--ink" href="#/courses">Join a course</a></div></article>`;

  const noticed = P.noticed && P.noticed.confirmed == null ? P.noticed.text : "";

  const html = `
  <header class="topbar">
    <a class="logo" href="#/" aria-label="hmm. home">hmm<span class="logo__dot"></span></a>
    <span class="topbar__spacer"></span>
    <button class="avatar" id="me" aria-label="Your account">${esc((P.name || "?")[0])}</button>
  </header>

  <nav class="tabs" aria-label="Feed">
    <a href="#/" aria-current="page">For you</a>
    <a href="#/courses">My courses</a>
  </nav>

  <section class="feed">
    <div id="invites"></div>
    ${today}
    ${noticed ? `<hr class="rule">
    <aside class="note" aria-label="Something hmm. noticed">
      <span class="note__cham" data-chameleon="40"></span>
      <div class="note__body">
        <div class="note__meta"><b>hmm.</b>noticed something</div>
        <p class="note__text">${esc(noticed)} Is this right?</p>
        <div class="note__actions">
          <button class="btn btn--sm btn--yes">Yes, that’s me</button>
          <button class="btn btn--sm btn--no">Not really</button>
        </div>
      </div>
    </aside>` : ""}
    <hr class="rule">
    <h2 class="section-title">Your thinkers</h2>
    <ul class="thinkers">
      ${Object.entries(CH).map(([key, c]) => `<li class="thinker">
        <span class="initial initial--${key}" aria-hidden="true">${c.initial}</span>
        <span class="thinker__text"><b>${c.name}</b><span>${c.line}</span></span>
        <a class="btn btn--sm btn--ghost" href="#/courses">Open</a></li>`).join("")}
    </ul>
  </section>
  ${tabbar("home")}`;

  return {
    html,
    mount(el) {
      // Anonymous help-session invites: shown only if THIS student's private history says the course felt hard.
      const hard = new Set((P.history || []).filter((h) => h.conf != null && h.conf <= 2).map((h) => h.course));
      if (hard.size && db.isConfigured()) db.listInvites().then((inv) => {
        const mine = inv.filter((i) => hard.has(i.course));
        el.querySelector("#invites").innerHTML = mine.slice(0, 1).map((i) => `<aside class="why" style="margin-bottom:6px"><span class="why__cham" data-chameleon="30"></span>
          <p>Your professor is running an optional help session for ${esc(i.course)}${i.when ? " · " + esc(i.when) : ""}. Only you can see this invite; nobody knows who got it.</p></aside>`).join("");
        import("../chameleon/chameleon.js").then((m) => m.mountInlineChameleons(el));
      }).catch(() => {});
      el.querySelector("#start")?.addEventListener("click", () => {
        store.startSession(k, task);
        location.hash = "#/session/" + k;
      });
      el.querySelector("#me").onclick = () => { location.hash = "#/me"; };
      el.querySelectorAll(".note__actions .btn").forEach((b) =>
        b.addEventListener("click", async () => {
          const yes = b.classList.contains("btn--yes");
          const p = { ...store.profile, noticed: { text: noticed, confirmed: yes } };
          await store.saveProfile(p);
          el.querySelector(".note__actions").outerHTML =
            `<p class="note__meta" style="margin:0">${yes ? "Noted. I’ll keep doing that." : "Thanks, I’ll stop assuming that."}</p>`;
        }));
    },
  };
}
