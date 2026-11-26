/* S04a · Socrates session (US2) — built from Figma "E2 · Socrates dialogue (editorial)".
   Reads like a dialogue, not chat bubbles. Every AI turn comes with a "why I did that" margin note. */
import { CH, PACES, LEVELS, TONES, langShort } from "../engine/engine.js";
import { store } from "../store.js";
import { icons } from "../ui/icons.js";
import * as db from "../db.js";
import { engineBox } from "../ui/engine.js";
import { t } from "../i18n/index.js";

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

  const needsTopic = !s.task.topic;          // Flow 2/4: "Type the problem" / "State my claim" happens here
  const ask4 = { socrates: ["Type the problem you’re stuck on.", "Type the problem…"], talmid: ["What will you teach Talmid? Name the concept.", "The concept you’ll explain…"], rival: ["State your claim in one sentence.", "Your claim…"] }[s.char];
  const back = s.task.course ? "#/course/" + encodeURIComponent(s.task.course) : "#/";
  const title = { socrates: "Socrates", talmid: "Talmid · your student", rival: "The Rival" }[s.char];
  const bar = {
    socrates: `<span data-no-i18n>${esc(s.task.course || "")}</span>${s.task.course ? " · " : ""}<span data-no-i18n>${esc(s.task.topic)}</span>`,
    talmid: `<span>You teach:</span> <b data-no-i18n>${esc(s.task.topic)}</b>${s.task.course ? ` · <span data-no-i18n>${esc(s.task.course)}</span>` : ""}`,
    rival: `<span>Your claim:</span> <b data-no-i18n>${esc(s.task.topic)}</b>`,
  }[s.char];

  const html = `
  <div class="session" style="--char:${c.color}">
    <header class="apphead">
      <a class="icon-btn" href="${back}" aria-label="Back">${icons.back}</a>
      <h1 class="apphead__title">${title}</h1>
      <button class="btn btn--sm btn--ghost apphead__end" id="end">End</button>
    </header>
    <div class="sessbar">
      <p class="sessbar__topic">${bar}</p>
      ${s.char === "socrates" ? `<p class="sessbar__label">Adapted for you right now (tap to change):</p><div class="chips" id="adapt"></div>` : ""}
      ${s.char === "rival" ? `<div class="rival-board" id="board"></div>` : ""}
    </div>

    <section class="dialogue" id="dialogue" aria-live="polite">
      ${s.task.sample ? `<p class="sample-label" style="margin:0">Sample task</p>` : ""}
      ${needsTopic ? `<div id="ask-topic">${engineBox(`<b>${ask4[0]}</b> ${s.char === "socrates" ? "hmm. reads your Learner Profile to size every step." : s.char === "rival" ? "The Rival argues the other side at your level." : "Talmid’s questions match your level."}`)}</div>` : ""}
      <div id="turns"></div>
      <div id="why"></div>
    </section>

    <div class="ladder" id="hints" data-perch></div>

    <form class="composer" id="composer">
      <button type="button" class="composer__mic" id="mic" aria-label="Speak instead of typing" title="Speak instead of typing">mic</button>
      <label class="sr-only" for="say">Type your thinking…</label>
      <input id="say" autocomplete="off" placeholder="${needsTopic ? ask4[1] : "Type your thinking…"}" enterkeyhint="send">
      <button class="btn btn--ink composer__send-btn">Send</button>
    </form>
  </div>`;

  return {
    html,
    mount(el) {
      const $ = (q) => el.querySelector(q);

      function renderAdapt() {
        if (!$("#adapt")) return;
        const P = store.profile;
        $("#adapt").innerHTML = [["pace", s.pace], ["tone", s.tone], ["level", s.level]]
          .map(([k, v]) => `<button type="button" class="chip-btn" data-a="${k}" title="Tap to change">${esc(v)}</button>`).join("")
          + `<a class="chip-btn" href="#/me" title="Change languages in your profile">${esc(P.langs.map(langShort).join(" + "))}</a>`;
        el.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => {
          const k = b.dataset.a, arr = { pace: PACES, level: LEVELS, tone: TONES }[k];
          s[k] = arr[(arr.indexOf(s[k]) + 1) % arr.length];
          s.changes.push(`${k} → ${s[k]}`);
          store.saveSession(s); renderAdapt();
          showWhy(`You changed it to "${s[k].toLowerCase()}". hmm. adapts from the next reply.`);
        });
      }

      // Bottom panel (wireframe): hint ladder (Socrates), understanding meter (Talmid), argument strength (Rival).
      const seg = (n, of, cls) => `<span class="ladder__seg ${cls}" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
      function renderHints() {
        if (s.char === "rival" && $("#board")) {
          $("#board").innerHTML = `
            <div><span class="label-caps">Your points</span><ul>${s.points.slice(-3).map((p) => `<li data-no-i18n>${esc(p)}</li>`).join("") || "<li>…</li>"}</ul></div>
            <div><span class="label-caps">Rival counters</span><ul>${s.counters.slice(-3).map((p) => `<li data-no-i18n>${esc(p)}</li>`).join("") || "<li>…</li>"}</ul></div>`;
        }
        if (s.char === "talmid") { $("#hints").innerHTML = `<p class="ladder__title"><span>Talmid understands:</span> ${s.meter} <span>of</span> 5</p>${seg(s.meter, 5, "seg--talmid")}`; return; }
        if (s.char === "rival") { $("#hints").innerHTML = `<p class="ladder__title"><span>Argument strength:</span> ${s.meter} <span>of</span> 5</p>${seg(s.meter, 5, "seg--rival")}`; return; }
        const left = s.maxHints - s.hints;
        $("#hints").innerHTML = `
          <p class="ladder__title"><span>Hint ladder</span> · ${s.hints} <span>of</span> ${s.maxHints} <span>used</span></p>
          ${seg(s.hints, s.maxHints, "seg--hint")}
          <p class="ladder__note">Each hint is a bigger clue. You can keep trying after hint ${s.maxHints}; the final answer is never shown.</p>
          <button type="button" class="btn btn--ghost ladder__btn" id="hint" ${left <= 0 || s.busy ? "disabled" : ""}>${left > 0 ? "Give me a hint" : "No hints left, keep going"}</button>`;
        $("#hint").onclick = () => {
          if (s.busy || s.hints >= s.maxHints) return;
          s.hints++; renderHints();
          turn(`[HINT ${s.hints} of ${s.maxHints}]`, false, `asked for hint ${s.hints}`);
        };
      }

      function turnHTML(m) {
        if (m.err) return `<div class="turn turn--sys" role="alert"><p><b>hmm. can't think right now.</b> Your session is saved. Nothing is lost.</p>
          <button class="btn btn--ink auth__submit" id="retry">Try again</button>
          ${s.char === "socrates" ? `<button class="btn btn--ghost auth__submit" id="review">Review your hints so far</button>` : ""}
          ${engineBox("Fallback: the session reopens exactly where it stopped.", { cham: false })}</div>`;
        if (m.hidden) return "";
        const me = m.role === "user";
        return `<div class="turn ${me ? "turn--me" : "turn--ai"}"><span class="turn__who">${me ? "You" : esc(c.name)}</span><p>${m.pending ? `<span class="thinking">thinking</span>` : esc(m.label || m.content)}</p></div>`;
      }
      function renderTurns() {
        $("#turns").innerHTML = s.msgs.map(turnHTML).join("");
        const d = $("#dialogue"); d.scrollTop = d.scrollHeight;
      }
      function showWhy(text) {
        $("#why").innerHTML = text ? engineBox(esc(text)) : "";
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
        if (!s.task.topic) {           // first message = the problem / concept / claim
          s.task.topic = v; s.task.title = `your ${s.char === "rival" ? "claim" : "question"} · ${s.task.course}`;
          store.saveSession(s);
          $("#ask-topic")?.remove(); $("#say").placeholder = t("Type your thinking…");
          const bar = el.querySelector(".sessbar__topic");
          if (bar) bar.innerHTML = { socrates: `<span data-no-i18n>${esc(s.task.course)} · ${esc(v)}</span>`, talmid: `<span>You teach:</span> <b data-no-i18n>${esc(v)}</b> · <span data-no-i18n>${esc(s.task.course)}</span>`, rival: `<span>Your claim:</span> <b data-no-i18n>${esc(v)}</b>` }[s.char];
          turn(`SESSION START. Greet the student in one short line as ${c.name}, then ask your first question.`, true);
          return;
        }
        turn(v);
      };
      $("#end").onclick = () => {
        const said = s.msgs.some((m) => m.role === "user" && !m.hidden);
        if (!said) { store.clearSession(); location.hash = s.task.course ? "#/course/" + encodeURIComponent(s.task.course) : "#/"; return; }
        location.hash = "#/reflect/now";
      };

      function bindRetry() {
        $("#review")?.addEventListener("click", () => {
          const hints = s.msgs.map((m, i) => (m.label?.startsWith("asked for hint") ? s.msgs[i + 1]?.content : null)).filter(Boolean);
          $("#why").innerHTML = engineBox(hints.length ? hints.map((h, i) => `<b>Hint ${i + 1}:</b> ${esc(h)}`).join("<br>") : "No hints used yet in this session.");
        });
        const b = $("#retry"); if (!b) return;
        b.onclick = () => {
          const { retry } = s.msgs.pop();   // the error notice
          s.msgs.pop();                      // the unanswered turn (turn() adds it back)
          turn(retry.text, retry.hidden, retry.label);
        };
      }

      // Mic (wireframe): speak instead of typing, in the student's first language, where the browser supports it.
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const mic = $("#mic");
      if (!SR) { mic.disabled = true; mic.title = "Voice input isn’t supported in this browser"; }
      else mic.onclick = () => {
        const rec = new SR();
        rec.lang = { English: "en-US", "Français": "fr-FR", Darija: "ar-MA", "العربية": "ar-MA" }[store.profile.langs?.[0]] || "en-US";
        rec.interimResults = false;
        mic.classList.add("is-on"); mic.textContent = "…";
        rec.onresult = (e) => { $("#say").value = ($("#say").value + " " + e.results[0][0].transcript).trim(); $("#say").focus(); };
        rec.onend = rec.onerror = () => { mic.classList.remove("is-on"); mic.textContent = "mic"; };
        rec.start();
      };

      s.busy = false;
      renderAdapt(); renderHints(); renderTurns(); showWhy(s.note); bindRetry();
      if (!s.msgs.length && s.task.topic) turn(`SESSION START. Greet the student in one short line as ${c.name}, then ask your first question.`, true);
    },
  };
}
