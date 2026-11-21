/**
 * Dragon Flyby for Home Assistant
 * --------------------------------
 * Every few minutes an animated dragon swoops across your dashboard.
 *
 * The dragon lives in its own click-through overlay (pointer-events: none,
 * isolated in a shadow root) that is added on top of the page for the flight
 * and removed straight after, so nothing on the dashboard is touched.
 *
 * Original artwork, inspired by the dragons of "How to Train Your Dragon".
 *
 * Load it as a dashboard resource of type "JavaScript module". Options go in
 * the query string of the resource URL, for example:
 *   /local/dragon-flyby/dragon-flyby.js?interval=15&duration=5&dragon=random
 *
 *   interval    minutes between flights                 (default 15)
 *   duration    seconds on screen, 1 to 10              (default 5)
 *   dragon      random | shadow | spike | ember | moon  (default random)
 *   size        small | medium | large                  (default medium)
 *   dashboards  1 = only fly over dashboards            (default 1)
 *   onload      1 = also fly a few seconds after load   (default 0)
 *
 * From the browser console: dragonFlyby.fly() or dragonFlyby.fly("ember").
 */

const VERSION = "1.1.0";
const DEFAULT_DURATION_S = 5;
const MAX_DURATION_S = 10;
const SIZES = { small: 170, medium: 250, large: 350 };

// Wing, tail and head pivots in SVG viewBox units (viewBox 0 -40 320 240).
const SHOULDER = "172px 97px";
const TAIL_ROOT = "118px 108px";
const NECK = "212px 102px";
const MOUTH = [289, 96];
const WING_SCALE = 1.45;
const HEAD_SCALE = 1.12;
const ASPECT = 0.75; // viewBox height / width

const DRAGONS = {
  // Sleek, jet-black stealth flyer with big green eyes and a plasma blast.
  shadow: {
    name: "Shadow Wing",
    body: "#23272f", shade: "#15181d", belly: "#2f3540", line: "#4b5463",
    wing: "#2b303a", wingFar: "#181b21", bone: "#414a58", accent: "#1b1e24",
    eye: "#a8e65c", pupil: "#0a0c0f",
    head: "ears", ridge: "plates",
    blast: { kind: "ball", core: "#f4f8ff", mid: "#93b7ff", outer: "#6d47ff" },
  },
  // Bright, bird-like spiky dragon with a horned crown and a spiked tail.
  spike: {
    name: "Spike Tail",
    body: "#2e9fd2", shade: "#1c6c98", belly: "#f5d05a", line: "#164f70",
    wing: "#4bb8e2", wingFar: "#21709c", bone: "#f5d05a", accent: "#f5d05a",
    eye: "#ffd43f", pupil: "#14181c",
    head: "crown", ridge: "spikes",
    blast: { kind: "ball", core: "#ffffff", mid: "#fff3a8", outer: "#ffd43f" },
  },
  // Fiery, horned brute that breathes a proper flame.
  ember: {
    name: "Ember Horn",
    body: "#b9362c", shade: "#7b1f19", belly: "#eba843", line: "#5a1511",
    wing: "#ca4e3f", wingFar: "#84261e", bone: "#f2b64f", accent: "#3b2519",
    eye: "#ffd034", pupil: "#1b0d07",
    head: "horns", ridge: "spines",
    blast: { kind: "flame", core: "#fff7c4", mid: "#ffb400", outer: "#ff4b00" },
  },
  // Pale, shimmering night glider with ice-blue eyes.
  moon: {
    name: "Moon Glider",
    body: "#eef2f8", shade: "#c4cfdc", belly: "#ffffff", line: "#8b9bb0",
    wing: "#e3eaf3", wingFar: "#b5c2d2", bone: "#a8b7c9", accent: "#cdd8e6",
    eye: "#4db1ff", pupil: "#0c2135",
    head: "ears", ridge: "none", glow: "rgba(150, 205, 255, 0.75)",
    blast: { kind: "ball", core: "#ffffff", mid: "#d2ebff", outer: "#5cb7ff" },
  },
};

/* ------------------------------------------------------------------------ */
/* Configuration                                                            */
/* ------------------------------------------------------------------------ */

