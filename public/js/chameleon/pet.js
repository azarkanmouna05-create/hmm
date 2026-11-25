/* The pet: one chameleon living quietly on a screen.
   Behaviour (from the Figma "Pet behaviour (motion spec)" note):
   - sits on a perch (a divider/edge), breathes, blinks, curls its tail
   - about every 30 s it strolls a few steps, or slips away and peeks in from the side somewhere else
   - never covers text: every spot is checked against text boxes before it goes there
   - proximity, not cursor-following: if you come close it pauses and looks at you; tap it and it stretches
   - its eye follows your typing
   - inactive for a while → it sleeps; any input wakes it
   - launch: climbs out of the dot in the hmm. logo, then settles
   - prefers-reduced-motion: sits still on a free spot, no wandering, no launch
*/
import { createChameleon } from "./chameleon.js";

const W = 56;                 // rendered width (px)
const H = W * 84 / 120;       // rendered height
const FEET = H * 0.885;       // where its feet touch the perch, from the top of the svg
const STEP = 7;               // px per step — chameleons move in hesitant little steps
const STEP_MS = 520;
const PAUSE_MS = 170;
const WANDER_MS = [24000, 36000];
const SLEEP_AFTER_MS = 45000;
const NEAR_PX = 110;

const TEXTY = ".tabbar,.bar,.tiles,.pick,select,table,.move,.course-row,h1,h2,h3,p,li,label,a,button,input,textarea,select,.initial,.kicker,.byline__who,.thinker__text,[data-no-pet]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

export class Pet {
  constructor(screen, { launchFrom = null } = {}) {
    this.screen = screen;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.layer = document.createElement("div");
    this.layer.className = "pet-layer";
    this.node = document.createElement("div");
    this.node.className = "pet is-hidden";
    this.node.style.transform = "translate(-200px, -200px)";   // park off-screen until placed
    this.cham = createChameleon({ size: W, label: "hmm.'s chameleon" });
    this.node.append(this.cham.el);
    this.layer.append(this.node);
    screen.append(this.layer);

    this.x = 0; this.y = 0; this.perch = null;
    this.busy = false; this.dead = false; this.asleep = false; this.curious = false;
    this.lastInput = performance.now();

    this._bind();
    this._start(launchFrom);
  }

  /* ---------- geometry ---------- */
  _layerRect() { return this.layer.getBoundingClientRect(); }

