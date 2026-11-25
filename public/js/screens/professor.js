/* Professor (US6, US7): insights-first. Class-level patterns only (no names, no chats), behind the privacy floor.
   #/                       S07 Professor Home: suggested moves + class pulse per course you teach
   #/insights[/<course>]    S09 Class Insights: stuck steps, misconceptions, confidence, teaching moves
   #/create?course=&topic=  S08 Create Assignment (pre-filled when it comes from an insight: one tap) */
import { CH, KIND } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { icons } from "../ui/icons.js";
import { adminTabs } from "./admin.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const qs = (path) => new URLSearchParams(path.split("?")[1] || "");
const enc = encodeURIComponent;

export const staffTabs = (active) => `
  <nav class="tabbar" aria-label="Main">
    <a href="#/" ${active === "home" ? 'aria-current="page"' : ""}>${icons.home}Classes</a>
    <a href="#/insights" ${active === "insights" ? 'aria-current="page"' : ""}>${icons.courses}Insights</a>
    <a href="#/create" ${active === "create" ? 'aria-current="page"' : ""}>${icons.reflect}New task</a>
    <a href="#/account" ${active === "account" ? 'aria-current="page"' : ""}>${icons.me}Me</a>
  </nav>`;
const top = (title = "") => `<header class="topbar"><a class="logo" href="#/">hmm<span class="logo__dot"></span></a><span class="topbar__spacer"></span><span class="sample-label">${esc(title)}</span></header>`;

/* Teaching moves, ported from the prototype: turn a pattern into something the professor can do. */
export function moves(course, a) {
  const out = [];
  const t = a.stuck?.[0];
  if (t) out.push({ t: `Re-teach “${t.label}” with a worked example`, w: `About ${Math.round(100 * t.n / a.sessions)}% of sessions got stuck here`, act: "plan", course });
  const m = a.misconceptions?.[0];
  if (m) out.push({ t: `Assign a Talmid follow-up on “${m.label}”`, w: "Explaining it back fixes the most common mix-up", act: "task", course, kind: "concept", topic: `Explain: ${m.label}` });
  if (a.avg_conf && a.avg_conf < 4) out.push({ t: "Offer an optional help session", w: `Average confidence is ${a.avg_conf}/5. The invite reaches only students who felt unsure; you never see who.`, act: "invite", course });
  return out;
}
const moveButton = (m, i) => m.act === "plan" ? `<button class="btn btn--sm btn--ink" data-move="${i}">Add to lesson notes</button>`
  : m.act === "task" ? `<a class="btn btn--sm btn--ink" href="#/create?course=${enc(m.course)}&kind=${m.kind}&topic=${enc(m.topic)}&why=${enc(m.w)}">Create task</a>`
  : `<button class="btn btn--sm btn--ink" data-move="${i}">Send anonymous invite</button>`;

function bindMoves(el, list) {
  el.querySelectorAll("[data-move]").forEach((b) => b.onclick = async () => {
    const m = list[+b.dataset.move];
    try {
      if (m.act === "plan") { await db.addPlan(m.course, m.t); b.outerHTML = `<span class="note__meta">Added to your lesson notes.</span>`; }
      if (m.act === "invite") {
        const when = prompt("When and where? (e.g. Thu 4pm, Building 8 room 104)"); if (!when) return;
        await db.createInvite({ course: m.course, topic: `Help session · ${m.course}`, when });
        b.outerHTML = `<span class="note__meta">Invite sent anonymously.</span>`;
      }
    } catch (e) { alert(e.message); }
  });
}

