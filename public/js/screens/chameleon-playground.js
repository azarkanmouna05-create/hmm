/* Dev-only page (#/dev/chameleon): every state of the chameleon side by side, plus the hue control.
   Useful for the presentation and for checking motion without waiting 30 s. */
import { createChameleon, setChameleonMood, HUE } from "../chameleon/chameleon.js";

export function render() {
  const html = `
  <header class="topbar"><a class="logo" href="#/">hmm<span class="logo__dot"></span></a></header>
  <section class="feed">
    <p class="kicker">Component · Chameleon</p>
    <h1 class="headline">The chameleon, every state</h1>
    <p class="dek">Hue follows the learner profile's challenge level. Gentle is cool green, tough is warm.</p>
    <div class="note__actions" role="group" aria-label="Challenge level">
      ${Object.keys(HUE).map((k) => `<button class="btn btn--sm btn--ghost" data-mood="${k}">${k}</button>`).join("")}
    </div>
    <hr class="rule">
    <div id="states" style="display:grid;grid-template-columns:repeat(2,1fr);gap:22px 12px"></div>
    <hr class="rule" data-perch>
    <p class="dek" style="font-size:14px">The roaming pet lives on the dividers on this page too.</p>
    <div style="height:40px"></div>
    <hr class="rule">
    <label style="font:var(--t-small);color:var(--muted)">Type here and watch its eye
      <input style="display:block;width:100%;margin-top:6px;padding:12px 14px;border:1px solid var(--hairline);border-radius:10px;background:var(--paper-raised)" placeholder="Reply to Socrates…">
    </label>
  </section>`;

  return {
    html,
    mount(el) {
      const grid = el.querySelector("#states");
      const states = [
        ["Idle: breathing, blinking, tail", () => {}],
        ["Walking", (c) => c.setWalking(true)],
        ["Asleep", (c) => c.setSleeping(true)],
        ["Curious: looking up", (c) => c.lookAt(.3, -1)],
      ];
      for (const [label, apply] of states) {
        const fig = document.createElement("figure");
        fig.style.cssText = "margin:0;display:flex;flex-direction:column;align-items:center;gap:6px";
        const c = createChameleon({ size: 120 });
        apply(c);
        fig.append(c.el);
        fig.insertAdjacentHTML("beforeend", `<figcaption style="font:var(--t-small);color:var(--muted)">${label}</figcaption>`);
        grid.append(fig);
      }
      el.querySelectorAll("[data-mood]").forEach((b) => b.addEventListener("click", () => {
        setChameleonMood(b.dataset.mood);
        try { localStorage.setItem("hmm.challenge", b.dataset.mood); } catch {}
      }));
    },
  };
}
