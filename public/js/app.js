/* hmm. — app entry: a tiny hash router. Each screen is a module exporting render(ctx) → { html, mount?(el) }.
   Why vanilla JS: no build step to break, nothing to install to run it, small enough to load fast on
   campus Wi-Fi, and every line is readable when explaining the architecture in the report. */
import { Pet } from "./chameleon/pet.js";
import { mountInlineChameleons, setChameleonMood } from "./chameleon/chameleon.js";
import * as home from "./screens/home.js";
import * as playground from "./screens/chameleon-playground.js";

const routes = {
  "/": home,
  "/home": home,
  "/dev/chameleon": playground,
};

const app = document.getElementById("app");
let pet = null;

function launchedThisSession() {
  try { if (sessionStorage.getItem("hmm.launched")) return true; sessionStorage.setItem("hmm.launched", "1"); } catch {}
  return false;
}

function render() {
  const path = location.hash.replace(/^#/, "") || "/";
  const screen = routes[path] || home;
  pet?.destroy();
  const { html, mount, pet: wantsPet = true } = screen.render({ path });
  app.innerHTML = `<main class="screen">${html}</main>`;
  const main = app.firstElementChild;
  mountInlineChameleons(main);
  mount?.(main);
  if (wantsPet) {
    const dot = main.querySelector(".logo__dot");
    pet = new Pet(main, { launchFrom: dot && !launchedThisSession() ? dot : null });
  }
  window.scrollTo(0, 0);
}

// Learner profile → chameleon hue (real profile comes from Supabase in step 3).
let savedChallenge = null;
try { savedChallenge = localStorage.getItem("hmm.challenge"); } catch {}
setChameleonMood(savedChallenge || "gentle");

addEventListener("hashchange", render);
render();

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