/* ───────── S07 ───────── */
export function home() {
  const courses = store.courses;
  const html = `${top("Professor")}
  <section class="feed">
    <p class="kicker">This week</p>
    <h1 class="headline">Suggested moves</h1>
    <p class="dek">From class-level patterns only (groups of ${store.policy.minGroup}+). You decide what to do; nothing is sent automatically.</p>
    <div id="moves"><p class="note__meta">Loading class pulse…</p></div>
    <hr class="rule">
    <h2 class="section-title">Your classes</h2>
    <ul class="courses">${courses.map((c) => `<li><a class="course-row" href="#/insights/${enc(c.code)}">
      <span class="course-row__code">${esc(c.code)}</span><span class="course-row__name">${esc(c.name)}</span>
      <span class="course-row__meta" id="pulse-${enc(c.code)}">${c.students} joined · join code <b style="color:var(--ink);letter-spacing:.06em">${esc(c.join_code)}</b>${c.demo ? " · demo" : ""}</span></a></li>`).join("")
      || `<li class="empty"><p class="dek">No classes yet. Your admin assigns the courses you teach.</p></li>`}</ul>
  </section>${staffTabs("home")}`;
  return {
    html, pet: false,
    async mount(el) {
      const all = [];
      for (const c of courses) {
        try {
          const a = await db.classInsights(c.code);
          const pulse = el.querySelector(`[id="pulse-${enc(c.code)}"]`);
          if (pulse) pulse.insertAdjacentHTML("beforeend", a.hidden ? ` · patterns at ${a.floor}+ (${a.students} so far)`
            : ` · most stuck on “${esc(a.stuck?.[0]?.label || "–")}” · confidence ${a.avg_conf}/5${a.includes_sample ? " · includes sample data" : ""}`);
          if (!a.hidden) moves(c.code, a).slice(0, 1).forEach((m) => all.push({ ...m, sample: a.includes_sample }));
        } catch {}
      }
      el.querySelector("#moves").innerHTML = all.length ? all.map((m, i) => `
        <div class="move"><p class="kicker" style="color:var(--muted)">${esc(m.course)}${m.sample ? " · sample data" : ""}</p>
          <p class="move__t">${esc(m.t)}</p><p class="note__meta">${esc(m.w)}</p>
          <div class="note__actions">${moveButton(m, i)}<a class="btn btn--sm btn--ghost" href="#/insights/${enc(m.course)}">See insights</a></div></div>`).join("")
        : `<p class="dek">Moves appear once at least ${store.policy.minGroup} students finish sessions in a class.</p>`;
      bindMoves(el, all);
    },
  };
}

/* ───────── S09 ───────── */
export function insights({ path }) {
  const code = decodeURIComponent((path.split("?")[0].split("/")[2]) || "") || store.courses[0]?.code || "";
  const course = store.courses.find((c) => c.code === code);
  const taskId = qs(path).get("task");
  const tasks = store.tasks.filter((t) => t.course === code);
  const html = `${top("Class insights")}
  <section class="feed">
    <nav class="tabs tabs--inline">${store.courses.map((c) => `<a href="#/insights/${enc(c.code)}" ${c.code === code ? 'aria-current="page"' : ""}>${esc(c.code)}</a>`).join("")}</nav>
    <h1 class="headline">${esc(course?.name || code || "No classes yet")}</h1>
    ${tasks.length ? `<label class="field">Task<select id="task"><option value="">All sessions in ${esc(code)}</option>${tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === taskId ? "selected" : ""}>${esc(t.topic)}</option>`).join("")}</select></label>` : ""}
    <div id="ins"><p class="note__meta">Loading…</p></div>
  </section>${staffTabs("insights")}`;
  return {
    html, pet: false,
    async mount(el) {
      el.querySelector("#task")?.addEventListener("change", (e) => { location.hash = `#/insights/${enc(code)}${e.target.value ? "?task=" + e.target.value : ""}`; });
      if (!code) return (el.querySelector("#ins").innerHTML = "");
      let a; try { a = await db.classInsights(code, taskId || null); } catch (e) { el.querySelector("#ins").innerHTML = `<p class="dek">${esc(e.message)}</p>`; return; }
      if (a.hidden) {
        el.querySelector("#ins").innerHTML = `<aside class="why"><span class="why__cham" data-chameleon="30"></span><p>Insights are hidden to protect privacy: only ${a.students} student${a.students === 1 ? "" : "s"} so far. Patterns appear once ${a.floor} or more students have taken part, so nobody can be singled out.</p></aside>`;
        import("../chameleon/chameleon.js").then((m) => m.mountInlineChameleons(el)); return;
      }
      const bars = (list, cls) => { const mx = Math.max(1, ...list.map((x) => x.n)); return list.slice(0, 5).map((x) =>
        `<div class="bar bar--wide"><span>${esc(x.label)}</span><span class="bar__track"><span class="bar__fill bar__fill--${cls}" style="width:${Math.round(100 * x.n / mx)}%"></span></span><b>${x.n}</b></div>`).join("") || `<p class="note__meta">Nothing yet.</p>`; };
      const mv = moves(code, a);
      el.querySelector("#ins").innerHTML = `
        ${a.includes_sample ? `<p class="sample-label">Includes sample data for the demo</p>` : ""}
        <div class="tiles">
          <div><b>${a.students}</b><span>students</span></div><div><b>${a.sessions}</b><span>sessions</span></div>
          <div><b>${a.avg_conf ?? "–"}</b><span>avg confidence /5</span></div><div><b>${a.avg_hints ?? "–"}</b><span>avg hints</span></div>
          <div><b>${a.answer_requests}</b><span>asked for the answer</span></div>
          <div><b style="font-size:15px;line-height:1.35">${Object.entries(a.chars || {}).map(([k, n]) => `${CH[k]?.name || k} ${n}`).join("<br>")}</b><span>characters used</span></div>
        </div>
        <h2 class="section-title">Where the class gets stuck</h2>${bars(a.stuck || [], "socrates")}
        <h2 class="section-title">Common misconceptions</h2>${bars(a.misconceptions || [], "rival")}
        <hr class="rule"><h2 class="section-title">Suggested teaching moves</h2>
        ${mv.map((m, i) => `<div class="move"><p class="move__t">${esc(m.t)}</p><p class="note__meta">${esc(m.w)}</p><div class="note__actions">${moveButton(m, i)}</div></div>`).join("") || `<p class="note__meta">No moves suggested.</p>`}
        <p class="auth__fine">Class-level patterns only. No names, no chat text. Groups under ${a.floor} are hidden.</p>`;
      bindMoves(el, mv);
    },
  };
}

