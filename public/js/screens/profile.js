/* S06 · Thinking Profile (US5). See and correct how hmm. adapts to you. */
import { LEVELS, PACES, TONES, clampLevel } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { createChameleon, setChameleonMood } from "../chameleon/chameleon.js";
import { tabbar } from "./courses.js";
import { langPicker, bindLangPicker } from "../i18n/index.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function render() {
  const P = store.profile, pol = store.policy, sk = P.skills || {};
  const max = Math.max(10, ...Object.values(sk).map(Number).filter(Number.isFinite));
  const seg = (key, values, label) => `<p class="field-label">${label}</p>
    <div class="picks picks--row" data-set="${key}">${values.map((v) => `<button type="button" class="pick ${P[key] === v ? "is-on" : ""}" data-v="${esc(v)}" aria-pressed="${P[key] === v}"><span>${esc(v.replace(" steps", "").replace("Straight to the point", "Direct"))}</span></button>`).join("")}</div>`;
  const noticed = P.noticed && P.noticed.confirmed !== false ? P.noticed : null;

  const html = `
  <header class="topbar"><a class="logo" href="#/">hmm<span class="logo__dot"></span></a><span class="topbar__spacer"></span>
    <button class="btn btn--sm btn--ghost" id="out">Sign out</button></header>
  <section class="feed">
    <div class="profile-head">
      <div><p class="kicker">Thinking Profile</p>
        <h1 class="headline">${esc(P.name || "You")}</h1>
        <p class="dek">${esc(P.program || "")}${P.program ? " · " : ""}${P.sessions || 0} session${P.sessions === 1 ? "" : "s"}</p></div>
      <span id="bigcham" class="profile-head__cham"></span>
    </div>
    ${P.lastChange ? `<aside class="why"><span class="why__cham" data-chameleon="30"></span><p>${esc(P.lastChange)}</p></aside>` : ""}

    <hr class="rule">
    <h2 class="section-title">Skills map</h2>
    ${[["Problem-solving", "solve", "socrates"], ["Explaining", "explain", "talmid"], ["Arguing", "argue", "rival"]].map(([l, k, c]) => `
      <div class="bar"><span>${l}</span><span class="bar__track"><span class="bar__fill bar__fill--${c}" style="width:${Math.round(100 * (sk[k] || 0) / max)}%"></span></span><b>${sk[k] || 0}</b></div>`).join("")}

    <hr class="rule">
    <h2 class="section-title">How hmm. adapts to you</h2>
    ${seg("challenge", LEVELS.filter((l) => clampLevel(l, pol) === l), "Challenge (the chameleon’s colour follows this)")}
    ${seg("hintPace", PACES, "Step size")}
    ${seg("tone", TONES, "Tone")}
    <p class="field-label">Languages</p>
    <div class="picks picks--row" id="langs">${pol.langs.map((l) => `<button type="button" class="pick ${P.langs?.includes(l) ? "is-on" : ""}" data-l="${esc(l)}"><span>${esc(l)}</span></button>`).join("")}</div>

    <hr class="rule">
    <aside class="note">
      <span class="note__cham" data-chameleon="40"></span>
      <div class="note__body">
        <div class="note__meta"><b>hmm.</b>noticed</div>
        <p class="note__text">${noticed ? esc(noticed.text) + (noticed.confirmed ? " (you confirmed this)" : " Is this right?") : "After a few sessions, hmm. tells you what it noticed about how you learn, and you decide if it’s right."}</p>
        ${noticed && noticed.confirmed == null ? `<div class="note__actions"><button class="btn btn--sm btn--yes" id="ny">Yes</button><button class="btn btn--sm btn--no" id="nn">No</button></div>` : ""}
      </div>
    </aside>

    <hr class="rule">
    <h2 class="section-title">App language</h2>
    <p class="dek" style="font-size:15px">The language of the whole app. (The languages above are what hmm.’s characters speak with you.)</p>
    ${langPicker()}
    <hr class="rule">
    <h2 class="section-title">Privacy</h2>
    <p class="dek" style="font-size:15px">Your chats and reflections are private to you. Professors see class patterns only, for groups of ${pol.minGroup}+ students, never names or chat text. Data is kept for ${esc(pol.retention)}.</p>
    <a class="btn btn--ghost" href="#/snapshot/1" style="align-self:flex-start">Retake Learning Snapshot</a>
    <p class="auth__msg is-ok" id="msg" role="status"></p>
  </section>
  ${tabbar("me")}`;

  return {
    html,
    mount(el) {
      bindLangPicker(el);
      const big = createChameleon({ size: 96, label: "Your chameleon" }); el.querySelector("#bigcham").append(big.el);
      const msg = (t) => { el.querySelector("#msg").textContent = t; };
      const save = async (patch, text) => { await store.saveProfile({ ...store.profile, ...patch, lastChange: "" }); msg(text); };
      el.querySelectorAll("[data-set]").forEach((g) => g.querySelectorAll("[data-v]").forEach((b) => b.onclick = async () => {
        g.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b));
        if (g.dataset.set === "challenge") setChameleonMood(b.dataset.v.toLowerCase());
        await save({ [g.dataset.set]: b.dataset.v }, "Saved. hmm. adapts from your next reply.");
      }));
      el.querySelectorAll("[data-l]").forEach((b) => b.onclick = async () => {
        b.classList.toggle("is-on");
        const langs = [...el.querySelectorAll("[data-l].is-on")].map((x) => x.dataset.l);
        if (!langs.length) { b.classList.add("is-on"); return; }
        await save({ langs }, "Languages saved.");
      });
      el.querySelector("#ny")?.addEventListener("click", async () => { await save({ noticed: { ...store.profile.noticed, confirmed: true } }, "Thanks. hmm. will use this."); location.reload(); });
      el.querySelector("#nn")?.addEventListener("click", async () => { await save({ noticed: { ...store.profile.noticed, confirmed: false } }, "Got it. hmm. won’t use that."); location.reload(); });
      el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; };
    },
  };
}
