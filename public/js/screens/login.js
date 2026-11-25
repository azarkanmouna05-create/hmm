/* S01 · Login (+ edge states: wrong password, forgot password, create account).
   Copy reused from the earlier Figma Login frame; layout in the editorial style of E1/E2. */
import * as db from "../db.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render({ path }) {
  const mode = path.endsWith("/forgot") ? "forgot" : path.endsWith("/signup") ? "signup" : "signin";
  const title = { signin: "Oh hey, curious mind.", signup: "Make your account.", forgot: "Forgot it? Happens." }[mode];
  const button = { signin: "Sign in", signup: "Create account", forgot: "Send reset link" }[mode];

  const html = `
  <header class="topbar"><span class="logo">hmm<span class="logo__dot"></span></span></header>
  <section class="auth">
    <h1 class="headline">${title}</h1>
    <div class="auth__quote">
      <p>${mode === "forgot" ? "Type your university email and I’ll send you a link." : "“I ask. You figure it out. Deal?”"}</p>
      <span data-chameleon="56"></span>
    </div>
    ${db.isConfigured() ? "" : `<p class="auth__warn" role="status">The database isn’t connected yet (setup step). You can look around in demo mode; nothing is saved online.</p>`}
    <form class="auth__form" id="f" novalidate>
      <label>University email
        <input id="email" type="email" autocomplete="username" inputmode="email" placeholder="you@aui.ma" required>
      </label>
      ${mode !== "forgot" ? `
      <label>Password
        <span class="auth__pw">
          <input id="pw" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" placeholder="${mode === "signup" ? "At least 6 characters" : "Your password"}" required minlength="6">
          <button type="button" class="auth__show" id="show" aria-label="Show password">Show</button>
        </span>
      </label>` : ""}
      <p class="auth__msg" id="msg" role="alert" aria-live="assertive"></p>
      <button class="btn btn--ink auth__submit" id="go">${button}</button>
      ${!db.isConfigured() ? `<button type="button" class="btn btn--ghost auth__submit" id="demo">Continue in demo mode</button>` : ""}
    </form>
    <div class="auth__demo" id="demo-box" hidden>
      <p class="kicker" style="color:var(--muted)">Class demo · one tap, no password</p>
      <div class="auth__demo-row">
        <button class="btn btn--sm btn--ghost" data-demo="student"><span class="initial initial--sm initial--socrates" aria-hidden="true">M</span>New student</button>
        <button class="btn btn--sm btn--ghost" data-demo="returning"><span class="initial initial--sm initial--socrates" aria-hidden="true">I</span>Returning student</button>
        <button class="btn btn--sm btn--ghost" data-demo="professor"><span class="initial initial--sm initial--talmid" aria-hidden="true">S</span>Professor</button>
        <button class="btn btn--sm btn--ghost" data-demo="admin"><span class="initial initial--sm initial--rival" aria-hidden="true">A</span>Admin</button>
      </div>
      <button type="button" class="link-btn" id="restart">↺ Start the demo over (fresh Mouna, default rules, new sample data)</button>
    </div>
    <p class="auth__links">
      ${mode === "signin" ? `<a href="#/login/forgot">Forgot password?</a> · <a href="#/login/signup">New here? Create your account</a>`
        : `<a href="#/login">Back to sign in</a>`}
    </p>
    <p class="auth__fine">Your role (student, professor, admin) comes from your university account. Professors only ever see class-level patterns, never your chats.</p>
  </section>`;

  return {
    html,
    pet: false,
    mount(el) {
      const $ = (q) => el.querySelector(q);
      const msg = (t, ok = false) => { $("#msg").textContent = t; $("#msg").classList.toggle("is-ok", ok); };
      $("#show")?.addEventListener("click", () => {
        const pw = $("#pw"); const show = pw.type === "password";
        pw.type = show ? "text" : "password"; $("#show").textContent = show ? "Hide" : "Show";
      });
      if (db.isConfigured()) db.demoEnabled().then((on) => { if (on) $("#demo-box").hidden = false; });
      el.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", async () => {
        el.querySelectorAll("[data-demo]").forEach((x) => (x.disabled = true)); msg("");
        try { await db.demoSignIn(b.dataset.demo); location.hash = "#/"; }
        catch (err) { msg(err.message); el.querySelectorAll("[data-demo]").forEach((x) => (x.disabled = false)); }
      }));
      $("#restart")?.addEventListener("click", async () => {
        if (!confirm("Start the demo over? Mouna goes back to the Learning Snapshot, rules go back to default, sample data is refreshed. Real students are not affected.")) return;
        $("#restart").disabled = true; msg("Restarting the demo…", true);
        try {
          const r = await fetch("/api/demo-reset", { method: "POST" });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn’t restart the demo.");
          await db.signOut();
          try { Object.keys(localStorage).filter((k) => k.startsWith("hmm.")).forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); } catch {}
          msg("Demo restarted. Tap Student to begin with the Learning Snapshot.", true);
        } catch (err) { msg(err.message); }
        $("#restart").disabled = false;
      });
      $("#demo")?.addEventListener("click", () => { sessionStorage.setItem("hmm.demo", "1"); location.hash = "#/"; });
      $("#f").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = $("#email").value.trim(), pw = $("#pw")?.value || "";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("That doesn’t look like an email address.");
        if (mode !== "forgot" && pw.length < 6) return msg("Use at least 6 characters for your password.");
        if (!db.isConfigured()) return msg("The database isn’t connected yet. Use demo mode for now.");
        $("#go").disabled = true; msg("");
        try {
          if (mode === "forgot") { await db.resetPassword(email); msg("If that email has an account, a reset link is on its way.", true); }
          else { mode === "signup" ? await db.signUp(email, pw) : await db.signIn(email, pw); location.hash = "#/"; }
        } catch (err) { msg(err.message); }
        $("#go").disabled = false;
      });
    },
  };
}