function readConfig(url) {
  let params;
  try {
    params = new URL(url).searchParams;
  } catch (_err) {
    params = new URLSearchParams();
  }
  const num = (key, def, min, max) => {
    const value = Number.parseFloat(params.get(key));
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : def;
  };
  const bool = (key, def) =>
    params.has(key) ? /^(1|true|yes|on)$/i.test(params.get(key)) : def;
  const pick = (key, def, allowed) => {
    const value = (params.get(key) || "").toLowerCase();
    return allowed.includes(value) ? value : def;
  };
  return {
    interval: num("interval", 15, 0.25, 1440), // minutes
    duration: num("duration", DEFAULT_DURATION_S, 1, MAX_DURATION_S), // seconds
    dragon: pick("dragon", "random", ["random", ...Object.keys(DRAGONS)]),
    size: pick("size", "medium", Object.keys(SIZES)),
    dashboardsOnly: bool("dashboards", true),
    flyOnLoad: bool("onload", false),
  };
}

/* ------------------------------------------------------------------------ */
/* Artwork                                                                  */
/* ------------------------------------------------------------------------ */

// Wing in its raised position, attached at the shoulder. The trailing edge is
// scalloped between the "finger" bones like a bat wing.
const WING_PATH =
  "M184 98 C178 72 166 52 152 39 C138 26 114 14 88 8 C95 18 97 27 95 35 " +
  "C105 37 111 43 113 51 C121 53 127 59 129 67 C137 69 141 77 141 85 " +
  "C149 87 153 93 154 99 Z";
const WING_BONES =
  "M182 97 C176 72 166 52 152 39 M152 39 L90 10 M152 39 L96 34 " +
  "M152 39 L113 50 M152 39 L129 66 M152 39 L141 84";

const TAIL_PATH =
  "M120 98 C92 95 62 104 36 92 C30 89 24 88 17 88 C24 92 30 96 37 100 " +
  "C62 114 94 117 122 118 Z";
const BODY_PATH =
  "M108 102 C126 84 172 79 200 88 C216 94 218 114 204 121 " +
  "C176 132 130 130 110 121 C102 115 102 107 108 102 Z";
const BELLY_PATH =
  "M116 117 C140 126 178 126 204 115 C199 124 182 130 160 131 " +
  "C138 131 123 125 116 117 Z";
const NECK_PATH =
  "M190 94 C204 84 220 77 236 77 L242 104 C228 106 214 114 204 119 Z";
const HEAD_PATH =
  "M228 74 C240 63 262 65 273 75 C281 81 285 88 283 94 C277 101 263 103 " +
  "251 103 C239 103 228 97 226 89 C225 83 225 78 228 74 Z";
const JAW_PATH = "M246 97 C258 101 272 99 282 93";

// Points along the spine (x, y on the top line, height) for ridge decoration.
const RIDGE_POINTS = [
  [212, 87, 6], [197, 85, 7], [182, 82, 8], [166, 81, 8], [150, 83, 7],
  [134, 88, 6], [114, 96, 6], [92, 98, 5], [72, 100, 5], [54, 98, 4],
];

function ridge(d) {
  if (d.ridge === "none") return "";
  return RIDGE_POINTS.map(([x, y, h], i) => {
    if (d.ridge === "plates") {
      // Small rounded plates that lean backwards.
      return `<path d="M${x - 5} ${y + 3} Q${x - 4} ${y - h} ${x - 1} ${y - h} Q${x + 2} ${y - h + 2} ${x + 4} ${y + 3} Z"/>`;
    }
    // Spikes grow towards the tail, spines stay even.
    const tall = d.ridge === "spikes" ? h + (i > 5 ? 7 : 2) : h + 3;
    return `<path d="M${x - 5} ${y + 3} L${x - 6} ${y - tall} L${x + 5} ${y + 3} Z"/>`;
  }).join("");
}