  _perches() {
    const L = this._layerRect();
    const vTop = -L.top, vBot = vTop + innerHeight;           // visible band, in layer coords
    return [...this.screen.querySelectorAll("[data-perch], .rule")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, left: r.left - L.left, right: r.right - L.left, y: r.top - L.top };
      })
      .filter((p) => p.right - p.left > W && p.y - H > vTop + 40 && p.y < vBot - 10);
  }

  _obstacles() {
    const L = this._layerRect();
    return [...this.screen.querySelectorAll(TEXTY)]
      .filter((el) => !this.layer.contains(el) && el.offsetParent !== null)
      .map((el) => { const r = el.getBoundingClientRect(); return { l: r.left - L.left - 3, r: r.right - L.left + 3, t: r.top - L.top - 3, b: r.bottom - L.top + 3 }; });
  }

  _isFree(x, perch, obs = this._obstacles()) {
    const box = { l: x + 4, r: x + W - 4, t: perch.y - FEET, b: perch.y - 1 };
    return !obs.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
  }

  // Free x positions along a perch (8px grid), fully on screen.
  _freeSpots(perch) {
    const obs = this._obstacles();
    const out = [];
    const min = Math.max(perch.left, 0), max = Math.min(perch.right, this.layer.clientWidth) - W;
    for (let x = min; x <= max; x += 8) if (this._isFree(x, perch, obs)) out.push(x);
    return out;
  }

  _place(x, y) {
    this.x = x; this.y = y;
    this.node.style.transform = `translate(${x}px, ${y - FEET}px)`;
  }

  /* ---------- lifecycle ---------- */
  async _start(launchFrom) {
    await document.fonts?.ready;
    await sleep(60);
    if (this.dead) return;
    if (this.reduced) return this._settleStill();
    if (launchFrom) await this._launch(launchFrom);
    else await this._peekIn();
    this._loop();
  }

  _settleStill() {
    for (const p of this._perches()) {
      const spots = this._freeSpots(p);
      if (spots.length) { this.perch = p; this._place(spots[spots.length - 1], p.y); this.node.classList.remove("is-hidden"); return; }
    }
  }

  async _loop() {
    while (!this.dead) {
      await sleep(rand(...WANDER_MS));
      if (this.dead) return;
      if (this.asleep || this.curious || this.busy || document.hidden) continue;
      // If our spot scrolled away or got covered (layout change), peek in somewhere visible.
      const visible = this._perches().find((p) => p.el === this.perch?.el);
      if (!visible || !this._isFree(this.x, visible) || Math.random() < 0.3) await this._peekIn();
      else await this._stroll(visible);
    }
  }

  /* ---------- behaviours ---------- */

  // Walk a few steps along the current perch to another free spot, only over free ground.
  async _stroll(perch) {
    const spots = this._freeSpots(perch);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dist = rand(30, 90);
    let target = this.x + dir * dist;
    target = spots.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), this.x);
    await this._walkTo(target, perch);
  }

  async _walkTo(tx, perch) {
    if (Math.abs(tx - this.x) < 4) return;
    this.busy = true;
    const dir = Math.sign(tx - this.x);
    this.cham.setFlipped(dir > 0);
    this.cham.lookAhead();
    this.cham.setWalking(true);
    while (!this.dead && Math.abs(tx - this.x) > 1 && !this.curious) {
      const next = this.x + dir * Math.min(STEP, Math.abs(tx - this.x));
      if (!this._isFree(next, perch)) break;           // never walk onto text
      await this._tween(this.x, next, perch.y, STEP_MS);
      await sleep(PAUSE_MS * (Math.random() < .15 ? 6 : 1)); // the occasional thoughtful pause
    }
    this.cham.setWalking(false);
    this.busy = false;
  }

  _tween(x0, x1, y, ms) {
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        this._place(x0 + (x1 - x0) * e, y);
        if (k < 1 && !this.dead) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }

  // Fade out, reappear half-hidden at the side edge of a visible perch, look around, step in.
  async _peekIn() {
    const perches = this._perches();
    const options = perches.map((p) => ({ p, spots: this._freeSpots(p) })).filter((o) => o.spots.length);
    if (!options.length) { this.node.classList.add("is-hidden"); return; }
    this.busy = true;
    const { p, spots } = options[Math.floor(Math.random() * options.length)];
    const maxX = this.layer.clientWidth - W;
    // A side only counts if the ground from that edge to the landing spot is free of text.
    const pathFree = (from, to) => {
      const d = Math.sign(to - from);
      for (let x = from; d > 0 ? x < to : x > to; x += d * STEP) if (x >= 0 && x <= maxX && !this._isFree(x, p)) return false;
      return true;
    };
    const right = { fromRight: true, edge: this.layer.clientWidth - W * 0.45, landing: spots[spots.length - 1] };
    const left = { fromRight: false, edge: -W * 0.55, landing: spots[0] };
    const sides = [right, left].filter((s) => pathFree(s.edge, s.landing));
    if (!sides.length) {                                   // no way in from an edge: quietly appear in place
      this.node.classList.add("is-hidden"); await sleep(800);
      this.perch = p; this._place(spots[spots.length - 1], p.y);
      this.node.classList.remove("is-hidden"); this.busy = false; return;
    }
    const { fromRight, edge, landing } = sides.length > 1 && Math.random() < 0.4 ? sides[1] : sides[0];

    this.node.classList.add("is-hidden");
    await sleep(800);
    this.perch = p;
    this.cham.setFlipped(!fromRight);
    this._place(edge, p.y);
    this.node.classList.remove("is-hidden");
    await sleep(900);
    this.cham.lookAt(fromRight ? -1 : -1, -0.4);         // glance around
    await sleep(1300);
    this.cham.blink();
    this.cham.lookAt(-1, 0.3);
    await sleep(1100);
    this.busy = false;
    await this._walkTo(landing, p);
  }

  // Launch: climbs out of the logo dot, looks around, then wanders off to a perch.
  async _launch(dot) {
    this.busy = true;
    const L = this._layerRect(), d = dot.getBoundingClientRect();
    const cx = d.left + d.width / 2 - L.left, cy = d.top + d.height / 2 - L.top;
    dot.classList.add("is-portal");
    await sleep(450);
    this.node.style.transition = "none";
    this.node.classList.remove("is-hidden");
    this.cham.setFlipped(true);
    const anim = this.node.animate([
      { transform: `translate(${cx - W / 2}px, ${cy - H / 2}px) scale(.12)`, opacity: 0 },
      { transform: `translate(${cx - W / 2}px, ${cy - H * 0.95}px) scale(.55)`, opacity: 1, offset: .6 },
      { transform: `translate(${cx - W / 2 + 6}px, ${cy - H * 0.85}px) scale(.55)`, opacity: 1 },
    ], { duration: 1500, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
    await anim.finished;
    dot.classList.remove("is-portal");
    this.cham.lookAt(1, 0.6); await sleep(700);
    this.cham.blink(); this.cham.lookAt(-1, 0.6); await sleep(900);
    // fade away at the logo and peek in at a perch below
    this.node.classList.add("is-hidden");
    this.node.style.transition = "";
    await sleep(700);
    anim.cancel();
    this.busy = false;
    await this._peekIn();
  }

  _wake() {
    this.lastInput = performance.now();
    if (this.asleep) { this.asleep = false; this.cham.setSleeping(false); setTimeout(() => this.cham.blink(), 300); }
  }

  /* ---------- reacting to the person ---------- */
  _bind() {
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); (this._off ||= []).push(() => t.removeEventListener(ev, fn, o)); };

    on(window, "pointermove", (e) => {
      this._wake();
      if (this.reduced || this.node.classList.contains("is-hidden")) return;
      const r = this.cham.el.getBoundingClientRect();
      const near = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < NEAR_PX;
      if (near) {
        if (!this.curious) { this.curious = true; this.cham.blink(); }
        this.cham.lookAtPoint(e.clientX, e.clientY);
        clearTimeout(this._curiousT);
        this._curiousT = setTimeout(() => { this.curious = false; this.cham.lookAt(-1, 0); }, 2500);
      }
    }, { passive: true });

    on(window, "keydown", () => this._wake());
    on(window, "scroll", () => this._wake(), { passive: true });

    // eye follows typing
    on(this.screen, "input", (e) => {
      const r = e.target.getBoundingClientRect?.();
      if (r && !this.asleep) this.cham.lookAtPoint(r.left + Math.min(r.width, 14 + (e.target.value?.length || 0) * 7.5), r.top + r.height / 2);
    });

    on(this.cham.el, "click", () => { this._wake(); this.cham.lookAt(0.2, -1); this.cham.stretch(); });

    on(window, "resize", () => {
      if (this.perch && !this.busy && !this.reduced) { clearTimeout(this._rz); this._rz = setTimeout(() => this._peekIn(), 400); }
    });

    this._sleepT = setInterval(() => {
      if (!this.asleep && !this.busy && performance.now() - this.lastInput > SLEEP_AFTER_MS) {
        this.asleep = true; this.cham.setSleeping(true);
      }
    }, 3000);
  }

  destroy() {
    this.dead = true;
    clearInterval(this._sleepT);
    this._off?.forEach((f) => f());
    this.cham.destroy();
    this.layer.remove();
  }
}
