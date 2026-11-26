/* S01 · Login (+ edge states: wrong password, forgot password, create account).
   Copy reused from the earlier Figma Login frame; layout in the editorial style of E1/E2. */
import * as db from "../db.js";
import { langPicker, bindLangPicker, ask } from "../i18n/index.js";
import { engineBox } from "../ui/engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render({ path }) {
  const mode = path.endsWith("/forgot") ? "forgot" : path.endsWith("/signup") ? "signup" : "signin";
  const title = { signin: "Oh hey, curious mind.", signup: "Make your account.", forgot: "Forgot it? Happens." }[mode];
  const button = { signin: "Log in", signup: "Create account", forgot: "Send reset link" }[mode];
  // Pixel thought-bubble logo (MP4 S01).
  const bubble = `<svg class="bubble" viewBox="0 0 160 100" role="img" aria-label="hmm.">
    <path d="M44 14h8v-4h28v4h8v-4h20v4h8v4h6v6h4v8h4v14h-4v6h-4v4h-8v4h-14v4h-24v-4h-16v-4h-10v-4h-6v-6h-4v-16h4v-6h4v-4h8z" fill="#FFFDF9" stroke="var(--ink)" stroke-width="2" shape-rendering="crispEdges"/>
    <rect x="30" y="70" width="10" height="8" fill="none" stroke="var(--ink)" stroke-width="2" shape-rendering="crispEdges"/>
    <rect x="18" y="84" width="6" height="6" fill="none" stroke="var(--ink)" stroke-width="2" shape-rendering="crispEdges"/>
    <rect x="10" y="94" width="4" height="4" fill="var(--ink)"/>
    <text x="92" y="50" text-anchor="middle" font-family="Pixelify Sans, monospace" font-weight="700" font-size="30" fill="var(--ink)">hmm</text>
    <circle class="bubble__dot logo__dot" cx="126" cy="46" r="4" fill="var(--socrates)"/></svg>`;

  const html = `
  <header class="apphead"><span></span><h1 class="apphead__title" style="font-family:var(--font-ui)">hmm.</h1><span class="apphead__end">${langPicker()}</span></header>
  <section class="auth">
    ${mode === "signin" ? bubble : `<h2 class="headline">${title}</h2>`}
    ${mode === "forgot" ? `<p class="dek">Enter your university email and we will send a reset link.</p>` : ""}
    ${db.isConfigured() ? "" : `<p class="auth__warn" role="status">The database isn’t connected yet (setup step). You can look around in demo mode; nothing is saved online.</p>`}
    <form class="auth__form" id="f" novalidate>
      <label>University email
        <input id="email" type="email" autocomplete="username" inputmode="email" placeholder="name@aui.ma" required>
      </label>
      ${mode !== "forgot" ? `
      <label>Password
        <span class="auth__pw">
          <input id="pw" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" placeholder="${mode === "signup" ? "At least 6 characters" : "Password"}" required minlength="6">
          <button type="button" class="auth__show" id="show" aria-label="Show password">Show</button>
        </span>
      </label>` : ""}
      <p class="auth__msg" id="msg" role="alert" aria-live="assertive"></p>
      <button class="btn btn--ink auth__submit" id="go">${button}</button>
      ${mode === "signin" ? `<button type="button" class="btn btn--ghost auth__submit" id="sso">Sign in with University SSO</button>` : ""}
      ${!db.isConfigured() ? `<button type="button" class="btn btn--ghost auth__submit" id="demo">Continue in demo mode</button>` : ""}
    </form>
    <p class="auth__links" style="text-align:center">
      ${mode === "signin" ? `<a href="#/login/forgot">Forgot password?</a> · <a href="#/login/signup">New here? Create your account</a>`
        : `<a href="#/login">Back to log in</a>`}
    </p>
    ${mode === "forgot" ? engineBox("Students on university SSO reset through the university portal instead.", { cham: false }) : ""}
    <hr class="rule">
    <p class="auth__fine">No role to pick: hmm. opens the student, professor or admin view based on your university account.</p>
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
  </section>`;

  return {
    html,
    pet: false,
    mount(el) {
      const $ = (q) => el.querySelector(q);
      bindLangPicker(el);
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
        if (!ask("Start the demo over? Mouna goes back to the Learning Snapshot, rules go back to default, sample data is refreshed. Real students are not affected.")) return;
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
      $("#sso")?.addEventListener("click", () => msg("University SSO is planned for a later release (it needs AUI’s identity provider). Use your university email for now."));
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
