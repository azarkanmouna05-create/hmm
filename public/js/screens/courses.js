/* My courses (E1 "My courses" tab) + course page.
   #/courses        → your courses, and "Join a course" with the code your professor gave you
   #/course/<code>  → one course: the professor's tasks, and "think about anything" with each allowed character */
import { CH, allowedChars } from "../engine/engine.js";
import { store } from "../store.js";
import { locale } from "../i18n/index.js";
import * as db from "../db.js";
import { icons } from "../ui/icons.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDue = (d) => { const t = new Date(d + "T12:00"); return isNaN(t) ? d : t.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }); };
const PROMPT = {
  socrates: { label: "Your problem", ph: "e.g. Find the derivative of x³ · eˣ", go: "Start with Socrates" },
  talmid: { label: "What will you teach Talmid?", ph: "e.g. Why demand curves slope down", go: "Teach Talmid" },
  rival: { label: "Your claim, in one sentence", ph: "e.g. Agile is always better than Waterfall", go: "Face the Rival" },
};

const header = (active) => `
  <header class="topbar">
    <a class="logo" href="#/" aria-label="hmm. home">hmm<span class="logo__dot"></span></a>
    <span class="topbar__spacer"></span>
  </header>
  <nav class="tabs" aria-label="Feed">
    <a href="#/" ${active === "you" ? 'aria-current="page"' : ""}>For you</a>
    <a href="#/courses" ${active === "courses" ? 'aria-current="page"' : ""}>My courses</a>
  </nav>`;

export const tabbar = (active) => `
  <nav class="tabbar" aria-label="Main">
    <a href="#/" ${active === "home" ? 'aria-current="page"' : ""}>${icons.home}Home</a>
    <a href="#/reflect" ${active === "reflect" ? 'aria-current="page"' : ""}>${icons.reflect}Reflect</a>
    <a href="#/courses" ${active === "courses" ? 'aria-current="page"' : ""}>${icons.courses}Courses</a>
    <a href="#/me" ${active === "me" ? 'aria-current="page"' : ""}>${icons.me}Me</a>
  </nav>`;

export function render({ path }) {
  const code = decodeURIComponent(path.split("/")[2] || "");
  return code ? coursePage(code) : courseList();
}

function courseList() {
  const courses = store.courses;
  const html = `${header("courses")}
  <section class="feed">
    ${courses.length ? `<ul class="courses">${courses.map((c) => `
      <li><a class="course-row" href="#/course/${encodeURIComponent(c.code)}">
        <span class="course-row__code">${esc(c.code)}</span>
        <span class="course-row__name">${esc(c.name)}</span>
        <span class="course-row__meta">${c.students} student${c.students === 1 ? "" : "s"} joined${c.demo ? " · demo course" : ""}</span>
      </a></li>`).join("")}</ul>`
      : `<div class="empty"><p class="kicker">No courses yet</p><h1 class="headline">Join your first course.</h1>
         <p class="dek">Your professor shares a short code in class. Type it below and the course appears here.</p></div>`}
    <hr class="rule">
    <form class="join" id="join" novalidate>
      <label for="code">Got a code from your professor?</label>
      <span class="join__row">
        <input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. CALC-7Q2K">
        <button class="btn btn--ink">Join</button>
      </span>
      <p class="auth__msg" id="msg" role="alert"></p>
    </form>
  </section>
  ${tabbar("courses")}`;
  return {
    html,
    mount(el) {
      el.querySelector("#join").onsubmit = async (e) => {
        e.preventDefault();
        const code = el.querySelector("#code").value.trim();
        const msg = el.querySelector("#msg");
        if (!code) return (msg.textContent = "Type the code your professor gave you.");
        if (!db.isConfigured()) return (msg.textContent = "Joining needs the database (not available in local demo mode).");
        try { const c = await db.joinCourse(code); location.hash = "#/course/" + encodeURIComponent(c.code); }
        catch (err) { msg.textContent = err.message; }
      };
    },
  };
}

function coursePage(code) {
  const c = store.courses.find((x) => x.code === code) || { code, name: "", students: 0 };
  const allowed = allowedChars(store.policy, code);
  const tasks = store.tasks.filter((t) => t.course === code);
  const html = `
  <header class="session__head">
    <a class="icon-btn" href="#/courses" aria-label="Back to my courses">${icons.back}</a>
    <span class="session__title"><b>${esc(c.code)}</b><span>${esc(c.name)}</span></span>
  </header>
  <section class="feed">
    <p class="kicker">${esc(c.code)}${c.demo ? ' <span class="sample-label" style="color:var(--muted);margin-left:6px">Demo course</span>' : ""}</p>
    <h1 class="headline">${esc(c.name || c.code)}</h1>
    <p class="dek">${c.students} student${c.students === 1 ? "" : "s"} joined. Bring anything from this course; hmm. won’t hand you answers, it helps you find them.</p>

    ${tasks.length ? `<h2 class="section-title">From your professor</h2>
    <ul class="thinkers">${tasks.map((t) => {
      const k = { problem: "socrates", concept: "talmid", claim: "rival" }[t.kind] || "socrates";
      return `<li class="thinker"><span class="initial initial--${k}" aria-hidden="true">${CH[k].initial}</span>
        <span class="thinker__text"><b>${esc(t.topic)}</b><span>${CH[k].name}${t.due ? " · due " + esc(fmtDue(t.due)) : ""}${t.sample ? " · sample task" : ""}</span></span>
        <button class="btn btn--sm btn--ghost" data-task="${esc(t.id)}" data-char="${k}">Start</button></li>`;
    }).join("")}</ul><hr class="rule">` : ""}

    <h2 class="section-title">Think about anything</h2>
    <ul class="thinkers">
      ${Object.keys(CH).map((k) => allowed.includes(k) ? `
        <li class="thinker"><span class="initial initial--${k}" aria-hidden="true">${CH[k].initial}</span>
          <span class="thinker__text"><b>${CH[k].name}</b><span>${CH[k].line}</span></span>
          <button class="btn btn--sm btn--ghost" data-free="${k}">Open</button></li>
        <li class="free" id="free-${k}" hidden>
          <form data-form="${k}"><label for="t-${k}">${PROMPT[k].label}</label>
            <textarea id="t-${k}" rows="2" placeholder="${PROMPT[k].ph}"></textarea>
            <button class="btn btn--ink">${PROMPT[k].go}</button></form></li>`
        : `<li class="thinker thinker--off"><span class="initial initial--${k}" aria-hidden="true">${CH[k].initial}</span>
          <span class="thinker__text"><b>${CH[k].name}</b><span>Turned off for ${esc(code)} by your university.</span></span></li>`).join("")}
    </ul>
  </section>
  ${tabbar("courses")}`;
  return {
    html,
    mount(el) {
      el.querySelectorAll("[data-free]").forEach((b) => b.onclick = () => {
        const box = el.querySelector("#free-" + b.dataset.free);
        box.hidden = !box.hidden; if (!box.hidden) box.querySelector("textarea").focus();
      });
      el.querySelectorAll("[data-form]").forEach((f) => f.onsubmit = (e) => {
        e.preventDefault();
        const k = f.dataset.form, topic = f.querySelector("textarea").value.trim();
        if (!topic) return f.querySelector("textarea").focus();
        store.startFree(k, code, topic);
        location.hash = "#/session/" + k;
      });
      el.querySelectorAll("[data-task]").forEach((b) => b.onclick = () => {
        const t = store.tasks.find((x) => String(x.id) === b.dataset.task);
        store.startSession(b.dataset.char, t);
        location.hash = "#/session/" + b.dataset.char;
      });
    },
  };
}
