/* Professor/admin landing until S07–S11 are built (steps 5–6). Proves role-based routing works. */
import * as db from "../db.js";

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
    </section>`,
    pet: false,
    mount(el) { el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; }; },
  };
}
