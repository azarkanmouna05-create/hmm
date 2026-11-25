/* The hmm. chameleon — a single SVG drawn in separate parts so each part can move on its own.
   Faces LEFT by default. All colours come from one CSS variable, --cham-h (hue in degrees),
   which is how the adaptation becomes visible: cooler green = gentle, warmer = tough.

   createChameleon() returns { el, lookAt, lookAhead, blink, setWalking, setSleeping, stretch, destroy }.
*/

let uid = 0;

const SVG = (id) => `
<svg class="cham" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="cb${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="cham-c-top"/>
      <stop offset="1" class="cham-c-bot"/>
    </linearGradient>
    <clipPath id="cc${id}"><path d="M40 46 C42 30 56 21 74 22 C90 23 100 32 100 44 C100 54 92 60 78 60 L46 60 C42 58 40 52 40 46 Z"/></clipPath>
  </defs>

  <!-- far legs (behind the body, a shade darker) -->
  <g transform="translate(52 55)"><g class="cham-leg cham-leg--far cham-leg--a"><path d="M0 0 L3 9 L-1 15 M-1 15 L-5 16 M-1 15 L2 17"/></g></g>
  <g transform="translate(90 54)"><g class="cham-leg cham-leg--far cham-leg--b"><path d="M0 0 L-2 9 L1 15 M1 15 L-3 17 M1 15 L5 16"/></g></g>

  <!-- tail: orange spiral, curls and uncurls -->
  <g class="cham-tail">
    <path class="cham-tail__stroke" d="M96 48 C110 49 116 58 114 67 C112 77 100 79 95 73 C91 68 95 62 101 63 C106 64 106 70 102 70"/>
    <path class="cham-tail__hi" d="M98 48.5 C109 50 114 57 112.5 65"/>
  </g>

  <!-- torso: body + head breathe together -->
  <g class="cham-torso">
    <path class="cham-body" fill="url(#cb${id})" d="M40 46 C42 30 56 21 74 22 C90 23 100 32 100 44 C100 54 92 60 78 60 L46 60 C42 58 40 52 40 46 Z"/>
    <g clip-path="url(#cc${id})" class="cham-stripes">
      <path d="M66 20 Q60 40 64 62"/><path d="M78 20 Q73 40 77 62"/><path d="M89 22 Q85 40 89 62"/>
    </g>
    <path class="cham-belly" d="M46 56 Q70 61 96 51"/>
    <path class="cham-body cham-head" fill="url(#cb${id})" d="M10 49 C16 40 26 30 35 11 C42 22 50 28 57 32 C56 46 49 58 34 60 C24 61 15 57 10 49 Z"/>
    <path class="cham-mouth" d="M12 50 Q24 55 38 52"/>
    <!-- eye turret -->
    <g class="cham-eye" transform="translate(30 41)">
      <circle class="cham-eye__turret" r="9.5"/>
      <circle class="cham-eye__ring" r="6"/>
      <g class="cham-eye__look"><circle class="cham-eye__pupil" r="2.6"/><circle class="cham-eye__glint" cx="-.9" cy="-.9" r=".8"/></g>
      <g class="cham-eye__lid-wrap"><circle class="cham-eye__lid" r="9.8"/><path class="cham-eye__lid-line" d="M-7 1.5 Q0 5 7 1.5"/></g>
    </g>
  </g>

  <!-- near legs -->
  <g transform="translate(46 56)"><g class="cham-leg cham-leg--near cham-leg--b"><path d="M0 0 L-3 9 L1 16 M1 16 L-3 18 M1 16 L5 17"/></g></g>
  <g transform="translate(84 56)"><g class="cham-leg cham-leg--near cham-leg--a"><path d="M0 0 L2 9 L-1 16 M-1 16 L-5 17 M-1 16 L3 18"/></g></g>
</svg>`;

export function createChameleon({ size = 56, label = "" } = {}) {
  const id = ++uid;
  const el = document.createElement("div");
  el.className = "cham-wrap";
  el.style.width = size + "px";
  el.innerHTML = SVG(id);
  if (label) { el.setAttribute("role", "img"); el.setAttribute("aria-label", label); }

  const look = el.querySelector(".cham-eye__look");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let blinkTimer = 0;
  let alive = true;

  // Pupil moves inside the turret, max 3 units. (dx, dy) is a direction, any length.
  function lookAt(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 60) * 3;
    look.style.transform = `translate(${(dx / len) * k}px, ${(dy / len) * k}px)`;
  }
  // Look at a point on screen (client coords), accounting for which way we face.
  function lookAtPoint(x, y) {
    const r = el.querySelector(".cham-eye").getBoundingClientRect();
    const flip = el.classList.contains("is-flipped") ? -1 : 1;
    lookAt((x - (r.left + r.width / 2)) * flip, y - (r.top + r.height / 2));
  }
  const lookAhead = () => { look.style.transform = "translate(-2px, .5px)"; };

  function blink() {
    if (el.classList.contains("is-sleeping")) return;
    el.classList.add("is-blinking");
    setTimeout(() => el.classList.remove("is-blinking"), 170);
  }
  function scheduleBlink() {
    if (!alive) return;
    blinkTimer = setTimeout(() => {
      if (!reduced.matches) { blink(); if (Math.random() < .2) setTimeout(blink, 320); }
      scheduleBlink();
    }, 2800 + Math.random() * 4500);
  }
  scheduleBlink();

  return {
    el,
    lookAt, lookAtPoint, lookAhead, blink,
    setWalking: (on) => el.classList.toggle("is-walking", on),
    setSleeping: (on) => el.classList.toggle("is-sleeping", on),
    setFlipped: (on) => el.classList.toggle("is-flipped", on),
    stretch() { el.classList.add("is-stretching"); setTimeout(() => el.classList.remove("is-stretching"), 1400); },
    destroy() { alive = false; clearTimeout(blinkTimer); el.remove(); },
  };
}

/* Mount small static-but-breathing chameleons wherever the markup asks for one:
   <span data-chameleon="40"></span>  (number = width in px) */
export function mountInlineChameleons(root = document) {
  root.querySelectorAll("[data-chameleon]:not([data-mounted])").forEach((slot) => {
    const c = createChameleon({ size: Number(slot.dataset.chameleon) || 40 });
    slot.dataset.mounted = "1";
    slot.append(c.el);
  });
}

/* The adaptation, made visible: challenge level → hue. */
export const HUE = { gentle: 128, balanced: 100, tough: 32 };
export function setChameleonMood(challenge = "balanced") {
  const h = HUE[challenge] ?? HUE.balanced;
  document.documentElement.style.setProperty("--cham-h", h);
}
