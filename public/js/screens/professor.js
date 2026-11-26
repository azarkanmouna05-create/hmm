/* Professor (US6, US7; Flows 6–7). Class-level patterns only, behind the privacy floor.
   #/                       S07 My classes: suggested moves this week + class pulse per course + blank task
   #/insights[/<course>]    S09 Insights: privacy banner, 3 key numbers, where the class got stuck, misconceptions, 3 moves
   #/create?…               S08 New assignment: "From insight" banner, pre-filled, adapt toggle, max hints, Preview / Publish
   #/account                account + app language + sign out (reached from the avatar) */
import { CH } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { icons } from "../ui/icons.js";
import { adminTabs } from "./admin.js";
import { langPicker, bindLangPicker, ask, askText, t } from "../i18n/index.js";
import { engineBox } from "../ui/engine.js";
import { columns, segments } from "../ui/charts.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const qs = (path) => new URLSearchParams(path.split("?")[1] || "");
const enc = encodeURIComponent;

export const staffTabs = (active) => `
  <nav class="tabbar" aria-label="Main">
    <a href="#/" ${active === "home" ? 'aria-current="page"' : ""}>${icons.home}Classes</a>
    <a href="#/insights" ${active === "insights" ? 'aria-current="page"' : ""}>${icons.courses}Insights</a>
    <a href="#/create" ${active === "create" ? 'aria-current="page"' : ""}>${icons.reflect}New task</a>
  </nav>`;
const head = (title, back = "") => `<header class="apphead">${back ? `<a class="icon-btn" href="${back}" aria-label="Back">${icons.back}</a>` : "<span></span>"}
  <h1 class="apphead__title">${title}</h1><a class="avatar" href="#/account" aria-label="Your account">S</a></header>`;

/* Teaching moves (ported from the prototype), each with one action. */
export function moves(course, a) {
  const out = [];
  const top = a.stuck?.[0], total = (a.stuck || []).reduce((x, y) => x + y.n, 0) || a.sessions || 1;
  if (top) out.push({ t: `Re-teach “${top.label}” with a worked example`, w: `About ${Math.round(100 * top.n / total)}% of the class got stuck here`, act: "plan", course });
  const m = a.misconceptions?.[0];
  if (m) out.push({ t: `Assign a Talmid follow-up on “${m.label}”`, w: "Explaining it back fixes the most common mix-up", act: "task", course, kind: "concept", topic: `Explain: ${m.label}`,
    why: `${m.n} students showed “${m.label}” in ${course}. Fields are pre-filled; edit anything.` });
  out.push({ t: "Offer an optional help session", w: "Invite goes to students who struggled; you never see who", act: "invite", course });
  return out;
}
const moveBtn = (m, i) => m.act === "plan" ? `<button class="btn btn--sm btn--ghost move__btn" data-move="${i}">Add to lecture plan</button>`
  : m.act === "task" ? `<a class="btn btn--sm btn--ghost move__btn" href="#/create?course=${enc(m.course)}&kind=${m.kind}&topic=${enc(m.topic)}&why=${enc(m.why || m.w)}">Create task</a>`
  : `<button class="btn btn--sm btn--ghost move__btn" data-move="${i}">Send anonymous invite</button>`;
const moveCard = (m, i, showCourse) => `<div class="move-card"><div><b>${showCourse ? `<span data-no-i18n>${esc(m.course)}</span>: ` : ""}${esc(m.t)}</b><span>${esc(m.w)}</span></div>${moveBtn(m, i)}</div>`;

function bindMoves(el, list) {
  el.querySelectorAll("[data-move]").forEach((b) => b.onclick = async () => {
    const m = list[+b.dataset.move];
    try {
      if (m.act === "plan") {
        await db.addPlan(m.course, m.t);
        sessionStorage.setItem("hmm.toast", `Added to your lecture plan for ${m.course}.`);
        if (location.hash.startsWith("#/insights")) { location.hash = "#/"; return; }   // Flow 6: back to class pulse
        b.outerHTML = `<span class="note__meta">Added to your lesson notes.</span>`;
      }
      if (m.act === "invite") {
        const when = askText("When and where? (e.g. Thu 4pm, Building 8 room 104)"); if (!when) return;
        await db.createInvite({ course: m.course, topic: `Help session · ${m.course}`, when });
        b.outerHTML = `<span class="note__meta">Invite sent anonymously.</span>`;
      }
    } catch (e) { alert(t(e.message)); }
  });
}

