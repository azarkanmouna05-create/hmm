/* S06 · My Thinking Profile (US5, Flow 5). Identity · skills map (triangle) · how hmm. adapts to you
   (Challenge shown directly; other settings "· Change") · "hmm. noticed" Yes/No · Settings (privacy,
   notifications, app language) · Log out. Matches the MP4 "after" wireframe. */
import { LEVELS, PACES, TONES, clampLevel, langShort } from "../engine/engine.js";
import { store } from "../store.js";
import * as db from "../db.js";
import { setChameleonMood } from "../chameleon/chameleon.js";
import { tabbar } from "./courses.js";
import { icons } from "../ui/icons.js";
import { triangle } from "../ui/charts.js";
import { engineBox } from "../ui/engine.js";
import { openSheet } from "../ui/sheet.js";
import { langPicker, bindLangPicker, t } from "../i18n/index.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const notifOn = () => { try { return localStorage.getItem("hmm.notif") === "on" && "Notification" in window && Notification.permission === "granted"; } catch { return false; } };

export function render() {
  const P = store.profile, pol = store.policy;
  const levels = LEVELS.filter((l) => clampLevel(l, pol) === l);
  const noticed = P.noticed && P.noticed.confirmed !== false ? P.noticed : null;
  const row = (label, value, id) => `<div class="setrow"><span>${label}</span><button type="button" class="setrow__btn" id="${id}"><span data-no-i18n>${esc(value)}</span> · <span>Change</span></button></div>`;

  const html = `
  <header class="apphead"><a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a><h1 class="apphead__title">My Thinking Profile</h1><span></span></header>
  <section class="feed">
    <div class="ident"><span class="avatar avatar--lg" aria-hidden="true">${esc((P.name || "?")[0])}</span>
      <div><b data-no-i18n>${esc(P.name || "You")}</b><span data-no-i18n>${esc(P.program || "")}</span><span>${P.sessions || 0} sessions</span></div></div>

    <h2 class="label-caps">Skills map</h2>
    <div class="boxed">${triangle(P.skills || {})}</div>

    <h2 class="label-caps">How hmm. adapts to you</h2>
    ${P.lastChange ? engineBox(esc(P.lastChange)) : ""}
    <p class="label-caps label-caps--sub">Challenge</p>
    <div class="seg-pick" data-set="challenge">${levels.map((l) => `<button type="button" class="seg-pick__btn ${P.challenge === l ? "is-on" : ""}" data-v="${l}" aria-pressed="${P.challenge === l}">${P.challenge === l ? "✓ " : ""}${l}</button>`).join("")}</div>
    ${row("Hint pace", P.hintPace, "ch-pace")}
    ${row("Tone", P.tone, "ch-tone")}
    ${row("Language", (P.langs || ["English"]).map(langShort).join(" + "), "ch-lang")}

    ${noticed ? engineBox(`<span>hmm. noticed:</span> ${esc(noticed.text)} ${noticed.confirmed ? "<span>(you confirmed this)</span>" : `<span>Is this right?</span> <button class="link-inline" id="ny">Yes</button> · <button class="link-inline" id="nn">No</button>`}`)
      : engineBox("After a few sessions, hmm. tells you what it noticed about how you learn, and you decide if it’s right.")}

    <h2 class="label-caps">Settings</h2>
    ${row("Privacy", "Professors see trends only", "ch-priv")}
    ${row("Notifications", notifOn() ? "On" : "Off", "ch-notif")}
    <div class="setrow"><span>App language</span>${langPicker()}</div>
    <a class="link-inline" href="#/snapshot/1">Retake Learning Snapshot</a>
    <button type="button" class="link-inline" id="out" style="align-self:flex-start">Log out</button>
    <p class="auth__msg is-ok" id="msg" role="status"></p>
  </section>
  ${tabbar("me")}`;

  return {
    html,
    mount(el) {
      bindLangPicker(el);
      const msg = (x) => { el.querySelector("#msg").textContent = t(x); };
      const save = async (patch, text) => { await store.saveProfile({ ...store.profile, ...patch, lastChange: "" }); msg(text); };
      el.querySelectorAll('[data-set="challenge"] [data-v]').forEach((b) => b.onclick = async () => {
        setChameleonMood(b.dataset.v.toLowerCase());
        await save({ challenge: b.dataset.v }, "Saved. hmm. adapts from your next reply.");
        location.reload();
      });
      const choose = (title, key, values) => {
        const sh = openSheet(title, `<div class="seg-pick seg-pick--col">${values.map((v) => `<button type="button" class="seg-pick__btn ${store.profile[key] === v ? "is-on" : ""}" data-v="${esc(v)}">${store.profile[key] === v ? "✓ " : ""}${esc(v)}</button>`).join("")}</div>`);
        sh.el.querySelectorAll("[data-v]").forEach((b) => b.onclick = async () => { await save({ [key]: b.dataset.v }, "Saved. hmm. adapts from your next reply."); sh.close(); location.reload(); });
      };
      el.querySelector("#ch-pace").onclick = () => choose(t("Hint pace"), "hintPace", PACES);
      el.querySelector("#ch-tone").onclick = () => choose(t("Tone"), "tone", TONES);
      el.querySelector("#ch-lang").onclick = () => {
        const cur = store.profile.langs || ["English"];
        const sh = openSheet(t("Language"), `<p class="note__meta">The languages hmm.’s characters speak with you (pick any).</p>
          <div class="seg-pick">${pol.langs.map((l) => `<button type="button" class="seg-pick__btn ${cur.includes(l) ? "is-on" : ""}" data-l="${esc(l)}">${cur.includes(l) ? "✓ " : ""}${esc(l)}</button>`).join("")}</div>
          <button class="btn btn--ink auth__submit" id="lsave">Save</button>`);
        sh.el.querySelectorAll("[data-l]").forEach((b) => b.onclick = () => { b.classList.toggle("is-on"); b.textContent = (b.classList.contains("is-on") ? "✓ " : "") + b.dataset.l; });
        sh.el.querySelector("#lsave").onclick = async () => {
          const langs = [...sh.el.querySelectorAll("[data-l].is-on")].map((x) => x.dataset.l);
          if (!langs.length) return;
          await save({ langs }, "Languages saved."); sh.close(); location.reload();
        };
      };
      el.querySelector("#ch-priv").onclick = () => openSheet(t("Privacy"), `<p class="dek">${t("Your chats and reflections are private to you.")}</p>
        <p class="note__meta">Professors see class patterns only, for groups of ${pol.minGroup}+ students, never names or chat text. Data is kept for ${esc(pol.retention)}. This is a university rule, so it can’t be loosened here.</p>`);
      el.querySelector("#ch-notif").onclick = async () => {
        if (!("Notification" in window)) return msg("Notifications aren’t supported in this browser.");
        if (notifOn()) { try { localStorage.setItem("hmm.notif", "off"); } catch {} return location.reload(); }
        const perm = await Notification.requestPermission();
        if (perm === "granted") { try { localStorage.setItem("hmm.notif", "on"); } catch {} new Notification("hmm.", { body: t("Notifications are on. hmm. will remind you about tasks due soon."), icon: "/icons/icon-192.png" }); location.reload(); }
        else msg("Notifications are blocked in your browser settings.");
      };
      el.querySelector("#ny")?.addEventListener("click", async () => { await save({ noticed: { ...store.profile.noticed, confirmed: true } }, "Thanks. hmm. will use this."); location.reload(); });
      el.querySelector("#nn")?.addEventListener("click", async () => { await save({ noticed: { ...store.profile.noticed, confirmed: false } }, "Got it. hmm. won’t use that."); location.reload(); });
      el.querySelector("#out").onclick = async () => { await db.signOut(); location.hash = "#/login"; };
    },
  };
}
