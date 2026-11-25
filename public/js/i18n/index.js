/* hmm. interface language. The whole app (not just the AI) can be English, Français, العربية (RTL) or Darija.
   How it works: every screen renders in English; this layer translates the visible interface text in place
   (text, placeholders, aria-labels) using dict.js, including content that loads later. Text that people or
   the AI wrote (dialogue, topics, names) never matches the dictionary, so it is left untouched. */
import { ROWS, PATTERNS } from "./dict.js";

export const UI_LANGS = [
  { code: "en", label: "English" }, { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" }, { code: "dar", label: "Darija" },
];
const COL = { fr: 1, ar: 2, dar: 3 };
const MAP = new Map(ROWS.map((r) => [r[0], r]));
const LOCALES = { en: "en-GB", fr: "fr-FR", ar: "ar-MA", dar: "fr-MA" };

function initial() {
  try { const s = localStorage.getItem("hmm.ui"); if (s && (s === "en" || COL[s])) return s; } catch {}
  const n = (navigator.language || "en").toLowerCase();
  return n.startsWith("fr") ? "fr" : n.startsWith("ar") ? "ar" : "en";
}
let lang = initial();
export const uiLang = () => lang;
export const locale = () => LOCALES[lang];

/* Translate one English string (exact phrase or pattern). Returns null when there is nothing to translate. */
export function tr(s, depth = 0) {
  if (lang === "en" || !s || depth > 3) return null;   // depth guard: a phrase can never loop back on itself
  const key = s.trim();
  const row = MAP.get(key);
  if (row?.[COL[lang]]) return s.replace(key, row[COL[lang]]);
  for (const [re, v] of PATTERNS) {
    const m = key.match(re);
    if (!m || !v[lang]) continue;
    const sub = (x) => (x.trim() === key ? x : tr(x, depth + 1) ?? x);
    const out = typeof v[lang] === "function" ? v[lang](m, sub) : v[lang].replace(/\$(\d)/g, (_, i) => m[i] ?? "");
    return s.replace(key, out);
  }
  return null;
}
export const t = (s) => tr(s) ?? s;

const SKIP = "[data-no-i18n], .turn p, .dialogue__problem, .headline--user, script, style, textarea, input[type=email], code";
const ATTRS = ["placeholder", "aria-label", "title"];
function translateTree(root) {
  if (lang === "en" || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim().length < 2 || n.parentElement?.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) { const v = tr(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; }
  const els = root.querySelectorAll ? root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")) : [];
  for (const el of [root, ...els]) for (const a of ATTRS) {
    const val = el.getAttribute?.(a); if (!val || el.closest?.("[data-no-i18n]")) continue;
    const v = tr(val); if (v != null && v !== val) el.setAttribute(a, v);
  }
}

let observer = null;
export function startI18n(root = document.body) {
  applyDocumentLang();
  translateTree(root);
  observer?.disconnect();
  if (lang === "en") return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") { const n = m.target; const v = !n.parentElement?.closest(SKIP) && tr(n.nodeValue); if (v && v !== n.nodeValue) n.nodeValue = v; }
      else m.addedNodes.forEach((n) => n.nodeType === 1 ? translateTree(n) : n.nodeType === 3 && n.parentElement && !n.parentElement.closest(SKIP) && (() => { const v = tr(n.nodeValue); if (v && v !== n.nodeValue) n.nodeValue = v; })());
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}
function applyDocumentLang() {
  document.documentElement.lang = lang === "dar" ? "ar-MA" : lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}
export function setUiLang(code) {
  if (code !== "en" && !COL[code]) return;
  lang = code;
  try { localStorage.setItem("hmm.ui", code); } catch {}
  location.reload();   // simplest way to re-render every screen in the new language
}
/* A compact language picker (used on Login, Profile and staff Account). */
export function langPicker() {
  return `<label class="lang-pick" data-no-i18n><span class="sr-only">App language</span>
    <select id="ui-lang" aria-label="App language">${UI_LANGS.map((l) => `<option value="${l.code}" ${l.code === lang ? "selected" : ""}>${l.label}</option>`).join("")}</select></label>`;
}
export function bindLangPicker(el) { el.querySelector("#ui-lang")?.addEventListener("change", (e) => setUiLang(e.target.value)); }
/* Native dialogs (confirm/prompt/alert) bypass the DOM, so translate their text explicitly. */
export const ask = (s) => confirm(t(s));
export const askText = (s) => prompt(t(s));