/* ───────── S07 My classes ───────── */
export function home() {
  const courses = store.courses;
  const html = `${head("My classes")}
  <section class="feed">
    <h2 class="label-caps">Suggested moves this week</h2>
    ${engineBox("From class-level patterns only. You decide what to do.")}
    <div id="moves" class="cards"><p class="note__meta">Loading class pulse…</p></div>
    <h2 class="label-caps">Class pulse</h2>
    <div id="pulse" class="cards">${courses.map((c) => `<a class="pulse-card" href="#/insights/${enc(c.code)}" id="pulse-${enc(c.code)}">
      <b><span data-no-i18n>${esc(c.code)}</span> · <span class="pulse-n">${c.students}</span> <span>students</span></b><span class="pulse-line note__meta">…</span>
      <span class="pulse-seg"></span><span class="note__meta">Join code <b data-no-i18n style="color:var(--ink);letter-spacing:.06em">${esc(c.join_code)}</b>${c.demo ? " · demo" : ""}</span></a>`).join("")
      || `<p class="dek">No classes yet. Your admin assigns the courses you teach.</p>`}</div>
    <a class="btn btn--ghost auth__submit" href="#/create">+ Blank task</a>
  </section>${staffTabs("home")}`;
  return {
    html, pet: false,
    async mount(el) {
      const all = [];
      for (const c of courses) {
        const card = el.querySelector(`[id="pulse-${enc(c.code)}"]`);
        try {
          const a = await db.classInsights(c.code);
          if (a.enrolled) card.querySelector(".pulse-n").textContent = a.enrolled;
          card.querySelector(".pulse-line").innerHTML = a.hidden ? `Patterns appear at ${a.floor}+ students (${a.students} so far)`
            : `<span>Most stuck on:</span> <span data-no-i18n>${esc(a.stuck?.[0]?.label || "–")}</span> · <span>confidence</span> ${a.avg_conf}/5${a.includes_sample ? " · <span>includes sample data</span>" : ""}`;
          if (!a.hidden) card.querySelector(".pulse-seg").innerHTML = segments(+a.avg_conf || 0, 5, { label: "confidence" });
          if (!a.hidden) { const mv = moves(c.code, a); if (mv[0]) all.push({ ...mv[0] }); if (mv[1] && all.length < 3) all.push({ ...mv[1] }); }
        } catch { card.querySelector(".pulse-line").textContent = ""; }
      }
      el.querySelector("#moves").innerHTML = all.slice(0, 3).map((m, i) => moveCard(m, i, true)).join("")
        || `<p class="dek">Moves appear once at least ${store.policy.minGroup} students finish sessions in a class.</p>`;
      bindMoves(el, all.slice(0, 3));
    },
  };
}

