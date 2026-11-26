/* Admin (US8, Flow 8): S10 Campus dashboard and S11 Rules & settings (MP4 "after" wireframes).
   Rules are enforced by the database and the AI function, not just shown. */
import { CH, LEVELS } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { icons } from "../ui/icons.js";
import { ask, t } from "../i18n/index.js";
import { engineBox } from "../ui/engine.js";
import { columns, donut, stack } from "../ui/charts.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ALL_LANGS = ["English", "Français", "Darija", "العربية"];
const tabs = (active) => `
  <nav class="tabbar" aria-label="Main">
    <a href="#/" ${active === "dash" ? 'aria-current="page"' : ""}>${icons.home}Dashboard</a>
    <a href="#/rules" ${active === "rules" ? 'aria-current="page"' : ""}>${icons.courses}Rules</a>
    <a href="#/logout">${icons.me}Log out</a>
  </nav>`;
export { tabs as adminTabs };

let last = null;
function exportCsv(s) {
  const rows = [["metric", "value"], ["active students this week", s.active_week ?? ""], ["sessions this week", s.sessions_week], ["avg hints per session", s.avg_hints],
    ["answer requests", s.answer_requests], ["answer requests turned into questions", "100%"], [], ["course", "students joined", "sessions", "answer requests", "avg confidence"],
    ...(s.by_course || []).map((c) => [c.course, c.students, c.sessions, c.answer_requests ?? "", c.avg_conf ?? ""]), [], ["character", "sessions"],
    ...Object.entries(s.by_char || {}), [], ["challenge level", "sessions"], ...Object.entries(s.by_level || {}), [], ["note", "Anonymized: no individual student data."]];
  const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `hmm-campus-report-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ───────── S10 Campus dashboard ───────── */
export function dashboard() {
  const html = `
  <header class="apphead"><span></span><h1 class="apphead__title">Campus dashboard</h1><button class="btn btn--sm btn--ghost apphead__end" id="export">Export</button></header>
  <section class="feed">
    <div id="dash" class="cards"><p class="note__meta">Loading…</p></div>
    <p class="note__meta">Anonymized: no individual student data.</p>
    <details class="more"><summary>Demo tools</summary>
      <div class="btn-row"><button class="btn btn--sm btn--ghost" id="retain">Apply data retention now</button><button class="btn btn--sm btn--ghost" id="reset">Reset demo (rules + sample data)</button></div>
      <p class="auth__msg" id="msg" role="status"></p></details>
  </section>${tabs("dash")}`;
  return {
    html, pet: false,
    async mount(el) {
      const msg = (x, ok = true) => { const m = el.querySelector("#msg"); m.textContent = t(x); m.classList.toggle("is-ok", ok); };
      el.querySelector("#export").onclick = () => last ? exportCsv(last) : null;
      try {
        const s = last = await db.campusStats();
        const lv = s.by_level || {};
        const alerts = s.alerts || [];
        el.querySelector("#dash").innerHTML = `
          ${s.sample_rows ? `<p class="sample-label">Includes ${s.sample_rows} sample sessions for the demo</p>` : ""}
          <div class="keynums keynums--2">
            <div><b>${s.active_week ?? s.students}</b><span>active students this week</span></div>
            <div><b>${s.sessions_week}</b><span>sessions this week</span></div>
            <div><b>${s.avg_hints ?? "–"}</b><span>avg hints per session</span></div>
            <div><b>${s.answer_requests ? "100%" : "–"}</b><span>answer requests turned into questions</span></div>
          </div>
          <h2 class="label-caps">Sessions per course</h2>
          <div class="boxed">${columns((s.by_course || []).map((c) => ({ label: c.course, short: c.course.split(" ")[0], value: c.sessions })), { caption: "Sessions per course", unit: "" })}</div>
          <h2 class="label-caps">Character usage</h2>
          <div class="boxed">${donut([["socrates", "var(--viz-1)"], ["talmid", "var(--viz-2)"], ["rival", "var(--viz-3)"]].map(([k, col]) => ({ label: CH[k].name, value: s.by_char?.[k] || 0, color: col })), { caption: "Character usage" })}</div>
          <h2 class="label-caps">How hmm. adapts, campus-wide</h2>
          <div class="boxed">${stack([["Gentle", "var(--viz-lvl-1)", "var(--ink)"], ["Balanced", "var(--viz-lvl-2)", "#fff"], ["Tough", "var(--viz-lvl-3)", "#fff"]].map(([l, col, ink]) => ({ label: l, value: lv[l] || 0, color: col, ink })), { caption: "Challenge levels across sessions" })}
            ${Object.keys(lv).length ? "" : `<p class="note__meta">Needs database step 006.</p>`}</div>
          <button type="button" class="alert alert--btn" id="alerts"><b>${alerts.length} integrity alert${alerts.length === 1 ? "" : "s"}</b>
            <span>${alerts.length ? `e.g. unusual answer-request rate in ${esc(alerts[0].course)} ›` : "No unusual patterns this week."}</span></button>
          <div id="alert-list" hidden>${alerts.map((a) => `<div class="move-card"><div><b data-no-i18n>${esc(a.course)}</b>
            <span>${a.rate} answer requests per session vs ${a.campus} campus average. Check that the task fits the class, or remind students that hmm. never gives final answers.</span></div>
            <a class="btn btn--sm btn--ghost move__btn" href="#/rules">Review rules</a></div>`).join("")}</div>`;
        el.querySelector("#alerts").onclick = () => { const l = el.querySelector("#alert-list"); l.hidden = !l.hidden; };
      } catch (e) { el.querySelector("#dash").innerHTML = `<p class="dek">${esc(e.message)}</p>`; }
      el.querySelector("#retain").onclick = async () => {
        if (!ask(`Delete private chats older than the retention period (${store.policy.retention})?`)) return;
        try { const n = await db.applyRetention(); msg(`Done. ${n} old private sessions deleted.`); } catch (e) { msg(e.message, false); }
      };
      el.querySelector("#reset").onclick = async () => {
        if (!ask("Restore default rules and fresh sample data? Real students’ data is not touched.")) return;
        try { await db.resetDemo(); msg("Demo reset: default rules and fresh sample data."); } catch (e) { msg(e.message, false); }
      };
    },
  };
}

/* ───────── S11 Rules & settings ───────── */
export function rules() {
  const p = JSON.parse(JSON.stringify(store.policy));
  const courses = store.courses;
  const toggle = (attrs, on, label) => `<label class="switch"><input type="checkbox" ${attrs} ${on ? "checked" : ""} aria-label="${esc(label)}"><span></span></label>`;
  const html = `
  <header class="apphead"><a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a><h1 class="apphead__title">Rules & settings</h1><span></span></header>
  <section class="feed">
    <h2 class="label-caps">Characters per course</h2>
    <table class="rules-table"><thead><tr><th>Course</th>${Object.keys(CH).map((k) => `<th>${CH[k].name}</th>`).join("")}</tr></thead>
      <tbody>${courses.map((c) => `<tr><td><b data-no-i18n>${esc(c.code)}</b></td>${Object.keys(CH).map((k) =>
        `<td>${toggle(`data-c="${esc(c.code)}" data-k="${k}"`, p.chars?.[c.code]?.[k] !== false, `${CH[k].name} in ${c.code}`)}</td>`).join("")}</tr>`).join("")}</tbody></table>

    <h2 class="label-caps">Integrity rules</h2>
    <div class="setrow"><span>Never reveal final answers</span>${toggle('id="never" disabled', true, "Never reveal final answers (always on)")}</div>
    <div class="setrow"><span>Max hints per task</span><input id="maxh" type="number" min="0" max="10" value="${p.maxHints}" class="num"></div>
    <div class="setrow"><span>Min. group size in insights</span><span class="num-wrap"><input id="ming" type="number" min="3" max="50" value="${p.minGroup}" class="num"> <span>students</span></span></div>
    <div class="setrow"><span>Data kept for</span><select id="ret">${["30 days", "1 semester", "1 year"].map((r) => `<option ${r === p.retention ? "selected" : ""}>${r}</option>`).join("")}</select></div>

    <h2 class="label-caps">Adaptation limits</h2>
    <div class="setrow"><span>Challenge range</span><span class="num-wrap"><select id="cmin">${LEVELS.map((l) => `<option ${l === p.challengeMin ? "selected" : ""}>${l}</option>`).join("")}</select> – <select id="cmax">${LEVELS.map((l) => `<option ${l === p.challengeMax ? "selected" : ""}>${l}</option>`).join("")}</select></span></div>
    <div class="setrow setrow--wrap"><span>Languages</span><div class="seg-pick">${ALL_LANGS.map((l) => `<button type="button" class="seg-pick__btn ${p.langs.includes(l) ? "is-on" : ""}" data-l="${esc(l)}">${p.langs.includes(l) ? "✓ " : ""}${esc(l)}</button>`).join("")}</div></div>
    ${engineBox("Sets the boundaries hmm. adapts within, for every course.")}
    <p class="note__meta">Changes stay pending until you save. You will be asked to confirm.</p>
    <button class="btn btn--ink auth__submit" id="save">Save changes</button>
    <p class="auth__msg" id="msg" role="status"></p>

    <details class="more"><summary>Courses, professors and sign-up</summary>
      <label class="field">Who can sign up (email domains, comma-separated)<input id="doms" value=""></label>
      <ul class="cards">${courses.map((c) => `<li class="note__meta"><b data-no-i18n style="color:var(--ink)">${esc(c.code)}</b> · ${esc(c.name)} · join code <b data-no-i18n style="color:var(--ink)">${esc(c.join_code)}</b> · <span data-teachers="${esc(c.code)}"></span></li>`).join("")}</ul>
      <form class="join" id="addCourse"><label>New course</label><span class="join__row"><input id="ncode" placeholder="BUS 2201" style="text-transform:none;letter-spacing:0"><input id="nname" placeholder="Marketing" style="text-transform:none;letter-spacing:0"><button class="btn btn--ink">Add</button></span></form>
      <form class="join" id="assign"><label>Assign a professor (works before they sign up)</label><span class="join__row">
        <input id="pemail" type="email" placeholder="name@aui.ma" style="text-transform:none;letter-spacing:0">
        <select id="pcourse">${courses.map((c) => `<option>${esc(c.code)}</option>`).join("")}</select><button class="btn btn--ink">Assign</button></span></form>
      <p class="auth__msg" id="msg2" role="status"></p>
    </details>
  </section>${tabs("rules")}`;
  return {
    html, pet: false,
    async mount(el) {
      const msg = (id, x, ok = true) => { const m = el.querySelector(id); m.textContent = t(x); m.classList.toggle("is-ok", ok); };
      el.querySelector("#never").parentElement.onclick = () => msg("#msg", "Never revealing final answers is university policy, so it is always on.");
      db.policyDomains().then((d) => (el.querySelector("#doms").value = d.join(", "))).catch(() => {});
      db.courseTeachers().then((rows) => courses.forEach((c) => {
        const tt = rows.filter((r) => r.course === c.code);
        el.querySelector(`[data-teachers="${c.code}"]`).textContent = tt.length ? tt.map((r) => r.email + (r.pending ? " (invited)" : "")).join(", ") : t("no professor yet");
      })).catch(() => {});
      el.querySelectorAll("[data-l]").forEach((b) => b.onclick = () => { b.classList.toggle("is-on"); b.textContent = (b.classList.contains("is-on") ? "✓ " : "") + b.dataset.l; });
      el.querySelector("#save").onclick = async () => {
        const chars = {};
        el.querySelectorAll("[data-c]").forEach((i) => { (chars[i.dataset.c] ||= {})[i.dataset.k] = i.checked; });
        const langs = [...el.querySelectorAll("[data-l].is-on")].map((b) => b.dataset.l);
        const cmin = el.querySelector("#cmin").value, cmax = el.querySelector("#cmax").value;
        if (LEVELS.indexOf(cmin) > LEVELS.indexOf(cmax)) return msg("#msg", "Challenge “from” must be easier than “to”.", false);
        if (!langs.length) return msg("#msg", "Keep at least one language.", false);
        if (!ask("Save these rules? They apply to every course from the next reply.")) return;
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
