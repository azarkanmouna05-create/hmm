/* S03 · Student Home — built from Figma frame "E1 · Home (editorial)".
   Content is static for step 1; step 2 wires it to the real profile + assignments. */
import { icons } from "../ui/icons.js";

export function render() {
  const html = `
  <header class="topbar">
    <a class="logo" href="#/" aria-label="hmm. home">hmm<span class="logo__dot"></span></a>
    <span class="topbar__spacer"></span>
    <button class="icon-btn" aria-label="Search">${icons.search}</button>
    <button class="avatar" aria-label="Your thinking profile">M</button>
  </header>

  <nav class="tabs" aria-label="Feed">
    <a href="#/" aria-current="page">For you</a>
    <a href="#/courses">My courses</a>
    <a href="#/saved">Saved</a>
  </nav>

  <section class="feed">
    <article class="today">
      <p class="kicker">Today's question · MATH 1101</p>
      <h1 class="headline" style="margin-top:10px">Why does the product rule add two terms instead of one?</h1>
      <p class="dek" style="margin-top:10px">You froze on step 3 last time, so Socrates will go in small steps today. You'll get there yourself.</p>
      <div class="byline" style="margin-top:10px">
        <span class="initial initial--sm initial--socrates" aria-hidden="true">?</span>
        <span class="byline__who"><b>Socrates</b><span>Due Mon · ~12 min</span></span>
        <span class="byline__spacer"></span>
        <a class="btn btn--ink" href="#/session/socrates">Start thinking</a>
      </div>
    </article>

    <hr class="rule">

    <aside class="note" aria-label="Something hmm. noticed">
      <span class="note__cham" data-chameleon="40"></span>
      <div class="note__body">
        <div class="note__meta"><b>hmm.</b>noticed something · 2h</div>
        <p class="note__text">You do better when you see a worked example first, then try your own. Want me to keep doing that?</p>
        <div class="note__actions">
          <button class="btn btn--sm btn--yes">Yes, that’s me</button>
          <button class="btn btn--sm btn--no">Not really</button>
        </div>
      </div>
    </aside>

    <hr class="rule">

    <h2 class="section-title">Your thinkers</h2>
    <ul class="thinkers">
      ${thinker("socrates", "?", "Socrates", "Asks until you see it. Never tells.")}
      ${thinker("talmid", "T", "Talmid", "A confused classmate. You explain, he learns.")}
      ${thinker("rival", "vs", "The Rival", "Disagrees with you on purpose.")}
    </ul>
  </section>

  <nav class="tabbar" aria-label="Main">
    <a href="#/" aria-current="page">${icons.home}Home</a>
    <a href="#/reflect">${icons.reflect}Reflect</a>
    <a href="#/courses">${icons.courses}Courses</a>
    <a href="#/me">${icons.me}Me</a>
  </nav>`;

  return {
    html,
    mount(el) {
      // "hmm. noticed" Yes/No — acknowledged quietly (stored in profile from step 3)
      el.querySelectorAll(".note__actions .btn").forEach((b) =>
        b.addEventListener("click", () => {
          el.querySelector(".note__actions").outerHTML =
            `<p class="note__meta" style="margin:0">${b.classList.contains("btn--yes") ? "Noted. I’ll keep doing that." : "Thanks, I’ll stop assuming that."}</p>`;
        }));
    },
  };
}

function thinker(key, initial, name, line) {
  return `<li class="thinker">
    <span class="initial initial--${key}" aria-hidden="true">${initial}</span>
    <span class="thinker__text"><b>${name}</b><span>${line}</span></span>
    <a class="btn btn--sm btn--ghost" href="#/session/${key}">Open</a>
  </li>`;
}
