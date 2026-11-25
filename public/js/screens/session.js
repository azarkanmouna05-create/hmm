/* S04a · Socrates session (US2) — built from Figma "E2 · Socrates dialogue (editorial)".
   Reads like a dialogue, not chat bubbles. Every AI turn comes with a "why I did that" margin note. */
import { CH, PACES, LEVELS, TONES, langShort } from "../engine/engine.js";
import { store } from "../store.js";
import { icons } from "../ui/icons.js";
import * as db from "../db.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function render({ path }) {
  const char = path.split("/")[2] || "socrates";
  let s = store.session;
  if (!s || s.char !== char) {
    const task = store.taskFor(char) || { id: null, course: "", topic: "Free session", kind: "problem" };
    s = store.startSession(char, task);
  }
  const c = CH[s.char];

  const html = `
  <div class="session" style="--char:${c.color}">
    <header class="session__head">
      <a class="icon-btn" href="${s.task.course ? "#/course/" + encodeURIComponent(s.task.course) : "#/"}" aria-label="Back">${icons.back}</a>
      <span class="initial initial--sm initial--${s.char}" style="width:32px;height:32px;font-size:16px" aria-hidden="true">${c.initial}</span>
      <span class="session__title"><b>${c.name}</b><span>A dialogue on ${esc(s.task.title || s.task.topic)}</span></span>
      <button class="btn btn--sm btn--ghost" id="end">End</button>
    </header>
    <p class="adapted"><span>Adapted for you:</span> <span id="adapt"></span></p>

    <section class="dialogue" id="dialogue" aria-live="polite">
      <h1 class="dialogue__problem">${esc(s.task.topic)}</h1>
      ${s.task.sample ? `<p class="sample-label" style="margin:-6px 0 0">Sample task</p>` : ""}
      <div id="turns"></div>
      <div id="why"></div>
    </section>

    <div class="hints" id="hints" data-perch></div>

    <form class="composer" id="composer">
      <label class="sr-only" for="say">Reply to ${c.name}</label>
      <input id="say" autocomplete="off" placeholder="${{ socrates: "Reply to Socrates…", talmid: "Explain it to Talmid…", rival: "Make your case…" }[s.char]}" enterkeyhint="send">
      <button class="composer__send" aria-label="Send">${icons.send}</button>
    </form>
  </div>`;

  return {
    html,
    mount(el) {
      const $ = (q) => el.querySelector(q);

      function renderAdapt() {
        const P = store.profile;
        const items = [["pace", s.pace], ["tone", s.tone], ["level", s.level]];
        $("#adapt").innerHTML = items.map(([k, v]) => `<button class="adapted__chip" data-a="${k}" title="Tap to change">${esc(v.toLowerCase())}</button>`).join(" · ")
          + ` · <span style="white-space:nowrap">${P.langs.map(langShort).join(" + ")}</span>`;
        el.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => {
          const k = b.dataset.a, arr = { pace: PACES, level: LEVELS, tone: TONES }[k];
          s[k] = arr[(arr.indexOf(s[k]) + 1) % arr.length];
          s.changes.push(`${k} → ${s[k]}`);
          store.saveSession(s); renderAdapt();
          showWhy(`Switching to "${s[k].toLowerCase()}" from my next reply.`);
        });
      }

      function renderHints() {
        const dots = (n, cls) => `<span class="meter ${cls}" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
        if (s.char === "talmid") {   // US3: how well the confused classmate now understands
          $("#hints").innerHTML = `<span class="hints__label">Talmid understands <b>${s.meter}/5</b></span>${dots(s.meter, "meter--talmid")}`;
          return;
        }
        if (s.char === "rival") {    // US4: your points vs the Rival's counters + argument strength
          $("#hints").innerHTML = `<div class="rival-board">
            <div><span class="hints__label">Your points ${s.points.length}</span><ul>${s.points.slice(-3).map((p) => `<li>${esc(p)}</li>`).join("") || "<li>…</li>"}</ul></div>
            <div><span class="hints__label">Rival counters ${s.counters.length}</span><ul>${s.counters.slice(-3).map((p) => `<li>${esc(p)}</li>`).join("") || "<li>…</li>"}</ul></div>
            <div class="rival-board__strength"><span class="hints__label">Argument strength <b>${s.meter}/5</b></span>${dots(s.meter, "meter--rival")}</div></div>`;
          return;
        }
        const left = s.maxHints - s.hints;
        $("#hints").innerHTML = `
          <span class="hints__label">Hints ${s.hints} of ${s.maxHints}</span>
          <span class="hints__dots" aria-hidden="true">${Array.from({ length: s.maxHints }, (_, i) => `<i class="${i < s.hints ? "on" : ""}"></i>`).join("")}</span>
          <span class="hints__gap"></span>
          <button class="hints__ask" id="hint" ${left <= 0 || s.busy ? "disabled" : ""}>${left > 0 ? "Ask for a hint" : "No hints left, keep going"}</button>`;
        $("#hint").onclick = () => {
          if (s.busy || s.hints >= s.maxHints) return;
          s.hints++; renderHints();
          turn(`[HINT ${s.hints} of ${s.maxHints}]`, false, `asked for hint ${s.hints}`);
        };
      }

      function turnHTML(m) {
        if (m.err) return `<div class="turn turn--sys" role="alert"><p><b>hmm. can't think right now.</b> Your session is saved. Nothing is lost.</p><button class="btn btn--sm btn--ghost" id="retry">Try again</button></div>`;
        if (m.hidden) return "";
        const me = m.role === "user";
        return `<div class="turn ${me ? "turn--me" : "turn--ai"}"><span class="turn__who">${me ? "You" : esc(c.name)}</span><p>${m.pending ? `<span class="thinking">thinking</span>` : esc(m.label || m.content)}</p></div>`;
      }
      function renderTurns() {
        $("#turns").innerHTML = s.msgs.map(turnHTML).join("");
        const d = $("#dialogue"); d.scrollTop = d.scrollHeight;
      }
      function showWhy(text) {
        $("#why").innerHTML = text ? `<aside class="why"><span class="why__cham" data-chameleon="30"></span><p>${esc(text)}</p></aside>` : "";
        import("../chameleon/chameleon.js").then((m) => m.mountInlineChameleons($("#why")));
      }

      async function reveal(node, text) {
        if (reduced) { node.textContent = text; return; }
        const words = text.split(/(\s+)/); node.textContent = "";
        for (const w of words) { node.textContent += w; await new Promise((r) => setTimeout(r, 22)); }
      }

      async function turn(text, hidden = false, label) {
        if (s.busy) return;
        s.busy = true;
        s.msgs = s.msgs.filter((m) => !m.err);
        const changed = s.changes.length ? ` [hmm.: the student just changed settings: ${s.changes.join(", ")}. Adapt from now on.]` : "";
        s.changes = [];
        s.msgs.push({ role: "user", content: text + changed, hidden, label });
        const pending = { role: "assistant", content: "", pending: true };
        s.msgs.push(pending);
        renderTurns(); renderHints();

        const payload = {
          char: s.char, task: s.task, profile: store.profile,
          state: { pace: s.pace, level: s.level, tone: s.tone, hints: s.hints },
          messages: s.msgs.filter((m) => m !== pending && !m.err).map((m) => ({ role: m.role, content: m.content })),
        };
        try {
          const token = await db.accessToken();
          const send = () => fetch("/api/think", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
          let r = await send().catch(() => null);
          // The free AI tier is sometimes briefly overloaded: wait a moment and try once more before showing an error.
          if (!r || r.status >= 500) { await new Promise((res) => setTimeout(res, 4000)); r = await send(); }
          if (r.status === 401) { location.hash = "#/login"; return; }
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || "AI unavailable");
          delete pending.pending; pending.content = data.text;
          const m = data.meta || {};
          if (m.answerRequest) s.answerReq++;
          if (m.meter != null) s.meter = m.meter;
          if (m.point && !s.points.includes(m.point)) s.points.push(m.point);
          if (m.counter && !s.counters.includes(m.counter)) s.counters.push(m.counter);
          if (m.step) s.step = m.step;
          s.note = m.note || "";
          s.busy = false;
          renderTurns();
          const nodes = el.querySelectorAll(".turn--ai p");
          await reveal(nodes[nodes.length - 1], data.text);
          showWhy(s.note);
        } catch (e) {
          // Keep what the student typed on screen; retry re-sends exactly that turn.
          s.msgs = s.msgs.filter((m) => m !== pending);
          const mine = s.msgs.at(-1);
          s.msgs.push({ err: true, retry: { text: mine.content, hidden, label } });
          s.busy = false;
          renderTurns();
          bindRetry();
        }
        store.saveSession(s);
        renderHints();
      }

      $("#composer").onsubmit = (e) => {
        e.preventDefault();
        const v = $("#say").value.trim();
        if (!v || s.busy) return;
        $("#say").value = "";
        turn(v);
      };
      $("#end").onclick = () => {
        const said = s.msgs.some((m) => m.role === "user" && !m.hidden);
        if (!said) { store.clearSession(); location.hash = s.task.course ? "#/course/" + encodeURIComponent(s.task.course) : "#/"; return; }
        location.hash = "#/reflect/now";
      };

      function bindRetry() {
        const b = $("#retry"); if (!b) return;
        b.onclick = () => {
          const { retry } = s.msgs.pop();   // the error notice
          s.msgs.pop();                      // the unanswered turn (turn() adds it back)
          turn(retry.text, retry.hidden, retry.label);
        };
      }

      s.busy = false;
      renderAdapt(); renderHints(); renderTurns(); showWhy(s.note); bindRetry();
      if (!s.msgs.length) turn(`SESSION START. Greet the student in one short line as ${c.name}, then ask your first question.`, true);
    },
  };
}