/* ───────── S09 Insights ───────── */
export function insights({ path }) {
  const code = decodeURIComponent((path.split("?")[0].split("/")[2]) || "") || store.courses[0]?.code || "";
  const course = store.courses.find((c) => c.code === code);
  const taskId = qs(path).get("task");
  const tasks = store.tasks.filter((t) => t.course === code);
  const task = tasks.find((t) => t.id === taskId);
  const html = `${head("Insights", "#/")}
  <section class="feed">
    <nav class="tabs tabs--inline">${store.courses.map((c) => `<a href="#/insights/${enc(c.code)}" ${c.code === code ? 'aria-current="page"' : ""} data-no-i18n>${esc(c.code)}</a>`).join("")}</nav>
    <p class="sessbar__topic"><span data-no-i18n>${esc(code)}</span> · ${task ? `<span data-no-i18n>${esc(task.topic)}</span>` : `<span>All tasks</span>`} · <span>this week</span></p>
    ${tasks.length ? `<label class="field">Task<select id="task"><option value="">All sessions in ${esc(code)}</option>${tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === taskId ? "selected" : ""}>${esc(t.topic)}</option>`).join("")}</select></label>` : ""}
    <div class="privacy-banner"><b>Class-level only.</b> <span>No names, chats or answers. Totals count everyone; only breakdowns with fewer than 5 students are hidden.</span></div>
    <div id="ins" class="cards"><p class="note__meta">Loading…</p></div>
  </section>${staffTabs("insights")}`;
  return {
    html, pet: false,
    async mount(el) {
      el.querySelector("#task")?.addEventListener("change", (e) => { location.hash = `#/insights/${enc(code)}${e.target.value ? "?task=" + e.target.value : ""}`; });
      if (!code) return (el.querySelector("#ins").innerHTML = "");
      let a; try { a = await db.classInsights(code, taskId || null); } catch (e) { el.querySelector("#ins").innerHTML = `<p class="dek">${esc(e.message)}</p>`; return; }
      if (a.hidden) {
        el.querySelector("#ins").innerHTML = `<div class="hidden-card"><b>Insights hidden for now</b>
          <span>Only ${a.students} students have finished. Patterns appear once ${a.floor} or more have, so no one can be identified.</span>
          <div class="hidden-card__lock" aria-hidden="true"><svg viewBox="0 0 40 44" width="36"><rect x="6" y="18" width="28" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 18v-6a8 8 0 0 1 16 0v6" fill="none" stroke="currentColor" stroke-width="3"/></svg></div></div>
          <button class="btn btn--ghost auth__submit" id="remind">Remind the class</button>
          ${engineBox("Minimum group size is set by the admin in Rules & settings.", { cham: false })}`;
        el.querySelector("#remind").onclick = async () => {
          try { await db.createInvite({ course: code, kind: "reminder", topic: t(`Reminder from your professor: finish ${task ? "“" + task.topic + "”" : "this week’s task"} in ${code}.`) }); el.querySelector("#remind").outerHTML = `<p class="note__meta">Reminder sent to everyone in ${esc(code)}.</p>`; }
          catch (e) { alert(t(e.message)); }
        };
        return;
      }
      const total = (a.stuck || []).reduce((x, y) => x + y.n, 0) || 1;
      const steps = (task?.steps?.length ? task.steps.map((s) => ({ label: s, n: (a.stuck.find((x) => x.label === s) || { n: 0 }).n })) : a.stuck.slice(0, 4))
        .map((s, i) => ({ label: s.label, short: `Step ${i + 1}`, value: Math.round(100 * s.n / total) }));
      const mv = moves(code, a);
      el.querySelector("#ins").innerHTML = `
        ${a.includes_sample ? `<p class="sample-label">Includes sample data for the demo</p>` : ""}
        <div class="keynums">
          <div><b>${a.students}/${Math.max(a.enrolled || 0, a.students)}</b><span>completed</span></div>
          <div><b>${a.avg_conf ?? "–"}/5</b><span>confidence</span></div>
          <div><b>${a.avg_hints ?? "–"}</b><span>hints / session</span></div>
        </div>
        <h2 class="label-caps">Where the class got stuck</h2>
        <div class="boxed">${columns(steps, { caption: "Where the class got stuck" })}
          <ol class="step-key">${steps.map((s, i) => `<li><span>Step ${i + 1}</span> · <span data-no-i18n>${esc(s.label)}</span></li>`).join("")}</ol></div>
        <h2 class="label-caps">Common misconceptions</h2>
        <ul class="boxed list-lines">${(a.misconceptions || []).slice(0, 4).map((m) => `<li><span data-no-i18n>${esc(m.label)}</span> (${m.n} <span>students</span>)</li>`).join("") || `<li>Nothing yet.</li>`}</ul>
        <h2 class="label-caps">Suggested next moves · you decide, nothing is sent automatically</h2>
        ${mv.map((m, i) => moveCard(m, i, false)).join("")}`;
      bindMoves(el, mv);
    },
  };
}

