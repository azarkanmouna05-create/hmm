/* S05 · Reflection (US5) and the Reflect tab.
   #/reflect/now → reflect on the session you just ended (where stuck, what unlocked it, confidence 1–5)
   #/reflect     → your past reflections (only you can see these) */
import { CH } from "../engine/engine.js";
import { store } from "../store.js";
import { locale } from "../i18n/index.js";
import { tabbar } from "./courses.js";
import { icons } from "../ui/icons.js";
import { engineBox } from "../ui/engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render({ path }) {
  return path.startsWith("/reflect/now") && store.session ? reflectNow() : history();
}

function reflectNow() {
  const s = store.session, c = CH[s.char];
  const mins = Math.max(1, Math.round((Date.now() - s.start) / 60000));
  const third = s.char === "socrates" ? [`${s.hints} of ${s.maxHints}`, "hints used"]
    : s.char === "talmid" ? [`${s.meter} of 5`, "Talmid understood"] : [`${s.meter} of 5`, "argument strength"];
  const html = `
  <header class="apphead"><a class="icon-btn" href="#/session/${s.char}" aria-label="Back">${icons.back}</a><h1 class="apphead__title">Reflect</h1><span></span></header>
  <section class="feed">
    <div class="summary">
      <div><b>${esc(c.name)}</b><span>character</span></div>
      <div><b>${mins} min</b><span>session</span></div>
      <div><b>${third[0]}</b><span>${third[1]}</span></div>
    </div>
    <label class="field">Where did you get stuck?<textarea id="stuck" rows="3" placeholder="e.g. finding the two pieces"></textarea></label>
    <label class="field">What unlocked it?<textarea id="unlocked" rows="3" placeholder="e.g. the second hint"></textarea></label>
    <p class="label-caps">How confident do you feel now?</p>
    <div class="conf" role="radiogroup" aria-label="Confidence 1 to 5">
      ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="conf__btn" role="radio" aria-checked="false" data-conf="${i}">${i}</button>`).join("")}
    </div>
    ${engineBox("Your answers tune the next session, e.g. fewer hints when confidence is high.")}
    <p class="note__meta">Your Thinking Profile = your progress plus how hmm. adapts to you. Only you can see your reflections.</p>
    <div class="snap__actions">
      <button class="btn btn--ink auth__submit" id="save" disabled>Save to my Thinking Profile</button>
      <button class="btn btn--ghost auth__submit" id="skip" style="border:0;text-decoration:underline">Skip</button>
      <p class="auth__msg is-ok" id="msg" role="status"></p>
    </div>
  </section>
  ${tabbar("reflect")}`;
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
        sessionStorage.setItem("hmm.afterReflect", String(Date.now()));
        location.hash = "#/me";
      };
      el.querySelector("#save").onclick = () => done(false);
      el.querySelector("#skip").onclick = () => done(true);
    },
  };
}

function history() {
  const H = (store.profile.history || []).slice().reverse();
  const html = `
  <header class="apphead"><a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a><h1 class="apphead__title">Reflect</h1><span></span></header>
  <section class="feed">
    <h2 class="label-caps">Your reflections</h2>
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