/* ───────── S08 ───────── */
export function create({ path }) {
  const q = qs(path), pol = store.policy;
  const course = q.get("course") || store.courses[0]?.code || "";
  const kind = q.get("kind") || "problem";
  const html = `${top("New task")}
  <section class="feed">
    <p class="kicker">Create assignment</p>
    <h1 class="headline">${q.get("topic") ? "From an insight, ready to go." : "A new question for your class."}</h1>
    ${q.get("why") ? `<aside class="why"><span class="why__cham" data-chameleon="30"></span><p>${esc(q.get("why"))}</p></aside>` : ""}
    <form class="snap" id="f">
      <label class="field">Course<select id="course">${store.courses.map((c) => `<option ${c.code === course ? "selected" : ""}>${esc(c.code)}</option>`).join("")}</select></label>
      <p class="field-label">Type (decides the character)</p>
      <div class="picks picks--row" id="kind">${Object.entries(KIND).map(([k, ch]) => `<button type="button" class="pick ${k === kind ? "is-on" : ""}" data-k="${k}"><span>${{ problem: "Problem", concept: "Concept", claim: "Claim" }[k]}</span><small>${CH[ch].name}</small></button>`).join("")}</div>
      <label class="field">Question / topic<textarea id="topic" rows="2" required>${esc(q.get("topic") || "")}</textarea></label>
      <label class="field">Instructions for hmm. (optional)<textarea id="instr" rows="2" placeholder="e.g. Use the product rule. Don't accept memorised formulas."></textarea></label>
      <label class="field">Steps students go through (comma-separated, used to find where they get stuck)<input id="steps" placeholder="identify f and g, differentiate each, combine"></label>
      <label class="field">Misconceptions to watch for (comma-separated)<input id="mis" placeholder="multiplies the derivatives"></label>
      <div class="picks picks--row"><label class="field" style="flex:1">Max hints (university max ${pol.maxHints})<input id="maxh" type="number" min="0" max="${pol.maxHints}" value="${pol.maxHints}"></label>
        <label class="field" style="flex:1">Due<input id="due" type="date"></label></div>
      <p class="auth__msg" id="msg" role="alert"></p>
      <button class="btn btn--ink auth__submit">Publish to class</button>
    </form>
  </section>${staffTabs("create")}`;
  return {
    html, pet: false,
    mount(el) {
      let k = kind;
      el.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => { k = b.dataset.k; el.querySelectorAll("[data-k]").forEach((x) => x.classList.toggle("is-on", x === b)); });
      el.querySelector("#f").onsubmit = async (e) => {
        e.preventDefault();
        const list = (id) => el.querySelector(id).value.split(",").map((x) => x.trim()).filter(Boolean);
        const topic = el.querySelector("#topic").value.trim();
        if (!topic) return (el.querySelector("#msg").textContent = "Write the question or topic first.");
        const t = { course: el.querySelector("#course").value, kind: k, topic, instructions: el.querySelector("#instr").value.trim(),
          steps: list("#steps"), misconceptions: list("#mis"), max_hints: Math.min(+el.querySelector("#maxh").value || pol.maxHints, pol.maxHints),
          due: el.querySelector("#due").value || null };
        try { await db.createTask(t); sessionStorage.setItem("hmm.toast", `Published to ${t.course}. Students see it on their Home.`); location.hash = "#/insights/" + enc(t.course); }
        catch (err) { el.querySelector("#msg").textContent = err.message; }
      };
    },
  };
}

export function account({ role }) {
  return {
    html: `${top(role)}<section class="feed"><p class="kicker">Account</p><h1 class="headline">Signed in as ${esc(role)}.</h1>
      <p class="dek">Your role comes from your university account. There is no role picker.</p>
      <button class="btn btn--ghost" id="out" style="align-self:flex-start">Sign out</button></section>${role === "admin" ? adminTabs("account") : staffTabs("account")}`,
    pet: false,
    mount(el) { el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; }; },
  };
}
