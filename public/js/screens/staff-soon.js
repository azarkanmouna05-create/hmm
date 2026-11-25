/* Professor/admin landing until S07–S11 are built (steps 5–6). Proves role-based routing works. */
import * as db from "../db.js";
import { store } from "../store.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render({ role }) {
  const label = role === "admin" ? "Admin" : "Professor";
  return {
    html: `
    <header class="topbar"><span class="logo">hmm<span class="logo__dot"></span></span><span class="topbar__spacer"></span>
      <button class="btn btn--sm btn--ghost" id="out">Sign out</button></header>
    <section class="soon">
      <p class="kicker">${label} view</p>
      <h1 class="headline">You’re signed in as ${label.toLowerCase()}.</h1>
      <p class="dek">${role === "admin" ? "The campus dashboard and rules (S10–S11)" : "Class insights and assignments (S07–S09)"} arrive in the next build steps. Your role came from your account; there is no role picker.</p>
      ${store.courses.length ? `<hr class="rule"><h2 class="section-title">${role === "admin" ? "All courses" : "Your courses"}</h2>
      <ul class="courses">${store.courses.map((c) => `<li class="course-row" style="text-decoration:none">
        <span class="course-row__code">${esc(c.code)}</span><span class="course-row__name">${esc(c.name)}</span>
        <span class="course-row__meta">${c.students} student${c.students === 1 ? "" : "s"} joined · join code <b style="color:var(--ink);letter-spacing:.06em">${esc(c.join_code)}</b>${c.demo ? " · demo" : ""}</span></li>`).join("")}</ul>` : ""}
    </section>`,
    pet: false,
    mount(el) { el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; }; },
  };
}
