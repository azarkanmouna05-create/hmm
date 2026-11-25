/* Admin (US8): campus dashboard + rules that are actually enforced (by the database and the AI function).
   #/        S10 Admin Dashboard
   #/rules   S11 Admin Rules: characters per course, max hints, privacy floor, retention, challenge range,
             languages, allowed email domains; courses, join codes and professors */
import { CH, LEVELS } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { icons } from "../ui/icons.js";
import { ask } from "../i18n/index.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ALL_LANGS = ["English", "Français", "Darija", "العربية"];
const tabs = (active) => `
  <nav class="tabbar" aria-label="Main">
    <a href="#/" ${active === "dash" ? 'aria-current="page"' : ""}>${icons.home}Dashboard</a>
    <a href="#/rules" ${active === "rules" ? 'aria-current="page"' : ""}>${icons.courses}Rules</a>
    <a href="#/account" ${active === "account" ? 'aria-current="page"' : ""}>${icons.me}Me</a>
  </nav>`;
const top = `<header class="topbar"><a class="logo" href="#/">hmm<span class="logo__dot"></span></a><span class="topbar__spacer"></span><span class="sample-label">Admin</span></header>`;

export function dashboard() {
  const html = `${top}
  <section class="feed">
    <p class="kicker">Campus</p><h1 class="headline">How hmm. is being used</h1>
    <div id="dash"><p class="note__meta">Loading…</p></div>
    <hr class="rule">
    <div class="note__actions" style="flex-wrap:wrap">
      <button class="btn btn--sm btn--ghost" id="retain">Apply data retention now</button>
      <button class="btn btn--sm btn--ghost" id="reset">Reset demo (rules + sample data)</button>
    </div>
    <p class="auth__msg" id="msg" role="status"></p>
  </section>${tabs("dash")}`;
  return {
    html, pet: false,
    async mount(el) {
      const msg = (t, ok = true) => { const m = el.querySelector("#msg"); m.textContent = t; m.classList.toggle("is-ok", ok); };
      try {
        const s = await db.campusStats();
        const mx = Math.max(1, ...Object.values(s.by_char || {}));
        el.querySelector("#dash").innerHTML = `
          ${s.sample_rows ? `<p class="sample-label">Includes ${s.sample_rows} sample sessions for the demo</p>` : ""}
          <div class="tiles">
            <div><b>${s.students}</b><span>students</span></div><div><b>${s.professors}</b><span>professors</span></div>
            <div><b>${s.sessions_week}</b><span>sessions this week</span></div><div><b>${s.avg_conf ?? "–"}</b><span>avg confidence /5</span></div>
            <div><b>${s.avg_hints ?? "–"}</b><span>avg hints</span></div><div><b>${s.answer_requests}</b><span>asked for the answer</span></div>
          </div>
          <h2 class="section-title">Characters</h2>
          ${Object.keys(CH).map((k) => `<div class="bar"><span>${CH[k].name}</span><span class="bar__track"><span class="bar__fill bar__fill--${k}" style="width:${Math.round(100 * (s.by_char?.[k] || 0) / mx)}%"></span></span><b>${s.by_char?.[k] || 0}</b></div>`).join("")}
          <h2 class="section-title">Courses</h2>
          <ul class="courses">${(s.by_course || []).map((c) => `<li class="course-row"><span class="course-row__code">${esc(c.course)}</span>
            <span class="course-row__name">${esc(c.name)}</span><span class="course-row__meta">${c.students} joined · ${c.sessions} sessions · confidence ${c.avg_conf ?? "–"}/5${c.demo ? " · demo" : ""}</span></li>`).join("")}</ul>
          <p class="auth__fine">Counts only. Admins never see names or chat text.</p>`;
      } catch (e) { el.querySelector("#dash").innerHTML = `<p class="dek">${esc(e.message)}</p>`; }
      el.querySelector("#retain").onclick = async () => {
        if (!ask(`Delete private chats older than the retention period (${store.policy.retention})?`)) return;
        try { const n = await db.applyRetention(); msg(`Done. ${n} old private session${n === 1 ? "" : "s"} deleted.`); } catch (e) { msg(e.message, false); }
      };
      el.querySelector("#reset").onclick = async () => {
        if (!ask("Restore default rules and fresh sample data? Real students’ data is not touched.")) return;
        try { await db.resetDemo(); msg("Demo reset: default rules and fresh sample data."); } catch (e) { msg(e.message, false); }
      };
    },
  };
}