function headGear(d) {
  if (d.head === "ears") {
    return `
      <path d="M232 76 C220 66 207 61 194 63 C204 69 213 78 222 85 Z"/>
      <path d="M239 70 C235 57 227 49 216 47 C221 57 226 67 231 76 Z"/>
      <path d="M229 82 C220 80 212 82 206 87 C214 87 220 88 227 90 Z"/>`;
  }
  if (d.head === "crown") {
    return `
      <path d="M230 77 L196 56 L234 82 Z"/>
      <path d="M236 71 L208 40 L242 68 Z"/>
      <path d="M244 67 L230 30 L251 66 Z"/>
      <path d="M253 66 L252 36 L259 67 Z"/>
      <path d="M268 74 L276 58 L275 78 Z"/>`;
  }
  if (d.head === "horns") {
    return `
      <path d="M236 72 C228 57 216 48 198 45 C212 53 221 63 228 78 Z"/>
      <path d="M246 67 C247 52 241 40 229 31 C235 44 237 56 237 69 Z"/>
      <path d="M236 98 L226 108 L242 101 Z"/>
      <path d="M248 102 L242 113 L254 103 Z"/>`;
  }
  return "";
}

function blast(d) {
  const b = d.blast;
  if (b.kind === "flame") {
    return `
      <path fill="${b.outer}" opacity="0.85" d="M0 0 C14 -16 50 -20 84 -6 C66 -6 60 0 86 6 C52 22 14 16 0 0 Z"/>
      <path fill="${b.mid}" d="M0 0 C12 -10 40 -12 64 -3 C50 -2 48 2 66 5 C40 13 12 10 0 0 Z"/>
      <path fill="${b.core}" d="M0 0 C10 -5 26 -6 40 -1 C28 1 28 2 40 3 C26 7 10 6 0 0 Z"/>`;
  }
  return `
    <circle fill="${b.outer}" opacity="0.35" cx="14" cy="0" r="15"/>
    <circle fill="${b.mid}" opacity="0.85" cx="14" cy="0" r="9.5"/>
    <circle fill="${b.core}" cx="14" cy="0" r="5"/>`;
}

// Scale a part up around the shoulder joint.
const grow = (k) => `translate(172 97) scale(${k}) translate(-172 -97)`;

function dragonSvg(d) {
  return `
<svg class="dragon" viewBox="0 -40 320 240" xmlns="http://www.w3.org/2000/svg">
  <g class="wing wing-far"><g transform="${grow(WING_SCALE * 0.95)} translate(-14 -4)">
    <path fill="${d.wingFar}" d="${WING_PATH}"/>
    <path class="bones" stroke="${d.shade}" d="${WING_BONES}"/>
  </g></g>
  <g class="tail">
    <path fill="${d.body}" d="${TAIL_PATH}"/>
    <path fill="${d.wing}" d="M31 90 C23 76 11 71 3 72 C9 79 14 87 22 92 Z"/>
    <path fill="${d.wingFar}" d="M31 95 C21 103 11 111 3 111 C9 103 16 97 24 92 Z"/>
    <g fill="${d.accent}">${d.ridge === "spikes" ? `
      <path d="M26 92 L2 84 L24 96 Z"/><path d="M28 95 L6 104 L30 97 Z"/>` : ""}</g>
  </g>
  <g fill="${d.shade}">
    <path d="M138 122 C143 134 139 143 130 148 C130 140 128 132 125 124 Z"/>
    <path d="M192 119 C197 130 195 138 188 142 C186 135 184 128 181 121 Z"/>
  </g>
  <path fill="${d.body}" d="${BODY_PATH}"/>
  <path fill="${d.belly}" d="${BELLY_PATH}"/>
  <path class="sheen" d="M124 94 C148 85 178 84 198 90"/>
  <g fill="${d.accent}" class="ridge">${ridge(d)}</g>
  <g class="head"><g transform="translate(240 90) scale(${HEAD_SCALE}) translate(-240 -90)">
    <path fill="${d.body}" d="${NECK_PATH}"/>
    <g fill="${d.head === "ears" ? d.shade : d.accent}">${headGear(d)}</g>
    <path fill="${d.body}" d="${HEAD_PATH}"/>
    <path fill="${d.shade}" opacity="0.55" d="M242 75 C250 70 262 71 266 77 C258 74 250 74 242 79 Z"/>
    <path class="jaw" d="${JAW_PATH}"/>
    <circle fill="${d.shade}" cx="276" cy="84" r="1.6"/>
    <ellipse fill="${d.eye}" cx="254" cy="84" rx="7.5" ry="7"/>
    <ellipse fill="${d.pupil}" cx="255.5" cy="84" rx="1.8" ry="5.4"/>
    <circle fill="#ffffff" opacity="0.9" cx="251.6" cy="81" r="1.7"/>
  </g></g>
  <g class="wing wing-near"><g transform="${grow(WING_SCALE)}">
    <path fill="${d.wing}" d="${WING_PATH}"/>
    <path class="bones" stroke="${d.bone}" d="${WING_BONES}"/>
  </g></g>
  <g transform="translate(${MOUTH[0]} ${MOUTH[1]})"><g class="blast">${blast(d)}</g></g>
</svg>`;
}

