/* S03 · Student Home (MP4 wireframe S03, Flow 1 end / Flows 2–4 start).
   Greeting + avatar → Profile · current adaptation strip ("why this is happening") · Due soon (suggested
   character per task) · Start a session (3 character cards) · tab bar Home · Reflect · Profile. */
import * as db from "../db.js";
import { store } from "../store.js";
import { locale } from "../i18n/index.js";
import { CH, langShort } from "../engine/engine.js";
import { tabbar } from "./courses.js";
import { suggestFor, pickCharacter, freeStart } from "../ui/start.js";
import { engineBox } from "../ui/engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dueShort = (d) => { if (!d) return ""; const t = new Date(d + "T12:00"); return isNaN(t) ? d : t.toLocaleDateString(locale(), { weekday: "short" }); };
const LINES = { socrates: "Guides you with questions, never the answer", talmid: "A confused student you teach", rival: "Argues against you until your case is solid" };

export function render() {
  const P = store.profile;
  const courses = store.courses;
  const enrolled = new Set(courses.map((c) => c.code));
  const tasks = store.tasks.filter((t) => !db.isConfigured() || enrolled.has(t.course)).slice(0, 6);
  const noticed = P.noticed && P.noticed.confirmed == null ? P.noticed.text : "";
  const strip = `${P.hintPace} · ${P.challenge} · ${(P.langs || ["English"]).join(" + ")}`;

  const html = `
  <header class="apphead">
    <span></span>
    <h1 class="apphead__title"><span>Hi,</span> <span data-no-i18n>${esc(P.name || "there")}</span></h1>
    <a class="avatar" href="#/me" aria-label="Your Thinking Profile">${esc((P.name || "?")[0])}</a>
  </header>

  <section class="feed">
    ${engineBox(`<span>Today you are on:</span> <b data-no-i18n>${esc(strip)}</b> <a href="#/me">Change</a>${P.lastChange ? `<br><span>${esc(P.lastChange)}</span>` : ""}`)}
    <div id="invites"></div>
    ${noticed ? engineBox(`<span>hmm. noticed:</span> ${esc(noticed)} <span>Is this right?</span> <button class="link-inline" data-noticed="yes">Yes</button> · <button class="link-inline" data-noticed="no">No</button>`, { id: "noticed" }) : ""}

    <h2 class="label-caps">Due soon</h2>
    ${tasks.length ? `<ul class="cards">${tasks.map((t) => { const s = suggestFor(t); return `
      <li><button class="card-row" data-task="${esc(t.id)}">
        <span class="initial initial--${s.k}" aria-hidden="true">${CH[s.k].initial}</span>
        <span class="card-row__text"><b data-no-i18n>${esc(t.topic)}</b><span><span data-no-i18n>${esc(t.course)}</span> · <span>suggested for you:</span> ${CH[s.k].name}</span></span>
        <span class="card-row__end">${esc(dueShort(t.due))}</span></button></li>`; }).join("")}</ul>`
      : `<div class="empty-card"><svg viewBox="0 0 160 70" width="150" aria-hidden="true"><path d="M20 50h120M35 50v16M125 50v16M58 50V36h44v14M80 36v14" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="128" cy="24" r="4" fill="currentColor"/><circle cx="141" cy="12" r="6" fill="currentColor"/></svg>
          <p><b>No tasks yet</b></p><p class="dek">${courses.length ? "When a professor assigns something, it shows up here." : "Join your course with the code from your professor, and its tasks show up here."}</p>
          ${courses.length ? `<button class="btn btn--ink" data-free="socrates">Start a free session</button>` : `<a class="btn btn--ink" href="#/courses">Join a course</a>`}
          ${engineBox("hmm. suggests a character from your Learning Snapshot.")}</div>`}

    <h2 class="label-caps">Start a session</h2>
    <ul class="cards">
      ${Object.entries(CH).map(([key, c]) => `<li><button class="card-row" data-free="${key}">
        <span class="initial initial--${key}" aria-hidden="true">${c.initial}</span>
        <span class="card-row__text"><b>${c.name}</b><span>${LINES[key]}</span></span><span class="card-row__end" aria-hidden="true">›</span></button></li>`).join("")}
    </ul>
    <p class="note__meta"><a href="#/courses">My courses</a> · join with a code from your professor</p>
  </section>
  ${tabbar("home")}`;

  return {
    html,
    mount(el) {
      el.querySelectorAll("[data-task]").forEach((b) => b.onclick = () => pickCharacter(store.tasks.find((t) => String(t.id) === b.dataset.task)));
      el.querySelectorAll("[data-free]").forEach((b) => b.onclick = () => freeStart(b.dataset.free));
      el.querySelectorAll("[data-noticed]").forEach((b) => b.onclick = async () => {
        const yes = b.dataset.noticed === "yes";
        await store.saveProfile({ ...store.profile, noticed: { text: noticed, confirmed: yes } });
        el.querySelector("#noticed .engine__body").innerHTML = yes ? "Noted. I’ll keep doing that." : "Thanks, I’ll stop assuming that.";
      });
      if (!db.isConfigured()) return;
      // Help-session invites (only if YOUR private history says the course felt hard) and class reminders.
      const hard = new Set((P.history || []).filter((h) => h.conf != null && h.conf <= 2).map((h) => h.course));
      db.listInvites().then((inv) => {
        const mine = inv.filter((i) => enrolled.has(i.course) && (i.kind === "reminder" || hard.has(i.course)));
        el.querySelector("#invites").innerHTML = mine.slice(0, 2).map((i) => engineBox(i.kind === "reminder" ? esc(i.topic)
          : `Your professor is running an optional help session for ${esc(i.course)}${i.when ? " · " + esc(i.when) : ""}. Only you can see this invite; nobody knows who got it.`)).join("");
        import("../chameleon/chameleon.js").then((m) => m.mountInlineChameleons(el));
      }).catch(() => {});
    },
  };
}
