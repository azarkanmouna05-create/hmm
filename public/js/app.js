/* hmm. — app entry: a tiny hash router. Each screen is a module exporting render(ctx) → { html, mount?(el), pet? }.
   Why vanilla JS: no build step to break, nothing to install to run it, small enough to load fast on
   campus Wi-Fi, and every line is readable when explaining the architecture in the report. */
import { Pet } from "./chameleon/pet.js";
import { mountInlineChameleons, setChameleonMood } from "./chameleon/chameleon.js";
import * as db from "./db.js";
import { store } from "./store.js";
import * as home from "./screens/home.js";
import * as login from "./screens/login.js";
import * as playground from "./screens/chameleon-playground.js";
import * as session from "./screens/session.js";
import * as staffSoon from "./screens/staff-soon.js";

const app = document.getElementById("app");
let pet = null;

function launchedThisSession() {
  try { if (sessionStorage.getItem("hmm.launched")) return true; sessionStorage.setItem("hmm.launched", "1"); } catch {}
  return false;
}
const demoMode = () => { try { return sessionStorage.getItem("hmm.demo") === "1"; } catch { return false; } };

async function pick(path) {
  if (path === "/dev/chameleon") return playground;
  if (path.startsWith("/login")) return login;
  const user = await db.currentUser();
  if (!user && !demoMode()) { location.replace("#/login"); return null; }
  const role = user ? await db.myRole() : "student";
  store.role = role;
  if (role !== "student") return staffSoon;            // S07–S11 arrive in steps 5–6
  if (path.startsWith("/session/")) return session;
  return home;
}

async function render() {
  const path = location.hash.replace(/^#/, "") || "/";
  const screen = await pick(path);
  if (!screen) return;
  if (!path.startsWith("/login")) await store.sync();
  pet?.destroy(); pet = null;
  const { html, mount, pet: wantsPet = true } = screen.render({ path, role: store.role });
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

// The chameleon's hue follows the learner profile from the very first paint (cached), then the live one.
setChameleonMood((store.profile.challenge || "Gentle").toLowerCase());

addEventListener("hashchange", render);
db.initDb().then(render);

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