/* ------------------------------------------------------------------------ */
/* Flight                                                                   */
/* ------------------------------------------------------------------------ */

const STYLE = `
:host { all: initial; }
.flight {
  position: absolute; left: 0; top: 0;
  width: var(--w); height: var(--h);
  will-change: transform;
}
.bob, .facing { width: 100%; height: 100%; }
.bob { animation: bob var(--flap) ease-in-out infinite; }
.facing.rtl { transform: scaleX(-1); }
svg { display: block; width: 100%; height: 100%; overflow: visible; filter: var(--glow, none); }
svg path { stroke: var(--line); stroke-width: 1.1; stroke-linejoin: round; }
svg .bones { fill: none; stroke-width: 1.4; stroke-linecap: round; opacity: 0.9; }
svg .jaw, svg .sheen { fill: none; stroke-width: 1.4; stroke-linecap: round; }
svg .sheen { stroke: rgba(255, 255, 255, 0.18); stroke-width: 2.5; }
svg .blast path { stroke: none; }
.wing {
  transform-box: view-box; transform-origin: ${SHOULDER};
  animation: flap var(--flap) ease-in-out infinite;
}
.wing-far { animation-delay: calc(var(--flap) * -0.1); }
.tail {
  transform-box: view-box; transform-origin: ${TAIL_ROOT};
  animation: sway calc(var(--flap) * 2) ease-in-out infinite;
}
.head {
  transform-box: view-box; transform-origin: ${NECK};
  animation: nod calc(var(--flap) * 2) ease-in-out infinite;
}
.blast {
  opacity: 0;
  animation: blast var(--blast-len) ease-out var(--blast-at) 1 both;
}
@keyframes flap {
  0%, 100% { transform: scaleY(1) skewX(0deg); }
  50% { transform: scaleY(-0.62) skewX(-8deg); }
}
@keyframes bob {
  0%, 100% { transform: translateY(5%); }
  50% { transform: translateY(-5%); }
}
@keyframes sway {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(6deg); }
}
@keyframes nod {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(3deg); }
}
@keyframes blast {
  0% { opacity: 0; transform: translateX(0) scale(0.2); }
  12% { opacity: 1; }
  70% { opacity: 0.9; }
  100% { opacity: 0; transform: translateX(150px) scale(1.7); }
}
`;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function flightPath(vw, vh, w, h, ltr, steps = 24) {
  const startX = ltr ? -w * 1.05 : vw + w * 0.05;
  const endX = ltr ? vw + w * 0.05 : -w * 1.05;
  const maxY = Math.max(0, vh - h);
  const baseY = rand(0.05, 0.5) * maxY;
  const swoop = rand(0.12, 0.3) * maxY * (Math.random() < 0.5 ? 1 : -1);
  const drift = rand(-0.2, 0.2) * maxY;
  const waves = rand(0.8, 1.5);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = clamp(baseY + drift * t + swoop * Math.sin(Math.PI * waves * t), 0, maxY);
    points.push([x, y]);
  }
  return points.map(([x, y], i) => {
    const [px, py] = points[Math.max(0, i - 1)];
    const [nx, ny] = points[Math.min(points.length - 1, i + 1)];
    let angle = (Math.atan2(ny - py, Math.abs(nx - px)) * 180) / Math.PI;
    angle = clamp(angle * 0.8, -22, 22) * (ltr ? 1 : -1);
    return { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`, offset: i / steps };
  });
}

function createFlyby(cfg) {
  let active = null;
  let lastKind = null;

  function chooseKind(kind) {
    if (kind && DRAGONS[kind]) return kind;
    if (cfg.dragon !== "random") return cfg.dragon;
    const kinds = Object.keys(DRAGONS).filter((k) => k !== lastKind);
    return kinds[Math.floor(Math.random() * kinds.length)];
  }

  function fly(kind) {
    if (active || !document.body) return false;
    const key = chooseKind(kind);
    const d = DRAGONS[key];
    lastKind = key;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.round(Math.min(SIZES[cfg.size], vw * 0.45));
    const h = Math.round(w * ASPECT);
    const ltr = Math.random() < 0.5;
    const durationMs = Math.round(cfg.duration * 1000);
    const flapS = cfg.size === "large" ? 0.5 : 0.42;

    // Click-through overlay, isolated in a shadow root so it neither inherits
    // nor leaks any styling. Nothing else on the page is changed.
    const host = document.createElement("dragon-flyby-overlay");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;" +
      "overflow:hidden;contain:strict;display:block;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <div class="flight"><div class="bob"><div class="facing ${ltr ? "" : "rtl"}">
        ${dragonSvg(d)}
      </div></div></div>`;
    const flight = root.querySelector(".flight");
    flight.style.setProperty("--w", `${w}px`);
    flight.style.setProperty("--h", `${h}px`);
    flight.style.setProperty("--flap", `${flapS}s`);
    flight.style.setProperty("--line", d.line);
    flight.style.setProperty("--blast-at", `${(cfg.duration * 0.42).toFixed(2)}s`);
    flight.style.setProperty("--blast-len", `${Math.min(0.9, cfg.duration * 0.3).toFixed(2)}s`);
    if (d.glow) flight.style.setProperty("--glow", `drop-shadow(0 0 6px ${d.glow})`);

    document.body.appendChild(host);

    const animation = flight.animate(flightPath(vw, vh, w, h, ltr), {
      duration: durationMs,
      easing: "linear",
      fill: "forwards",
    });

    const done = () => {
      if (active !== record) return;
      clearTimeout(record.timer);
      animation.cancel();
      host.remove();
      active = null;
    };
    const record = { host, timer: setTimeout(done, durationMs) };
    animation.onfinish = done;
    active = record;
    return true;
  }

  function cancel() {
    if (!active) return;
    clearTimeout(active.timer);
    active.host.remove();
    active = null;
  }

  return { fly, cancel };
}

/* ------------------------------------------------------------------------ */
/* Scheduling                                                               */
/* ------------------------------------------------------------------------ */

// Paths that are never dashboards, used when the panel list is unavailable.
const NOT_DASHBOARDS = new Set([
  "config", "developer-tools", "hassio", "profile", "history", "logbook",
  "energy", "media-browser", "todo", "calendar", "auth", "onboarding", "api",
]);

function onDashboard() {
  const segment = decodeURIComponent(window.location.pathname.split("/")[1] || "");
  if (!segment) return true; // "/" redirects to the default dashboard
  const panels = document.querySelector("home-assistant")?.hass?.panels;
  if (panels && panels[segment]) return panels[segment].component_name === "lovelace";
  return !NOT_DASHBOARDS.has(segment);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function start() {
  const cfg = readConfig(import.meta.url);

  // A newer copy (for example after changing options) replaces the old one.
  window.dragonFlyby?.stop?.();

  const flyby = createFlyby(cfg);
  let warnedMotion = false;

  const tick = () => {
    if (document.hidden) return;
    if (cfg.dashboardsOnly && !onDashboard()) return;
    if (prefersReducedMotion()) {
      if (!warnedMotion) {
        console.info("Dragon Flyby: skipped because the device asks for reduced motion.");
        warnedMotion = true;
      }
      return;
    }
    flyby.fly();
  };

  const timer = window.setInterval(tick, cfg.interval * 60 * 1000);
  const firstFlight = cfg.flyOnLoad ? window.setTimeout(tick, 3000) : null;

  window.dragonFlyby = {
    version: VERSION,
    config: cfg,
    dragons: Object.keys(DRAGONS),
    fly: (kind) => flyby.fly(kind),
    stop: () => {
      clearInterval(timer);
      clearTimeout(firstFlight);
      flyby.cancel();
    },
  };

  console.info(
    `%c DRAGON-FLYBY %c v${VERSION} - every ${cfg.interval} min, ${cfg.duration}s `,
    "color:#fff;background:#23272f;font-weight:700;",
    "color:#23272f;background:#a8e65c;",
  );
}

start();
