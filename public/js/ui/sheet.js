/* Bottom sheet (modal) used for "pick a character" and "start a session". */
import { mountInlineChameleons } from "../chameleon/chameleon.js";

export function openSheet(title, inner) {
  const wrap = document.createElement("div");
  wrap.className = "sheet";
  wrap.innerHTML = `<div class="sheet__panel" role="dialog" aria-modal="true" aria-label="${title.replace(/"/g, "&quot;")}">
    <div class="sheet__head"><b>${title}</b><button type="button" class="icon-btn sheet__x" aria-label="Close">✕</button></div>
    <div class="sheet__body">${inner}</div></div>`;
  document.getElementById("app").append(wrap);
  mountInlineChameleons(wrap);
  const close = () => wrap.remove();
  wrap.querySelector(".sheet__x").onclick = close;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  addEventListener("hashchange", close, { once: true });
  wrap.querySelector("textarea, input, button:not(.sheet__x)")?.focus();
  return { el: wrap, close };
}
