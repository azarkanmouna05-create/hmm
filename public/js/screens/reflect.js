/* S05 · Reflection (US5) and the Reflect tab.
   #/reflect/now → reflect on the session you just ended (where stuck, what unlocked it, confidence 1–5)
   #/reflect     → your past reflections (only you can see these) */
import { CH } from "../engine/engine.js";
import { store } from "../store.js";
import { locale } from "../i18n/index.js";
import { tabbar } from "./courses.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render({ path }) {
  return path.startsWith("/reflect/now") && store.session ? reflectNow() : history();
}

function reflectNow() {
  const s = store.session, c = CH[s.char];
  const mins = Math.max(1, Math.round((Date.now() - s.start) / 60000));
  const stat = s.char === "socrates" ? `${s.hints} of ${s.maxHints} hints used`
    : s.char === "talmid" ? `Talmid understood ${s.meter} of 5` : `argument strength ${s.meter} of 5`;
  const html = `
  <header class="topbar"><span class="logo">hmm<span class="logo__dot"></span></span></header>
  <section class="feed">
    <p class="kicker">Reflect · ${esc(c.name)} · ${mins} min · ${esc(stat)}</p>
    <h1 class="headline">${esc(s.task.topic)}</h1>
    <label class="field">Where did you get stuck?<textarea id="stuck" rows="2"></textarea></label>
    <label class="field">What unlocked it?<textarea id="unlocked" rows="2"></textarea></label>
    <p class="field-label">How confident do you feel now?</p>
    <div class="picks picks--row conf" role="radiogroup" aria-label="Confidence 1 to 5">
      ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="pick" role="radio" aria-checked="false" data-conf="${i}"><span>${i}</span></button>`).join("")}
    </div>
    <aside class="why"><span class="why__cham" data-chameleon="30"></span>
      <p>Your answers tune the next session: bigger steps when you feel confident, smaller when it was hard. Only you can see your reflections.</p></aside>
    <div class="snap__actions">
      <button class="btn btn--ink auth__submit" id="save" disabled>Save to my Thinking Profile</button>
      <button class="btn btn--ghost auth__submit" id="skip" style="border:0">Skip</button>
      <p class="auth__msg" id="msg" role="status"></p>
    </div>
  </section>`;
  return {
    html,
    mount(el) {
      let conf = 0;
      el.querySelectorAll("[data-conf]").forEach((b) => b.onclick = () => {
        conf = +b.dataset.conf;
        el.querySelectorAll("[data-conf]").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
        el.querySelector("#save").disabled = false;
      });
      const done = async (skipped) => {
        el.querySelector("#save").disabled = true; el.querySelector("#skip").disabled = true;
        el.querySelector("#msg").textContent = "hmm. is thinking…";
        const change = await store.finishSession({ conf: skipped ? 3 : conf, skipped,
          stuck: el.querySelector("#stuck").value.trim(), unlocked: el.querySelector("#unlocked").value.trim() });
        sessionStorage.setItem("hmm.toast", change || "Saved. Your Thinking Profile is updated.");
        location.hash = "#/";
      };
      el.querySelector("#save").onclick = () => done(false);
      el.querySelector("#skip").onclick = () => done(true);
    },
  };
}

function history() {
  const H = (store.profile.history || []).slice().reverse();
  const html = `
  <header class="topbar"><a class="logo" href="#/">hmm<span class="logo__dot"></span></a></header>
  <section class="feed">
    <p class="kicker">Reflect</p>
    <h1 class="headline">Your reflections</h1>
    <p class="dek">Only you can see these. Professors see class patterns, never your words.</p>
    ${H.length ? `<ul class="reflections">${H.map((h) => `
      <li><p class="note__meta"><b>${esc(CH[h.char]?.name || "")}</b>${esc(h.course || "Free session")} · ${new Date(h.ts).toLocaleDateString(locale(), { day: "numeric", month: "short" })} · confidence ${h.conf ?? "–"}/5</p>
        <p class="reflections__topic">${esc(h.topic)}</p>
        ${h.stuck ? `<p class="reflections__line"><span>Stuck:</span> ${esc(h.stuck)}</p>` : ""}
        ${h.unlocked ? `<p class="reflections__line"><span>Unlocked by:</span> ${esc(h.unlocked)}</p>` : ""}</li>`).join("")}</ul>`
      : `<div class="empty"><p class="dek">Finish a session and your reflections land here.</p></div>`}
  </section>
  ${tabbar("reflect")}`;
  return { html };
}
