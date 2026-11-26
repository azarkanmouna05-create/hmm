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
  // Our hmm. logo (from the "hmm. opening animation" made with Claude): pixel thought cloud, pixel letters,
  // and the dot with the chameleon inside it.
  const bubble = `<div class="auth__mark"><svg class="brandlogo" viewBox="0 0 780 600" role="img" aria-label="hmm.">
        <defs>
    <linearGradient id="hmmLogoG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3FCB6A"/><stop offset="0.55" stop-color="#9BDB3C"/><stop offset="1" stop-color="#F2A93B"/>
    </linearGradient>
    <linearGradient id="hmmLogoT" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F2A93B"/><stop offset="1" stop-color="#E8663D"/>
    </linearGradient>
  </defs>
        <g fill="var(--ink)" shape-rendering="crispEdges"><rect x="20" y="550" width="10" height="10"/><rect x="10" y="560" width="10" height="10"/><rect x="30" y="560" width="10" height="10"/><rect x="0" y="570" width="10" height="10"/><rect x="40" y="570" width="10" height="10"/><rect x="10" y="580" width="10" height="10"/><rect x="30" y="580" width="10" height="10"/><rect x="20" y="590" width="10" height="10"/></g>
        <g fill="var(--ink)" shape-rendering="crispEdges"><rect x="70" y="470" width="10" height="10"/><rect x="50" y="480" width="20" height="10"/><rect x="90" y="480" width="10" height="10"/><rect x="50" y="490" width="10" height="10"/><rect x="70" y="490" width="20" height="10"/><rect x="100" y="490" width="20" height="10"/><rect x="40" y="500" width="10" height="10"/><rect x="70" y="500" width="10" height="10"/><rect x="110" y="500" width="10" height="10"/><rect x="60" y="510" width="10" height="10"/><rect x="120" y="510" width="10" height="10"/><rect x="70" y="520" width="10" height="10"/><rect x="110" y="520" width="10" height="10"/><rect x="70" y="530" width="20" height="10"/><rect x="100" y="530" width="20" height="10"/><rect x="90" y="540" width="10" height="10"/></g>
        <g fill="var(--ink)" shape-rendering="crispEdges"><rect x="150" y="380" width="20" height="10"/><rect x="140" y="390" width="10" height="10"/><rect x="170" y="390" width="30" height="10"/><rect x="130" y="400" width="10" height="10"/><rect x="160" y="400" width="10" height="10"/><rect x="200" y="400" width="10" height="10"/><rect x="120" y="410" width="10" height="10"/><rect x="150" y="410" width="10" height="10"/><rect x="210" y="410" width="10" height="10"/><rect x="120" y="420" width="10" height="10"/><rect x="140" y="420" width="10" height="10"/><rect x="220" y="420" width="10" height="10"/><rect x="120" y="430" width="10" height="10"/><rect x="140" y="430" width="10" height="10"/><rect x="220" y="430" width="10" height="10"/><rect x="140" y="440" width="10" height="10"/><rect x="220" y="440" width="10" height="10"/><rect x="150" y="450" width="10" height="10"/><rect x="210" y="450" width="10" height="10"/><rect x="160" y="460" width="10" height="10"/><rect x="200" y="460" width="10" height="10"/><rect x="170" y="470" width="30" height="10"/></g>
        <g fill="var(--ink)" shape-rendering="crispEdges"><rect x="390" y="0" width="20" height="10"/><rect x="370" y="10" width="20" height="10"/><rect x="410" y="10" width="50" height="10"/><rect x="360" y="20" width="10" height="10"/><rect x="390" y="20" width="20" height="10"/><rect x="460" y="20" width="20" height="10"/><rect x="540" y="20" width="20" height="10"/><rect x="350" y="30" width="10" height="10"/><rect x="380" y="30" width="10" height="10"/><rect x="480" y="30" width="10" height="10"/><rect x="520" y="30" width="20" height="10"/><rect x="560" y="30" width="70" height="10"/><rect x="250" y="40" width="20" height="10"/><rect x="340" y="40" width="10" height="10"/><rect x="370" y="40" width="10" height="10"/><rect x="490" y="40" width="10" height="10"/><rect x="510" y="40" width="10" height="10"/><rect x="540" y="40" width="20" height="10"/><rect x="630" y="40" width="20" height="10"/><rect x="230" y="50" width="20" height="10"/><rect x="270" y="50" width="40" height="10"/><rect x="360" y="50" width="10" height="10"/><rect x="500" y="50" width="10" height="10"/><rect x="530" y="50" width="10" height="10"/><rect x="650" y="50" width="10" height="10"/><rect x="210" y="60" width="20" height="10"/><rect x="250" y="60" width="20" height="10"/><rect x="310" y="60" width="30" height="10"/><rect x="350" y="60" width="10" height="10"/><rect x="500" y="60" width="10" height="10"/><rect x="520" y="60" width="10" height="10"/><rect x="660" y="60" width="10" height="10"/><rect x="200" y="70" width="10" height="10"/><rect x="230" y="70" width="20" height="10"/><rect x="340" y="70" width="10" height="10"/><rect x="510" y="70" width="10" height="10"/><rect x="660" y="70" width="10" height="10"/><rect x="200" y="80" width="10" height="10"/><rect x="220" y="80" width="10" height="10"/><rect x="670" y="80" width="10" height="10"/><rect x="190" y="90" width="10" height="10"/><rect x="220" y="90" width="10" height="10"/><rect x="670" y="90" width="10" height="10"/><rect x="190" y="100" width="10" height="10"/><rect x="210" y="100" width="10" height="10"/><rect x="680" y="100" width="50" height="10"/><rect x="190" y="110" width="10" height="10"/><rect x="210" y="110" width="10" height="10"/><rect x="730" y="110" width="20" height="10"/><rect x="190" y="120" width="10" height="10"/><rect x="210" y="120" width="10" height="10"/><rect x="750" y="120" width="10" height="10"/><rect x="190" y="130" width="10" height="10"/><rect x="210" y="130" width="10" height="10"/><rect x="750" y="130" width="10" height="10"/><rect x="170" y="140" width="20" height="10"/><rect x="210" y="140" width="10" height="10"/><rect x="760" y="140" width="10" height="10"/><rect x="160" y="150" width="10" height="10"/><rect x="190" y="150" width="20" height="10"/><rect x="760" y="150" width="10" height="10"/><rect x="150" y="160" width="10" height="10"/><rect x="180" y="160" width="10" height="10"/><rect x="770" y="160" width="10" height="10"/><rect x="150" y="170" width="10" height="10"/><rect x="170" y="170" width="10" height="10"/><rect x="770" y="170" width="10" height="10"/><rect x="140" y="180" width="10" height="10"/><rect x="170" y="180" width="10" height="10"/><rect x="760" y="180" width="10" height="10"/><rect x="140" y="190" width="10" height="10"/><rect x="160" y="190" width="10" height="10"/><rect x="760" y="190" width="10" height="10"/><rect x="140" y="200" width="10" height="10"/><rect x="160" y="200" width="10" height="10"/><rect x="760" y="200" width="10" height="10"/><rect x="140" y="210" width="10" height="10"/><rect x="160" y="210" width="10" height="10"/><rect x="750" y="210" width="10" height="10"/><rect x="140" y="220" width="10" height="10"/><rect x="160" y="220" width="10" height="10"/><rect x="760" y="220" width="10" height="10"/><rect x="160" y="230" width="10" height="10"/><rect x="760" y="230" width="10" height="10"/><rect x="170" y="240" width="10" height="10"/><rect x="760" y="240" width="10" height="10"/><rect x="170" y="250" width="10" height="10"/><rect x="770" y="250" width="10" height="10"/><rect x="180" y="260" width="10" height="10"/><rect x="760" y="260" width="10" height="10"/><rect x="190" y="270" width="20" height="10"/><rect x="760" y="270" width="10" height="10"/><rect x="210" y="280" width="10" height="10"/><rect x="760" y="280" width="10" height="10"/><rect x="210" y="290" width="10" height="10"/><rect x="750" y="290" width="10" height="10"/><rect x="210" y="300" width="10" height="10"/><rect x="750" y="300" width="10" height="10"/><rect x="210" y="310" width="10" height="10"/><rect x="730" y="310" width="20" height="10"/><rect x="210" y="320" width="10" height="10"/><rect x="680" y="320" width="50" height="10"/><rect x="220" y="330" width="10" height="10"/><rect x="670" y="330" width="10" height="10"/><rect x="220" y="340" width="10" height="10"/><rect x="670" y="340" width="10" height="10"/><rect x="230" y="350" width="20" height="10"/><rect x="330" y="350" width="20" height="10"/><rect x="510" y="350" width="10" height="10"/><rect x="660" y="350" width="10" height="10"/><rect x="250" y="360" width="20" height="10"/><rect x="310" y="360" width="20" height="10"/><rect x="350" y="360" width="10" height="10"/><rect x="500" y="360" width="10" height="10"/><rect x="520" y="360" width="10" height="10"/><rect x="660" y="360" width="10" height="10"/><rect x="270" y="370" width="40" height="10"/><rect x="360" y="370" width="10" height="10"/><rect x="500" y="370" width="10" height="10"/><rect x="530" y="370" width="10" height="10"/><rect x="650" y="370" width="10" height="10"/><rect x="370" y="380" width="10" height="10"/><rect x="490" y="380" width="10" height="10"/><rect x="540" y="380" width="20" height="10"/><rect x="630" y="380" width="20" height="10"/><rect x="370" y="390" width="20" height="10"/><rect x="480" y="390" width="10" height="10"/><rect x="560" y="390" width="70" height="10"/><rect x="390" y="400" width="20" height="10"/><rect x="460" y="400" width="20" height="10"/><rect x="410" y="410" width="50" height="10"/></g>
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAAB6CAYAAAACliVSAAABIUlEQVR4Xu3b0QqCMABA0RX9/y8XPZfhBVcNz32UEBlnU8YaQ5Ikac0uY4z7hEd/3nfprks//cQMzEYGxsC0iCGmRQwxLWKIaRFDTIsYYlrEENMihpgWMcS0iCGmRQwxLWKIaRFDTOvWfn5oMw4T7GnXgQNTyVRqEUNMixhiWsQQ0zqjmHcfli/XZh1nXb4zitmVgbH4toghpkUMMS1iiGn9cs93195r6NA9ZFPJVGoRQ0yLmI1mvZWOfuN8PWKsMS1iiGkRQ0yLGGJaxBDTIoaYFjHEtIghpkUMMS1iiGkRQ0yLGGJaxBDTIoaYFjHEtIghpkUMMS1iiGkRQ0yLGGJaxBDTIoaYFjEfxCz/T5EZEWONaRFDTIsYYlrESJL+pwe3VAbe6AoGZQAAAABJRU5ErkJggg==" x="302" y="145" width="70" height="122"/><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHEAAAB6CAYAAACIubwTAAABPElEQVR4Xu3dUWrDMBQAQTX0/ldOCbSQT7WRkmozcwBbj0VgG2OPAQAAAAAAAAAAAAAAAAAAAPCmPsYY1w2z3457s+PYM37Ov8or5pie4bJqyrBXBPwVEQNEDBAxQMQAEQNEDBAxoBrx39/bTZieYdcTG56ouhPfiogBIgaIGCBigIgBIgaIGCBiwOfmGabfE/mD6cdSD1o9w/J124kBIgaIGCBigIgBu65OV1/RPcuR67YTA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA0QMEDFAxAARA06NuPzfEic7NSJ3RAw4NeKRH1z/dvLaAQD2+gI2Vgqi23XN5QAAAABJRU5ErkJggg==" x="376" y="145" width="113" height="122"/><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG8AAAB6CAYAAACx3g1IAAABQUlEQVR4Xu3cUWqEMBRAUad0/1ue4m9RkCEv9JZzFjBJvDqYfHgcAAAAAAAAAAAAAAAAAAAAwL/zOo7jvXhV529eWT3OlbuxP7Vjzr89XsPXp6tizOMbRrww8cLECxMvTLww8cLEC/semPvjfcqAc+zHm9y6iRMWNvG3GSZemHhh4oWJFyZemHhh4oWJFzZxPHZn5bHVriO4lXM+LZ23Jy9MvDDxwsQLE+/e6peV5abeNv/8wi/k5jzx5OUuQtVEvKV7Ge5NxGMT8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvTLww8cLECxMvbCKeL91uMhGPTcQDAGDODwNgCqbdrrT+AAAAAElFTkSuQmCC" x="493" y="145" width="111" height="122"/>
        <g transform="translate(608 232) scale(30) scale(0.005)">
          <g class="brandlogo__dot"><circle cx="100" cy="100" r="98" fill="#111"/>
  <path d="M14 156 Q100 148 188 160" stroke="#9A6A3A" stroke-width="10" fill="none" stroke-linecap="round"/><g>
  <path d="M150 104 C176 106 184 132 172 148 C160 164 132 158 134 138 C136 122 158 124 158 138 C158 146 148 147 147 141"
        stroke="url(#hmmLogoT)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M128 112 L140 128 L132 150" stroke="#7FCB3E" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M126 152 L132 148 L139 153" stroke="#7FCB3E" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M76 114 L62 130 L70 150" stroke="#3FCB6A" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M63 153 L70 148 L77 152" stroke="#3FCB6A" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 108 L40 92 Q52 64 76 34 Q86 56 92 70 Q100 56 118 54 Q146 56 158 84 Q162 100 150 110 Q124 124 90 120 Q62 120 44 116 Z"
        fill="url(#hmmLogoG)" stroke="#155C33" stroke-width="4" stroke-linejoin="round"/>
  <path d="M76 38 Q74 62 64 80" stroke="#155C33" stroke-width="2.5" fill="none" opacity="0.7"/>
  <path d="M104 62 Q98 88 104 116" stroke="#E9FBA0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <path d="M126 58 Q120 86 126 114" stroke="#FFF3A0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <path d="M146 72 Q141 90 145 108" stroke="#FFE08A" stroke-width="4.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <path d="M48 112 Q96 112 148 100" stroke="#FFFFFF" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.8"/>
  <path d="M20 108 Q32 106 42 102" stroke="#155C33" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="54" cy="88" r="14" fill="#55D372" stroke="#155C33" stroke-width="3.5"/>
  <circle cx="51" cy="88" r="9" fill="none" stroke="#155C33" stroke-width="1.8" opacity="0.6"/>
  <circle cx="47" cy="88" r="4.5" fill="#111"/>
  <circle cx="46" cy="86.5" r="1.5" fill="#fff"/>
</g></g>
        </g>
      </svg>
    <p class="auth__tag">from hmm. to aha</p></div>`;

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