/* ───────── S08 New assignment ───────── */
export function create({ path }) {
  const q = qs(path), pol = store.policy;
  const course = q.get("course") || store.courses[0]?.code || "";
  const kind = q.get("kind") || "problem";
  const html = `${head("New assignment", "#/")}
  <section class="feed">
    ${q.get("why") ? `<div class="privacy-banner"><b>From insight:</b> <span data-no-i18n>${esc(q.get("why"))}</span></div>` : ""}
    <form class="snap" id="f">
      <label class="field">Course<select id="course">${store.courses.map((c) => `<option ${c.code === course ? "selected" : ""}>${esc(c.code)}</option>`).join("")}</select></label>
      <label class="field">Topic<input id="topic" value="${esc(q.get("topic") || "")}" placeholder="e.g. Product rule: step 3 follow-up"></label>
      <label class="field">Instructions for students<textarea id="instr" rows="3" placeholder="What should they work through?"></textarea></label>
      <label class="field">Due date<input id="due" type="date"></label>
      <h2 class="label-caps">Adaptation</h2>
      <label class="setrow"><span>Let hmm. adapt to each student</span><input type="checkbox" id="adapt" checked class="toggle"></label>
      <label class="setrow"><span>Max hints per student</span><input id="maxh" type="number" min="0" value="${pol.maxHints}" class="num"></label>
      <p class="note__meta">University maximum: ${pol.maxHints}. Higher values are capped to the admin’s limit.</p>
      <details class="more"><summary>Suggested character and where students get stuck (optional)</summary>
        <div class="seg-pick" id="kind">${[["problem", "Problem", "socrates"], ["concept", "Concept", "talmid"], ["claim", "Claim", "rival"]].map(([k, l, ch]) =>
          `<button type="button" class="seg-pick__btn ${k === kind ? "is-on" : ""}" data-k="${k}">${l} · ${CH[ch].name}</button>`).join("")}</div>
        <label class="field">Steps students go through (comma-separated, used to find where they get stuck)<input id="steps" placeholder="identify f and g, differentiate each, combine"></label>
        <label class="field">Misconceptions to watch for (comma-separated)<input id="mis" placeholder="multiplies the derivatives"></label>
      </details>
      ${engineBox("Students choose their own character; hmm. suggests one to each student. Final answers are never revealed (university policy).")}
      <p class="auth__msg" id="msg" role="alert"></p>
      <div class="btn-row"><button type="button" class="btn btn--ghost" id="preview">Preview as student</button><button class="btn btn--ink">Publish</button></div>
    </form>
  </section>${staffTabs("create")}`;
  return {
    html, pet: false,
    mount(el) {
      let k = kind;
      el.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => { k = b.dataset.k; el.querySelectorAll("[data-k]").forEach((x) => x.classList.toggle("is-on", x === b)); });
      const build = () => {
        const list = (id) => el.querySelector(id).value.split(",").map((x) => x.trim()).filter(Boolean);
        const capped = Math.min(Math.max(0, +el.querySelector("#maxh").value || 0), pol.maxHints);
        const adaptNote = el.querySelector("#adapt").checked ? "" : " Use the same step size for everyone (do not adapt to the student's profile).";
        return { course: el.querySelector("#course").value, kind: k, topic: el.querySelector("#topic").value.trim(),
          instructions: (el.querySelector("#instr").value.trim() + adaptNote).trim(), steps: list("#steps"), misconceptions: list("#mis"),
          max_hints: capped, due: el.querySelector("#due").value || null };
      };
      el.querySelector("#maxh").addEventListener("change", (e) => {
        if (+e.target.value > pol.maxHints) { e.target.value = pol.maxHints; el.querySelector("#msg").textContent = t(`Capped to ${pol.maxHints}, the admin’s limit (set in Rules & settings).`); }
      });
      el.querySelector("#preview").onclick = () => {
        const tk = build(); if (!tk.topic) return (el.querySelector("#msg").textContent = t("Write the question or topic first."));
        const ch = { problem: "socrates", concept: "talmid", claim: "rival" }[tk.kind];
        sessionStorage.setItem("hmm.preview", JSON.stringify({ ...tk, id: null, char: ch }));
        location.hash = "#/preview";
      };
      el.querySelector("#f").onsubmit = async (e) => {
        e.preventDefault();
        const tk = build();
        if (!tk.topic) return (el.querySelector("#msg").textContent = t("Write the question or topic first."));
        if (+el.querySelector("#maxh").value > pol.maxHints) {
          el.querySelector("#maxh").value = pol.maxHints;
          el.querySelector("#msg").textContent = t(`Capped to ${pol.maxHints}, the admin’s limit (set in Rules & settings).`);
        }
        if (!ask(`Publish “${tk.topic}” to ${tk.course}? Students see it on their Home, and hmm. suggests a character to each.`)) return;
        try { await db.createTask(tk); sessionStorage.setItem("hmm.toast", `Published to ${tk.course}. Students see it on their Home.`); location.hash = "#/"; }   // Flow 7 ends at S07
        catch (err) { el.querySelector("#msg").textContent = t(err.message); }
      };
    },
  };
}

/* Preview as student: what the task looks like on a student's Home, with the character hmm. would suggest. */
export function preview() {
  let tk = {}; try { tk = JSON.parse(sessionStorage.getItem("hmm.preview") || "{}"); } catch {}
  const ch = tk.char || "socrates";
  return {
    html: `${head("Preview as student", "#/create")}
    <section class="feed">
      <p class="note__meta">This is how the task appears on a student’s Home. Nothing is published yet.</p>
      <h2 class="label-caps">Due soon</h2>
      <div class="card-row"><span class="initial initial--${ch}" aria-hidden="true">${CH[ch].initial}</span>
        <span class="card-row__text"><b data-no-i18n>${esc(tk.topic || "")}</b><span><span data-no-i18n>${esc(tk.course || "")}</span> · <span>suggested for you:</span> ${CH[ch].name}</span></span><span class="card-row__end">${esc(tk.due || "")}</span></div>
      ${tk.instructions ? `<p class="dek" data-no-i18n>${esc(tk.instructions)}</p>` : ""}
      ${engineBox(`Each student gets a suggested character from their Learning Snapshot and can switch. Hints: up to ${tk.max_hints ?? store.policy.maxHints}. Final answers are never revealed.`)}
      <a class="btn btn--ink auth__submit" href="#/create">Back to editing</a>
    </section>${staffTabs("create")}`,
    pet: false,
  };
}

export function account({ role }) {
  return {
    html: `${head(role === "admin" ? "Account" : "Account", "#/")}<section class="feed">
      <p class="dek">Signed in as ${esc(role)}. Your role comes from your university account. There is no role picker.</p>
      <div class="setrow"><span>App language</span>${langPicker()}</div>
      <button class="btn btn--ghost" id="out" style="align-self:flex-start">Log out</button></section>${role === "admin" ? adminTabs("account") : staffTabs("account")}`,
    pet: false,
    mount(el) { bindLangPicker(el); el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; }; },
  };
}
