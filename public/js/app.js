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
import * as courses from "./screens/courses.js";
import * as snapshot from "./screens/snapshot.js";
import * as reflect from "./screens/reflect.js";
import * as profile from "./screens/profile.js";
import * as prof from "./screens/professor.js";
import * as admin from "./screens/admin.js";
const as = (fn) => ({ render: fn });

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
  if (role !== "student") {
    if (path.startsWith("/account")) return as(prof.account);
    if (role === "admin") return as(path.startsWith("/rules") ? admin.rules : admin.dashboard);
    if (path.startsWith("/insights")) return as(prof.insights);
    if (path.startsWith("/create")) return as(prof.create);
    return as(prof.home);
  }
  await store.sync();
  if (store.needsSnapshot && !path.startsWith("/snapshot")) { location.replace("#/snapshot/1"); return null; }
  if (path.startsWith("/snapshot")) return snapshot;
  if (path.startsWith("/session/")) return session;
  if (path.startsWith("/course")) return courses;
  if (path.startsWith("/reflect")) return reflect;
  if (path.startsWith("/me")) return profile;
  return home;
}

async function render() {
  const path = location.hash.replace(/^#/, "") || "/";
  const screen = await pick(path);
  if (!screen) return;
  if (!path.startsWith("/login") && store.role !== "student") await store.sync();
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
  // one-line confirmation after an action on the previous screen (e.g. "hmm. now takes bigger steps")
  let toast = null; try { toast = sessionStorage.getItem("hmm.toast"); sessionStorage.removeItem("hmm.toast"); } catch {}
  if (toast) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = toast;
    main.append(t); setTimeout(() => t.remove(), 4200);
  }
}

// The chameleon's hue follows the learner profile from the very first paint (cached), then the live one.
setChameleonMood((store.profile.challenge || "Gentle").toLowerCase());

addEventListener("hashchange", render);
db.initDb().then(render);

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  // When a new version takes over, reload once so the page never runs a mix of old and new code.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
}