export function rules() {
  const p = JSON.parse(JSON.stringify(store.policy));
  const courses = store.courses;
  const html = `${top}
  <section class="feed">
    <p class="kicker">Rules</p><h1 class="headline">Rules hmm. must follow</h1>
    <p class="dek">These are enforced by the server and the database, not just shown. Changes apply from the next reply.</p>

    <h2 class="section-title">Characters per course</h2>
    <table class="rules-table"><thead><tr><th></th>${Object.keys(CH).map((k) => `<th>${CH[k].name}</th>`).join("")}</tr></thead>
      <tbody>${courses.map((c) => `<tr><td><b>${esc(c.code)}</b></td>${Object.keys(CH).map((k) =>
        `<td><input type="checkbox" data-c="${esc(c.code)}" data-k="${k}" ${p.chars?.[c.code]?.[k] === false ? "" : "checked"} aria-label="${CH[k].name} in ${esc(c.code)}"></td>`).join("")}</tr>`).join("")}</tbody></table>

    <div class="picks picks--row">
      <label class="field" style="flex:1">Max hints per task<input id="maxh" type="number" min="0" max="10" value="${p.maxHints}"></label>
      <label class="field" style="flex:1">Privacy floor (min group)<input id="ming" type="number" min="3" max="50" value="${p.minGroup}"></label>
    </div>
    <label class="field">Data retention<select id="ret">${["30 days", "1 semester", "1 year"].map((r) => `<option ${r === p.retention ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    <div class="picks picks--row">
      <label class="field" style="flex:1">Challenge from<select id="cmin">${LEVELS.map((l) => `<option ${l === p.challengeMin ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field" style="flex:1">to<select id="cmax">${LEVELS.map((l) => `<option ${l === p.challengeMax ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <p class="field-label">Allowed languages</p>
    <div class="picks picks--row">${ALL_LANGS.map((l) => `<button type="button" class="pick ${p.langs.includes(l) ? "is-on" : ""}" data-l="${esc(l)}"><span>${esc(l)}</span></button>`).join("")}</div>
    <label class="field">Who can sign up (email domains, comma-separated)<input id="doms" value=""></label>
    <button class="btn btn--ink auth__submit" id="save">Save rules</button>
    <p class="auth__msg" id="msg" role="status"></p>

    <hr class="rule">
    <h2 class="section-title">Courses and professors</h2>
    <ul class="courses">${courses.map((c) => `<li class="course-row"><span class="course-row__code">${esc(c.code)}</span>
      <span class="course-row__name">${esc(c.name)}</span><span class="course-row__meta">join code <b style="color:var(--ink)">${esc(c.join_code)}</b> · ${c.students} joined · <span data-teachers="${esc(c.code)}"></span></span></li>`).join("")}</ul>
    <form class="join" id="addCourse"><label>New course</label><span class="join__row"><input id="ncode" placeholder="BUS 2201" style="text-transform:none;letter-spacing:0"><input id="nname" placeholder="Marketing" style="text-transform:none;letter-spacing:0"><button class="btn btn--ink">Add</button></span></form>
    <form class="join" id="assign"><label>Assign a professor (works before they sign up)</label><span class="join__row">
      <input id="pemail" type="email" placeholder="name@aui.ma" style="text-transform:none;letter-spacing:0">
      <select id="pcourse">${courses.map((c) => `<option>${esc(c.code)}</option>`).join("")}</select><button class="btn btn--ink">Assign</button></span></form>
    <p class="auth__msg" id="msg2" role="status"></p>
  </section>${tabs("rules")}`;
  return {
    html, pet: false,
    async mount(el) {
      const msg = (id, t, ok = true) => { const m = el.querySelector(id); m.textContent = t; m.classList.toggle("is-ok", ok); };
      db.policyDomains().then((d) => (el.querySelector("#doms").value = d.join(", "))).catch(() => {});
      db.courseTeachers().then((rows) => courses.forEach((c) => {
        const t = rows.filter((r) => r.course === c.code);
        el.querySelector(`[data-teachers="${c.code}"]`).textContent = t.length ? t.map((r) => r.email + (r.pending ? " (invited)" : "")).join(", ") : "no professor yet";
      })).catch(() => {});
      el.querySelectorAll("[data-l]").forEach((b) => b.onclick = () => b.classList.toggle("is-on"));
      el.querySelector("#save").onclick = async () => {
        const chars = {};
        el.querySelectorAll("[data-c]").forEach((i) => { (chars[i.dataset.c] ||= {})[i.dataset.k] = i.checked; });
        const langs = [...el.querySelectorAll("[data-l].is-on")].map((b) => b.dataset.l);
        const cmin = el.querySelector("#cmin").value, cmax = el.querySelector("#cmax").value;
        if (LEVELS.indexOf(cmin) > LEVELS.indexOf(cmax)) return msg("#msg", "Challenge “from” must be easier than “to”.", false);
        if (!langs.length) return msg("#msg", "Keep at least one language.", false);
        const next = { ...p, chars, maxHints: +el.querySelector("#maxh").value, minGroup: Math.max(3, +el.querySelector("#ming").value),
          retention: el.querySelector("#ret").value, challengeMin: cmin, challengeMax: cmax, langs,
          allowedDomains: el.querySelector("#doms").value.split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean) };
        try { await db.updatePolicy(next); store.policy = next; msg("#msg", "Saved. Every new reply follows these rules."); }
        catch (e) { msg("#msg", e.message, false); }
      };
      el.querySelector("#addCourse").onsubmit = async (e) => {
        e.preventDefault();
        try { const r = await db.createCourse(el.querySelector("#ncode").value, el.querySelector("#nname").value);
          sessionStorage.setItem("hmm.toast", `${r.code} created. Join code: ${r.join_code}`); await db.myCourses(); location.reload(); }
        catch (err) { msg("#msg2", err.message, false); }
      };
      el.querySelector("#assign").onsubmit = async (e) => {
        e.preventDefault();
        try { const r = await db.assignTeacher(el.querySelector("#pemail").value, el.querySelector("#pcourse").value);
          msg("#msg2", r === "pending" ? "Invited: they’ll teach this course as soon as they sign up." : "Assigned."); }
        catch (err) { msg("#msg2", err.message, false); }
      };
    },
  };
}

export { tabs as adminTabs };
