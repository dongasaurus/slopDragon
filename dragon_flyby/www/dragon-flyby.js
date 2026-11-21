/**
 * Dragon Flyby for Home Assistant
 * --------------------------------
 * Every few minutes something magical crosses your dashboard: a dragon, or
 * in a holiday theme Santa's sleigh, a surfing Santa, a witch, a skeleton,
 * the Easter bunny...
 *
 * Each visitor lives in its own click-through overlay (pointer-events: none,
 * isolated in a shadow root) that is added on top of the page for the flight
 * and removed straight after, so nothing on the dashboard is touched.
 *
 * Original artwork. The dragons are inspired by "How to Train Your Dragon".
 *
 * Load it as a dashboard resource of type "JavaScript module". Options go in
 * the query string of the resource URL, for example:
 *   /local/dragon-flyby/dragon-flyby.js?interval=15&duration=5&theme=auto
 *
 *   interval    minutes between visits                        (default 15)
 *   duration    seconds on screen, 1 to 10                    (default 5)
 *   theme       dragons | christmas | australianchristmas | halloween |
 *               easter | auto                                 (default dragons)
 *   dragon      random | shadow | spike | ember | moon        (default random)
 *   size        small | medium | large                        (default medium)
 *   dashboards  1 = only show on dashboards                   (default 1)
 *   onload      1 = also show a few seconds after load        (default 0)
 *
 * "auto" picks the theme from the date: Halloween in October, Christmas in
 * December (the Australian summer Christmas when Home Assistant is set to
 * Australia), Easter from a week before Easter Sunday to Easter Monday, and
 * dragons the rest of the year.
 *
 * From the browser console:
 *   dragonFlyby.fly()             - a visitor from the current theme
 *   dragonFlyby.fly("halloween")  - a random visitor from a theme
 *   dragonFlyby.fly("sleigh")     - a specific visitor (see dragonFlyby.characters)
 */

const VERSION = "1.4.0";
const DEFAULT_DURATION_S = 5;
const MAX_DURATION_S = 10;
const SIZES = { small: 170, medium: 250, large: 350 };
const THEMES = ["dragons", "christmas", "australianchristmas", "halloween", "easter"];

// Wing, tail and head pivots in SVG viewBox units (viewBox 0 -40 320 240).
const SHOULDER = "172px 97px";
const TAIL_ROOT = "118px 108px";
const NECK = "212px 102px";
const MOUTH = [289, 96];
const WING_SCALE = 1.45;
const HEAD_SCALE = 1.12;

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
    theme: pick("theme", "dragons", [...THEMES, "auto"]),
    dragon: pick("dragon", "random", ["random", ...Object.keys(DRAGONS)]),
    size: pick("size", "medium", Object.keys(SIZES)),
    dashboardsOnly: bool("dashboards", true),
    flyOnLoad: bool("onload", false),
  };
}

/* ------------------------------------------------------------------------ */
/* Seasons                                                                  */
/* ------------------------------------------------------------------------ */

// Easter Sunday (Gregorian calendar), anonymous Gregorian algorithm.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Home Assistant's country setting, else its time zone, else the browser's.
function inAustralia() {
  const config = document.querySelector("home-assistant")?.hass?.config;
  if (config?.country) return config.country === "AU";
  let zone = config?.time_zone;
  if (!zone) {
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_err) {
      zone = "";
    }
  }
  return /^Australia\//.test(zone || "");
}

function seasonFor(date, australia = false) {
  const month = date.getMonth();
  if (month === 9) return "halloween";
  if (month === 11) return australia ? "australianchristmas" : "christmas";
  const day = new Date(date.getFullYear(), month, date.getDate());
  const easter = easterSunday(date.getFullYear());
  const from = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 7);
  const to = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1);
  if (day >= from && day <= to) return "easter";
  return "dragons";
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

// A floppy Santa hat for the Christmas dragon, in head coordinates.
const SANTA_HAT = `
    <path fill="#d62828" d="M240 70 C235 54 226 44 210 41 C224 34 252 40 265 61 C267 64 268 67 268 70 Z"/>
    <rect fill="#ffffff" x="236" y="64" width="35" height="9" rx="4.5" transform="rotate(-6 253 68)"/>
    <circle fill="#ffffff" cx="209" cy="41" r="6"/>`;

function dragonSvg(d, { santaHat = false } = {}) {
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
    <path fill="${d.shade}" opacity="0.55" d="M242 75 C250 70 262 71 266 77 C258 74 250 74 242 79 Z"/>${santaHat ? SANTA_HAT : ""}
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
/* Holiday artwork                                                          */
/* ------------------------------------------------------------------------ */
// Every character faces right; the engine mirrors it when it travels left.
// Shapes get an outline in the character's line colour unless marked
// class="ns" (no stroke). class="ln" marks plain lines (no fill).

const svgOpen = (cls, vb) =>
  `<svg class="actor ${cls}" viewBox="${vb.join(" ")}" xmlns="http://www.w3.org/2000/svg">`;

const sparkle = (x, y, s, color, delay) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path class="twinkle ns" fill="${color}" ` +
  `style="animation-delay:${delay}s" d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z"/></g>`;

const delayed = (fraction) => `animation-delay:calc(var(--cycle) * ${-fraction})`;

function speech(x, y, width, text, color) {
  const cx = x + width / 2;
  const right = x + width - 15;
  const bottom = y + 30;
  return `<g class="say"><g class="pop">
    <path fill="#ffffff" style="stroke:#c3c9d2;stroke-width:1.2" d="M${x + 15} ${y} H${right} A15 15 0 0 1 ${right} ${bottom} H${cx - 4} L${cx - 16} ${y + 40} L${cx - 14} ${bottom} H${x + 15} A15 15 0 0 1 ${x + 15} ${y} Z"/>
    <text x="${cx}" y="${y + 21}" text-anchor="middle" font-size="18" font-weight="800" fill="${color}">${text}</text>
  </g></g>`;
}

/* ---- Christmas ---------------------------------------------------------- */

function reindeer(x, y, phase = 0, gait = "gallop") {
  const leg = (fill, d, offset) =>
    `<g class="leg ${gait}" style="${delayed(phase + offset)}"><path fill="${fill}" d="${d}"/></g>`;
  return `<g transform="translate(${x} ${y})">
    ${leg("#6b4325", "M23 44 L18 64 L22 66 L30 46 Z", 0.5)}
    ${leg("#6b4325", "M56 44 L56 65 L61 65 L63 44 Z", 0.08)}
    <path fill="#a06d40" d="M14 36 C16 26 34 23 50 25 C61 26 67 32 67 40 C67 48 57 53 40 53 C24 53 12 46 14 36 Z"/>
    <path class="ns" fill="#ead6b6" d="M24 47 C34 53 50 53 60 46 C55 52 46 55 39 55 C31 55 27 51 24 47 Z"/>
    <path fill="#fffaf0" d="M15 33 C9 28 6 33 8 37 C10 39 13 38 16 37 Z"/>
    <path fill="#a06d40" d="M55 33 C59 23 63 15 69 10 L78 16 C72 22 68 30 65 41 Z"/>
    <path fill="#a06d40" d="M67 8 C73 3 82 5 86 9 C90 11 93 14 91 18 C87 21 80 21 76 19 C71 17 67 14 67 8 Z"/>
    <path class="ns" fill="#ead6b6" d="M80 15 C84 18 88 19 91 17 C89 20 84 21 80 19 Z"/>
    <circle fill="#3a2418" cx="90.5" cy="14.5" r="2.4"/>
    <circle class="ns" fill="#1b120c" cx="78" cy="10" r="1.6"/>
    <path fill="#8a5a33" d="M70 8 C66 3 61 3 58 6 C62 8 66 10 70 11 Z"/>
    <path class="ln" style="stroke:#e2c595;stroke-width:2.6" d="M72 5 C70 -3 66 -9 59 -12 M66 -5 L59 -4 M69 -1 L64 -11 M76 4 C78 -4 82 -9 89 -11 M80 -4 L87 -2 M79 -1 L82 -12"/>
    <path class="ln" style="stroke:#c62828;stroke-width:4" d="M57 31 C61 36 66 38 71 37"/>
    <circle fill="#f4c542" cx="65" cy="39" r="2.6"/>
    ${leg("#8a5a33", "M28 46 L23 66 L27 68 L35 47 Z", 0)}
    ${leg("#8a5a33", "M59 46 L61 67 L66 67 L65 45 Z", 0.58)}
  </g>`;
}

// Santa's sleigh is shared by the snowy and the Australian Christmas.
const SLEIGH_BACK = `
    <path fill="#8b5a2b" d="M30 92 C22 62 34 34 58 30 C82 28 96 50 92 92 Z"/>
    <g transform="rotate(-12 50 30)"><rect fill="#2e7d32" x="40" y="20" width="20" height="16" rx="2"/>
      <path class="ns" fill="#f4c542" d="M48 20 L52 20 L52 36 L48 36 Z"/></g>
    <g transform="rotate(10 68 24)"><rect fill="#1e88e5" x="60" y="14" width="16" height="18" rx="2"/>
      <path class="ns" fill="#ffffff" d="M60 21 L76 21 L76 25 L60 25 Z"/></g>
    <path class="ln" style="stroke:#5d3a1e;stroke-width:3" d="M38 42 C52 46 70 46 86 40"/>
    <g class="wave"><path fill="#d62828" d="M104 66 C96 58 92 48 92 40 L100 38 C101 46 104 54 110 60 Z"/>
      <circle fill="#262626" cx="95" cy="35" r="5.5"/></g>
    <path fill="#d62828" d="M94 96 C92 70 102 56 118 56 C134 56 142 70 140 96 Z"/>
    <path class="ns" fill="#ffffff" d="M126 58 L132 59 L135 96 L129 96 Z"/>
    <rect fill="#262626" x="95" y="80" width="45" height="7"/>
    <rect fill="#f4c542" x="118" y="79" width="9" height="9" rx="1.5"/>`;

const SLEIGH_FRONT = (reinsTo) => `
    <path fill="#d62828" d="M126 64 C138 62 150 64 157 69 L154 77 C146 73 138 72 130 74 Z"/>
    <circle fill="#262626" cx="158" cy="73" r="5.5"/>
    <path class="ln" style="stroke:#5d3a1e;stroke-width:1.8" d="M161 73 C230 70 320 68 ${reinsTo}"/>
    <path fill="#c1272d" d="M16 70 C16 63 23 61 29 65 L40 90 L150 90 C160 90 166 84 168 74 C170 63 179 58 187 62 C194 66 192 75 185 77 C179 79 176 73 181 71 C175 73 175 81 173 92 C171 113 160 128 140 130 L44 130 C28 130 18 120 18 104 Z"/>
    <path class="ln" style="stroke:#f4c542;stroke-width:3" d="M23 104 L170 104"/>
    <path class="ln" style="stroke:#f4c542;stroke-width:2.5" d="M58 117 C62 110 73 110 75 116 C77 122 69 124 67 119 M120 117 C124 110 135 110 137 116 C139 122 131 124 129 119"/>
    <path class="ln" style="stroke:#e0b13d;stroke-width:3.5" d="M52 130 L48 148 M136 130 L140 148"/>
    <path class="ln" style="stroke:#e0b13d;stroke-width:4.5" d="M8 148 L176 148 C192 148 200 138 197 128 C195 120 186 118 183 125"/>`;

function sleighSvg() {
  return `${svgOpen("sleigh", [0, -40, 560, 210])}
    ${sparkle(4, 128, 0.7, "#ffe082", 0)}${sparkle(-14, 104, 0.5, "#ffffff", 0.3)}
    ${sparkle(20, 156, 0.45, "#ffe082", 0.55)}${sparkle(-28, 140, 0.6, "#ffffff", 0.15)}
    <path class="ln" style="stroke:#5d3a1e;stroke-width:2" d="M182 100 C250 104 340 92 476 64"/>
    ${reindeer(222, 46, 0)}${reindeer(312, 36, 0.15)}${reindeer(402, 26, 0.3)}
    ${SLEIGH_BACK}
    <circle fill="#f6c7a1" cx="120" cy="44" r="12"/>
    <path fill="#ffffff" d="M107 44 C104 58 112 69 121 69 C130 69 137 58 133 44 C128 52 112 52 107 44 Z"/>
    <path class="ns" fill="#ffffff" d="M114 51 C118 47 123 47 128 51 C123 54 118 54 114 51 Z"/>
    <circle class="ns" fill="#f19a8a" opacity="0.7" cx="129" cy="46" r="2.6"/>
    <circle fill="#e8998d" cx="127" cy="47" r="2.6"/>
    <circle class="ns" fill="#262626" cx="124" cy="40" r="1.6"/>
    <path fill="#d62828" d="M107 37 C104 24 96 18 86 20 C96 12 118 12 129 22 C132 26 133 31 132 37 Z"/>
    <rect fill="#ffffff" x="105" y="33" width="30" height="8" rx="4"/>
    <circle fill="#ffffff" cx="86" cy="21" r="5"/>
    ${SLEIGH_FRONT("468 64")}
    ${speech(66, -40, 118, "Ho ho ho!", "#c62828")}
  </svg>`;
}

function reindeerSvg() {
  return `${svgOpen("reindeer", [0, -18, 100, 90])}
    ${sparkle(2, 52, 0.45, "#ffe082", 0)}${sparkle(-8, 40, 0.35, "#ffffff", 0.4)}
    ${reindeer(4, 4, 0)}
  </svg>`;
}

function elfSvg() {
  const leg = (x, offset) => `<g class="leg swing" style="${delayed(offset)}">
      <path fill="#ffffff" d="M${x} 104 L${x + 8} 104 L${x + 8} 132 L${x} 132 Z"/>
      <path class="ns" fill="#d32f2f" d="M${x} 110 L${x + 8} 110 L${x + 8} 115 L${x} 115 Z M${x} 121 L${x + 8} 121 L${x + 8} 126 L${x} 126 Z"/>
      <path fill="#2e7d32" d="M${x - 2} 130 L${x + 10} 130 C${x + 18} 130 ${x + 22} 126 ${x + 26} 120 C${x + 26} 130 ${x + 18} 138 ${x + 8} 138 L${x - 2} 138 Z"/>
    </g>`;
  return `${svgOpen("elf", [0, 0, 110, 150])}
    ${leg(42, 0.5)}
    <g class="arm swing-small"><path fill="#1b5e20" d="M44 70 C38 80 36 90 38 98 L44 98 C44 90 46 82 50 74 Z"/>
      <circle fill="#f6c7a1" cx="41" cy="100" r="4"/></g>
    ${leg(53, 0)}
    <path fill="#2e7d32" d="M30 104 C30 82 40 66 52 66 C64 66 74 82 74 104 L69 112 L63 104 L57 112 L51 104 L45 112 L39 104 L33 112 Z"/>
    <rect fill="#262626" x="31" y="90" width="43" height="6"/>
    <rect fill="#f4c542" x="49" y="89" width="8" height="8" rx="1.5"/>
    <path fill="#d32f2f" d="M40 70 L46 76 L52 70 L58 76 L64 70 C60 66 44 66 40 70 Z"/>
    <path fill="#f6c7a1" d="M41 50 L27 41 L40 58 Z"/>
    <circle fill="#f6c7a1" cx="54" cy="52" r="15"/>
    <circle class="ns" fill="#262626" cx="61" cy="49" r="1.9"/>
    <circle class="ns" fill="#f19a8a" opacity="0.7" cx="62" cy="56" r="3"/>
    <circle fill="#eaa98a" cx="68" cy="53" r="2.4"/>
    <path class="ln" style="stroke:#7a3b2e;stroke-width:1.5" d="M58 60 C61 63 65 62 67 59"/>
    <path fill="#2e7d32" d="M39 44 C38 30 30 18 14 14 C26 8 50 14 62 28 C66 33 68 38 69 44 Z"/>
    <path fill="#d32f2f" d="M37 40 C46 35 62 35 71 40 L71 47 C62 42 46 42 37 47 Z"/>
    <circle fill="#f4c542" cx="14" cy="14" r="4"/>
    <g class="carry">
      <rect fill="#d32f2f" x="66" y="72" width="28" height="24" rx="2"/>
      <path class="ns" fill="#f4c542" d="M78 72 L82 72 L82 96 L78 96 Z M66 82 L94 82 L94 86 L66 86 Z"/>
      <path fill="#f4c542" d="M80 72 C74 63 67 66 72 72 Z M80 72 C86 63 93 66 88 72 Z"/>
      <path fill="#2e7d32" d="M54 72 C60 78 64 82 68 84 L66 90 C60 88 54 84 50 78 Z"/>
      <circle fill="#f6c7a1" cx="68" cy="87" r="4.5"/>
    </g>
  </svg>`;
}

const CHRISTMAS_CSS = `
.wave { transform-box: fill-box; transform-origin: 90% 95%; animation: wave calc(var(--cycle) * 1.4) ease-in-out infinite; }
.carry { transform-box: fill-box; transform-origin: 0 50%; animation: swing-tiny var(--cycle) ease-in-out infinite; }
@keyframes wave { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(16deg); } }
`;

/* ---- Australian Christmas ----------------------------------------------- */

// Santa's head on its own, for the summer outfits. Centred on the face.
function santaHead(x, y, { sunnies = false, zinc = false } = {}) {
  const eyes = sunnies
    ? `<path fill="#1a1a1a" d="M-3 -7 L13 -7 L12 -2 C10 0 7 -0.5 6 -3 C5 -0.5 2 0 0 -2 Z"/>
       <path class="ln" style="stroke:#1a1a1a;stroke-width:1.4" d="M-3 -6 L-11 -4"/>
       <path class="ln" style="stroke:#90caf9;stroke-width:1" d="M1 -5.5 L4 -5.5 M8 -5.5 L11 -5.5"/>`
    : `<circle class="ns" fill="#262626" cx="4" cy="-4" r="1.6"/>`;
  const nose = zinc
    ? `<circle fill="#ffffff" cx="7" cy="3" r="2.9"/><path class="ns" fill="#ffffff" d="M9 -1 L13 0 L13 2 L9 1 Z"/>`
    : `<circle fill="#e8998d" cx="7" cy="3" r="2.6"/>`;
  return `<g transform="translate(${x} ${y})">
    <circle fill="#f6c7a1" cx="0" cy="0" r="12"/>
    <path fill="#ffffff" d="M-13 0 C-16 14 -8 25 1 25 C10 25 17 14 13 0 C8 8 -8 8 -13 0 Z"/>
    <path class="ns" fill="#ffffff" d="M-6 7 C-2 3 3 3 8 7 C3 10 -2 10 -6 7 Z"/>
    <circle class="ns" fill="#f19a8a" opacity="0.7" cx="9" cy="2" r="2.6"/>
    ${nose}${eyes}
    <path fill="#d62828" d="M-13 -7 C-16 -20 -24 -26 -34 -24 C-24 -32 -2 -32 9 -22 C12 -18 13 -13 12 -7 Z"/>
    <rect fill="#ffffff" x="-15" y="-11" width="30" height="8" rx="4"/>
    <circle fill="#ffffff" cx="-34" cy="-23" r="5"/>
  </g>`;
}

function kangaroo(x, y, phase = 0, hat = false) {
  const d = delayed(phase);
  return `<g transform="translate(${x} ${y})"><g class="roo" style="${d}">
    <path fill="#b8763d" d="M26 46 C14 50 2 60 -8 70 C6 66 18 60 30 56 Z"/>
    <path fill="#c8874a" d="M24 48 C22 34 34 22 50 20 C62 19 70 26 68 38 C66 50 54 58 40 58 C31 58 25 55 24 48 Z"/>
    <path class="ns" fill="#eac08a" d="M46 38 C56 40 63 46 61 54 C55 58 47 58 41 56 C47 52 50 45 46 38 Z"/>
    <path fill="#b8763d" d="M67 11 C63 1 63 -6 67 -8 C71 -4 71 4 71 11 Z"/>
    <path fill="#c8874a" d="M56 26 C58 15 66 8 75 8 C83 8 89 12 92 16 C90 20 84 22 78 22 C72 23 67 27 64 32 Z"/>
    <path fill="#c8874a" d="M73 9 C71 -1 73 -7 77 -8 C80 -3 78 4 76 10 Z"/>
    <circle fill="#3a2418" cx="91.5" cy="15" r="2"/>
    <circle class="ns" fill="#1b120c" cx="79" cy="12" r="1.6"/>
    <path class="ln" style="stroke:#b8763d;stroke-width:3.5" d="M60 36 C66 40 69 44 70 49"/>
    <path class="ln" style="stroke:#c62828;stroke-width:4" d="M58 28 C61 32 65 34 69 33"/>
    <circle fill="#f4c542" cx="65" cy="35" r="2.4"/>
    ${hat ? `<path fill="#d62828" d="M70 8 C70 -2 78 -8 87 -5 C83 -3 80 2 81 8 Z"/>
      <rect fill="#ffffff" x="68" y="6" width="15" height="5" rx="2.5"/><circle fill="#ffffff" cx="88" cy="-5" r="3"/>` : ""}
    <g class="roo-leg" style="${d}">
      <path fill="#b8763d" d="M30 44 C24 54 28 64 40 66 C46 60 47 52 43 45 Z"/>
      <path fill="#b8763d" d="M35 63 L62 69 C65 71 63 74 58 74 L33 70 Z"/>
    </g>
  </g></g>`;
}

function kangaroosSvg() {
  return `${svgOpen("kangaroos", [0, -40, 560, 210])}
    ${sparkle(4, 128, 0.7, "#ffe082", 0)}${sparkle(-14, 104, 0.5, "#ffffff", 0.3)}
    ${sparkle(20, 156, 0.45, "#ffe082", 0.55)}
    <path class="ln" style="stroke:#5d3a1e;stroke-width:2" d="M182 100 C250 104 340 94 470 70"/>
    ${kangaroo(226, 50, 0)}${kangaroo(318, 40, 0.33)}${kangaroo(410, 30, 0.66, true)}
    ${SLEIGH_BACK}
    ${santaHead(120, 44, { sunnies: true })}
    ${SLEIGH_FRONT("470 62")}
    ${speech(72, -40, 96, "G'day!", "#00843d")}
  </svg>`;
}

function surfingSvg() {
  return `${svgOpen("surfing", [0, -10, 200, 180])}
    <path class="ns" fill="#4fc3f7" d="M0 170 L0 128 C28 112 58 108 88 114 C126 122 156 108 174 88 C186 74 198 76 196 90 C194 104 180 116 170 126 C190 124 200 134 200 146 L200 170 Z"/>
    <path class="ns" fill="#81d4fa" d="M174 88 C180 82 190 80 192 88 C188 96 180 102 172 104 C176 98 178 94 174 88 Z"/>
    <path class="ns" fill="#0288d1" d="M0 170 L0 150 C40 142 80 146 120 150 C150 152 180 146 200 150 L200 170 Z"/>
    <path class="ln foam" style="stroke:#ffffff;stroke-width:4" d="M84 114 C122 122 154 108 172 88 C182 76 194 76 194 86"/>
    <path class="ln foam" style="stroke:#e1f5fe;stroke-width:2.5" d="M10 146 C30 140 50 142 70 146 M120 148 C140 144 160 144 180 148"/>
    ${sparkle(198, 74, 0.5, "#ffffff", 0)}${sparkle(186, 62, 0.35, "#ffffff", 0.4)}
    <g class="rider">
      <path fill="#ffca28" d="M38 128 C70 118 140 112 178 116 C186 117 186 123 178 124 C140 130 80 134 46 136 C36 136 32 131 38 128 Z"/>
      <path class="ns" fill="#e53935" d="M60 128 C90 122 140 118 170 119 L170 121.5 C140 122 92 126 62 131 Z"/>
      <path fill="#f6c7a1" d="M92 96 L98 98 L86 124 L79 122 Z"/>
      <path fill="#f6c7a1" d="M108 96 L114 94 L127 118 L121 121 Z"/>
      <path fill="#d62828" d="M88 86 C84 70 88 54 102 52 C116 50 124 64 118 86 Z"/>
      <path class="ns" fill="#ffffff" d="M95 54 C99 58 105 58 109 53 L111 55 C106 61 99 61 93 56 Z"/>
      <path fill="#d62828" d="M86 84 L118 84 L120 100 L106 102 L102 94 L98 102 L84 100 Z"/>
      <path class="ns" fill="#ffffff" d="M86 84 L118 84 L118 88 L86 88 Z"/>
      <circle class="ns" fill="#ffeb3b" cx="92" cy="95" r="2"/><circle class="ns" fill="#ffeb3b" cx="113" cy="94" r="2"/>
      <path class="ln" style="stroke:#f6c7a1;stroke-width:7" d="M92 62 C80 60 70 54 62 48"/>
      <circle fill="#f6c7a1" cx="60" cy="47" r="4.5"/>
      <path class="ln" style="stroke:#f6c7a1;stroke-width:7" d="M112 62 C124 64 136 60 146 52"/>
      <circle fill="#f6c7a1" cx="148" cy="51" r="4.5"/>
      ${santaHead(104, 38, { sunnies: true })}
    </g>
  </svg>`;
}

function cricketSvg() {
  const leg = (x, offset) => `<g class="leg swing" style="${delayed(offset)}">
      <path fill="#ffffff" d="M${x} 102 L${x + 12} 102 L${x + 12} 134 L${x} 134 Z"/>
      <path class="ln" style="stroke:#cfd8dc;stroke-width:1.2" d="M${x + 4} 105 L${x + 4} 131 M${x + 8} 105 L${x + 8} 131"/>
      <path fill="#ffffff" d="M${x - 2} 132 L${x + 14} 132 C${x + 20} 132 ${x + 22} 136 ${x + 20} 140 L${x - 2} 140 Z"/>
    </g>`;
  return `${svgOpen("cricket", [0, -40, 130, 200])}
    ${leg(40, 0.5)}
    <path fill="#d62828" d="M34 104 C32 80 40 64 54 64 C68 64 76 80 74 104 Z"/>
    <path class="ns" fill="#ffffff" d="M34 99 L74 99 L74 105 L34 105 Z"/>
    <rect fill="#262626" x="35" y="86" width="39" height="6"/>
    <rect fill="#f4c542" x="51" y="85" width="8" height="8" rx="1.5"/>
    ${leg(54, 0)}
    ${santaHead(58, 50, { zinc: true })}
    <g class="carry">
      <path fill="#e8c58a" d="M76 70 L85 66 L108 114 L99 118 Z"/>
      <path class="ln" style="stroke:#c9a265;stroke-width:1" d="M82 72 L102 114"/>
      <path fill="#37474f" d="M68 57 L74 54 L81 68 L75 71 Z"/>
      <path fill="#d62828" d="M46 70 C55 72 63 70 69 63 L74 70 C66 77 57 81 46 79 Z"/>
      <circle fill="#ffffff" cx="71" cy="62" r="5"/><circle fill="#ffffff" cx="76" cy="69" r="5"/>
    </g>
    ${speech(52, -40, 96, "Yes! Run!", "#00843d")}
  </svg>`;
}

function coolReindeerSvg() {
  return `${svgOpen("coolreindeer", [0, -34, 124, 112])}
    ${reindeer(4, 4, 0, "swing-small")}
    <g transform="translate(4 4)">
      <path fill="#1a1a1a" d="M74 7 L86 7 L85 12 C83 14 80 13 79 11 C78 13 76 13 75 11 Z"/>
      <path class="ln" style="stroke:#1a1a1a;stroke-width:1.3" d="M74 8 L69 9"/>
      <circle fill="#ffffff" cx="90.5" cy="14.5" r="2.6"/>
      <path class="ln" style="stroke:#78909c;stroke-width:2.2" d="M76 4 C82 -6 92 -12 100 -14"/>
      <circle fill="#eceff1" cx="106" cy="-18" r="10"/>
      <g class="spin"><path class="ns" fill="#4fc3f7" d="M106 -18 C102 -26 106 -28 108 -26 Z M106 -18 C114 -20 114 -16 112 -14 Z M106 -18 C102 -12 100 -14 100 -16 Z"/></g>
      <circle class="ns" fill="#78909c" cx="106" cy="-18" r="2"/>
      <path class="ln breeze" style="stroke:#81d4fa;stroke-width:1.6" d="M96 -12 C92 -10 94 -6 90 -4 M98 -6 C94 -3 96 0 92 2"/>
      <path class="ns drip" fill="#4fc3f7" d="M66 16 C64 20 66 22 68 22 C70 22 71 20 68 16 Z"/>
      <path class="ns drip" style="animation-delay:-0.45s" fill="#4fc3f7" d="M60 22 C58 26 60 28 62 28 C64 28 65 26 62 22 Z"/>
    </g>
  </svg>`;
}

function floatieSvg() {
  return `${svgOpen("floatie", [0, -10, 190, 130])}
    <ellipse fill="#f06292" cx="95" cy="96" rx="72" ry="20"/>
    <ellipse class="ns" fill="#c2185b" cx="95" cy="92" rx="44" ry="9"/>
    <path fill="#f06292" d="M150 94 C166 78 164 52 154 40 C148 32 152 20 162 22 C170 24 172 32 166 37 C164 39 160 39 159 37 C166 52 172 76 164 98 Z"/>
    <path fill="#212121" d="M168 27 L178 32 L169 36 Z"/>
    <circle class="ns" fill="#212121" cx="162" cy="28" r="1.7"/>
    <path fill="#d62828" d="M60 90 C52 74 58 60 72 58 C88 56 100 68 104 90 Z"/>
    <path fill="#f6c7a1" d="M112 78 L136 66 L140 73 L117 86 Z"/>
    <path fill="#d62828" d="M96 80 L117 73 L121 84 L102 92 Z"/>
    <path fill="#29b6f6" d="M135 61 L148 59 L150 66 L138 70 Z"/>
    <path class="ln" style="stroke:#f6c7a1;stroke-width:6" d="M80 66 C86 58 89 52 91 45"/>
    <circle fill="#f6c7a1" cx="92" cy="43" r="4"/>
    <path fill="#e1f5fe" d="M86 22 L98 22 L95 41 L89 41 Z"/>
    <path class="ns" fill="#ffb74d" d="M87 28 L97 28 L95 41 L89 41 Z"/>
    <path class="ln" style="stroke:#e53935;stroke-width:1.8" d="M93 30 L99 12"/>
    <path fill="#ab47bc" d="M86 17 C90 9 101 9 105 15 Z"/>
    ${santaHead(66, 48, { sunnies: true })}
    <path fill="#f06292" d="M23 94 C24 106 56 116 95 116 C134 116 166 106 167 94 C156 102 128 106 95 106 C62 106 34 102 23 94 Z"/>
    <path class="ns" fill="#ffffff" opacity="0.85" d="M44 103 L54 106 L52 113 L42 109 Z M90 106 L100 106 L100 116 L90 116 Z M136 106 L146 103 L148 109 L138 113 Z"/>
  </svg>`;
}

function snowflake(x, y, s, delay) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path class="ln blow" style="stroke:#4fc3f7;stroke-width:1.8;animation-delay:${delay}s" d="M0 -5 L0 5 M-4.3 -2.5 L4.3 2.5 M-4.3 2.5 L4.3 -2.5"/></g>`;
}

function airconSvg() {
  const cloud = "stroke:#b0c4d8;stroke-width:1.4";
  const unit = "stroke:#90a4ae;stroke-width:1.4";
  return `${svgOpen("aircon", [0, -40, 230, 170])}
    <path fill="#ffffff" style="${cloud}" d="M20 118 C6 118 4 100 18 98 C16 84 34 78 44 86 C50 72 72 72 78 86 C86 76 104 78 108 90 C116 80 136 82 140 94 C150 84 170 86 172 98 C184 90 202 94 202 106 C216 106 220 122 206 124 L24 124 C18 124 16 120 20 118 Z"/>
    <path class="ns" fill="#eaf2fb" d="M24 118 L206 118 C204 121 205 123 206 124 L24 124 Z"/>
    <path class="ln" style="stroke:#8d6e63;stroke-width:3" d="M38 108 L72 52 M60 108 L90 86 M46 92 L98 94"/>
    <path fill="#42a5f5" d="M58 38 L80 40 C76 58 70 76 66 96 L42 96 C46 76 52 56 58 38 Z"/>
    <path class="ns" fill="#ffffff" d="M56 46 L78 48 L77 54 L54 52 Z M52 62 L74 64 L72 70 L50 68 Z M47 78 L70 80 L69 86 L45 84 Z"/>
    <path fill="#d62828" d="M60 90 C56 74 62 62 74 62 C86 62 90 76 88 92 Z"/>
    <path fill="#f6c7a1" d="M104 84 L126 94 L122 100 L101 92 Z"/>
    <path fill="#d62828" d="M84 84 L106 82 L108 94 L86 96 Z"/>
    <path fill="#29b6f6" d="M124 92 L134 98 L131 103 L120 98 Z"/>
    <path class="ln" style="stroke:#f6c7a1;stroke-width:6" d="M66 74 C58 80 56 86 60 90"/>
    <path class="ln" style="stroke:#f6c7a1;stroke-width:6" d="M80 72 C88 70 94 66 96 60"/>
    <circle fill="#f6c7a1" cx="97" cy="57" r="4"/>
    <path fill="#e1f5fe" d="M92 38 L103 38 L101 55 L94 55 Z"/>
    <path class="ns" fill="#ef5350" d="M93 43 L102 43 L101 55 L94 55 Z"/>
    <path class="ln" style="stroke:#ffffff;stroke-width:1.6" d="M99 44 L104 28"/>
    ${santaHead(72, 48, { sunnies: true })}
    <path class="ln" style="stroke:#90a4ae;stroke-width:4" d="M184 118 L184 62 M172 120 L196 120"/>
    <rect fill="#ffffff" style="${unit}" x="140" y="26" width="80" height="36" rx="9"/>
    <path class="ln" style="stroke:#cfd8dc;stroke-width:1.2" d="M146 34 L190 34"/>
    <path fill="#eceff1" style="${unit}" d="M144 50 L216 50 L212 60 C210 61 150 61 148 60 Z"/>
    <path class="ln" style="stroke:#90a4ae;stroke-width:1.2" d="M150 54 L210 54 M152 57 L208 57"/>
    <rect class="ns" fill="#263238" x="196" y="31" width="18" height="10" rx="2"/>
    <text x="205" y="39" text-anchor="middle" font-size="8" font-weight="700" fill="#69f0ae">18°</text>
    <circle class="ns" fill="#69f0ae" cx="190" cy="36" r="1.5"/>
    <path class="ln blow" style="stroke:#29b6f6;stroke-width:2.4" d="M146 64 C136 68 138 74 128 78 C120 82 122 88 112 90"/>
    <path class="ln blow" style="stroke:#4fc3f7;stroke-width:2.2;animation-delay:-0.4s" d="M150 68 C140 74 142 80 132 84"/>
    <path class="ln blow" style="stroke:#29b6f6;stroke-width:2.2;animation-delay:-0.8s" d="M142 58 C132 58 130 64 120 64 C112 64 110 70 102 70"/>
    ${snowflake(134, 70, 1, 0)}${snowflake(118, 60, 0.8, -0.35)}${snowflake(124, 86, 0.7, -0.7)}${snowflake(108, 76, 0.9, -1.0)}
    ${speech(10, -40, 124, "Ahhh, bliss!", "#0277bd")}
  </svg>`;
}

const AUSSIE_CSS = `${CHRISTMAS_CSS}
.blow { animation: blow 1.2s linear infinite; }
@keyframes blow { 0% { opacity: 0; transform: translateX(0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateX(-34px); } }
.roo { animation: roo-hop var(--cycle) ease-in-out infinite; }
.roo-leg { transform-box: fill-box; transform-origin: 30% 10%; animation: roo-kick var(--cycle) ease-in-out infinite; }
.rider { transform-box: fill-box; transform-origin: 50% 100%; animation: rock calc(var(--cycle) * 2) ease-in-out infinite; }
.foam { animation: flicker 0.6s ease-in-out infinite; }
.spin { transform-box: fill-box; transform-origin: center; animation: spin 0.25s linear infinite; }
.breeze { animation: breeze 0.6s linear infinite; }
.drip { animation: drip 0.9s ease-in infinite; }
@keyframes roo-hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes roo-kick { 0%, 100% { transform: rotate(6deg); } 50% { transform: rotate(-22deg); } }
@keyframes rock { 0%, 100% { transform: rotate(-3deg) translateY(1px); } 50% { transform: rotate(3deg) translateY(-3px); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes breeze { 0% { opacity: 0; transform: translateX(4px); } 40% { opacity: 0.9; } 100% { opacity: 0; transform: translateX(-8px); } }
@keyframes drip { 0% { opacity: 0; transform: translateY(-2px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(10px); } }
`;

/* ---- Halloween ---------------------------------------------------------- */

function witchSvg() {
  return `${svgOpen("witch", [0, -20, 300, 180])}
    ${sparkle(0, 104, 0.6, "#b388ff", 0)}${sparkle(-16, 124, 0.45, "#76ff03", 0.35)}
    ${sparkle(-6, 90, 0.35, "#b388ff", 0.6)}
    <path fill="#c9953e" d="M66 110 C46 100 22 96 4 100 C14 108 14 120 6 130 C24 132 48 128 68 122 Z"/>
    <path class="ln" style="stroke:#9a6b25;stroke-width:1.2" d="M60 112 L14 105 M62 116 L10 116 M60 120 L14 127"/>
    <path fill="#7b4a24" d="M61 106 L71 105 L72 123 L62 124 Z"/>
    <path class="ln" style="stroke:#6b4423;stroke-width:6" d="M66 116 L288 96"/>
    <path class="ln tailcat" style="stroke:#1d1a22;stroke-width:3.5" d="M88 108 C76 106 72 96 78 90"/>
    <path fill="#1d1a22" d="M88 112 C84 100 88 88 98 86 C108 86 112 98 110 110 Z"/>
    <path fill="#1d1a22" d="M92 77 L91 65 L98 72 Z M100 72 L107 65 L106 77 Z"/>
    <circle fill="#1d1a22" cx="99" cy="80" r="9"/>
    <circle class="ns" fill="#ffd54a" cx="96" cy="79" r="1.8"/><circle class="ns" fill="#ffd54a" cx="103" cy="79" r="1.8"/>
    <g class="cape"><path fill="#6a1b9a" d="M142 64 C120 66 96 76 78 96 C90 94 98 98 104 106 C114 98 128 94 142 94 Z"/></g>
    <path fill="#ffffff" d="M168 104 L200 118 L196 127 L164 113 Z"/>
    <path class="ns" fill="#7b1fa2" d="M174 107 L180 109.6 L176 118.6 L170 116 Z M186 112.2 L192 114.8 L188 123.8 L182 121.2 Z"/>
    <path fill="#1d1a22" d="M196 116 L208 121 C216 124 220 120 222 115 C223 124 216 130 206 130 L194 128 Z"/>
    <path fill="#1d1a22" d="M132 58 C126 76 128 98 136 116 L178 116 C180 106 176 96 170 88 C168 76 166 66 160 58 Z"/>
    <g class="hair"><path fill="#ff7043" d="M140 40 C126 40 112 48 100 60 C114 56 126 58 136 60 C130 66 124 72 116 76 C130 74 140 68 146 58 Z"/></g>
    <path fill="#8bc34a" d="M138 44 C138 34 146 28 154 28 C164 28 170 36 169 46 C168 56 160 62 152 62 C144 62 138 54 138 44 Z"/>
    <path fill="#8bc34a" d="M164 41 L181 50 L164 51 Z"/>
    <circle class="ns" fill="#689f38" cx="172" cy="47.5" r="1.4"/>
    <circle class="ns" fill="#1d1a22" cx="160" cy="40" r="2"/>
    <path class="ln" style="stroke:#1d1a22;stroke-width:1.6" d="M156 35 L164 37 M156 54 C160 57 164 56 166 52"/>
    <path fill="#1d1a22" d="M150 66 C164 72 178 82 188 92 L182 99 C172 92 160 84 148 78 Z"/>
    <circle fill="#8bc34a" cx="187" cy="97" r="5"/>
    <ellipse fill="#1d1a22" cx="153" cy="31" rx="27" ry="5.5" transform="rotate(-6 153 31)"/>
    <path fill="#1d1a22" d="M138 30 C142 16 140 2 126 -10 C146 -4 160 12 168 28 Z"/>
    <path class="ns" fill="#7b1fa2" d="M139 25 C148 23 158 22 166 23 L167 27 C158 26 148 27 138 29 Z"/>
    <rect class="ns" fill="#f4c542" x="150" y="22.5" width="6" height="5"/>
  </svg>`;
}

function bat(x, y, s, delay) {
  const wd = `animation-delay:${delay}s`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="bat" style="${wd}">
    <g class="wing-l" style="${wd}"><path fill="#3a2d4a" d="M-5 -2 C-14 -14 -30 -16 -42 -10 C-36 -5 -34 1 -36 6 C-29 2 -23 4 -21 9 C-16 4 -10 4 -6 6 Z"/></g>
    <g class="wing-r" style="${wd}"><path fill="#3a2d4a" d="M5 -2 C14 -14 30 -16 42 -10 C36 -5 34 1 36 6 C29 2 23 4 21 9 C16 4 10 4 6 6 Z"/></g>
    <path fill="#2b2136" d="M-6 -8 L-7 -18 L-2 -11 L2 -11 L7 -18 L6 -8 C8 0 6 10 0 12 C-6 10 -8 0 -6 -8 Z"/>
    <circle class="ns" fill="#ffcc33" cx="-2.6" cy="-6" r="1.6"/><circle class="ns" fill="#ffcc33" cx="2.6" cy="-6" r="1.6"/>
    <path class="ns" fill="#ffffff" d="M-2.4 -1 L-1.4 2.2 L-0.4 -1 Z M0.4 -1 L1.4 2.2 L2.4 -1 Z"/>
  </g></g>`;
}

function batsSvg() {
  return `${svgOpen("bats", [0, 0, 260, 160])}
    ${bat(50, 70, 1.1, 0)}${bat(118, 34, 0.8, -0.13)}${bat(176, 88, 1.2, -0.3)}
    ${bat(226, 44, 0.75, -0.5)}${bat(96, 122, 0.7, -0.21)}
  </svg>`;
}

function ghostSvg() {
  return `${svgOpen("ghost", [0, -34, 150, 204])}
    <g class="ghost">
      <path fill="#f7f8ff" d="M26 84 C12 80 4 70 6 60 C12 66 20 70 28 72 Z"/>
      <path fill="#f7f8ff" d="M124 84 C138 80 146 70 144 60 C138 66 130 70 122 72 Z"/>
      <path fill="#f7f8ff" d="M24 92 C24 42 46 16 75 16 C104 16 126 42 126 92 L126 152 C118 144 110 144 104 154 C98 164 90 164 86 154 C80 144 70 144 64 154 C58 164 50 164 46 154 C40 144 32 144 24 152 Z"/>
      <path class="ns" fill="#e3e7f7" d="M100 30 C116 42 122 62 122 92 L122 146 C116 142 112 142 108 146 L108 92 C108 62 106 44 100 30 Z"/>
      <ellipse class="ns" fill="#1d1a2a" cx="60" cy="72" rx="7" ry="10"/><ellipse class="ns" fill="#1d1a2a" cx="90" cy="72" rx="7" ry="10"/>
      <circle class="ns" fill="#ffffff" cx="62" cy="68" r="2.3"/><circle class="ns" fill="#ffffff" cx="92" cy="68" r="2.3"/>
      <ellipse class="ns" fill="#1d1a2a" cx="75" cy="100" rx="7" ry="9"/>
      <ellipse class="ns" fill="#f8a5c2" opacity="0.6" cx="46" cy="88" rx="6" ry="3.5"/><ellipse class="ns" fill="#f8a5c2" opacity="0.6" cx="104" cy="88" rx="6" ry="3.5"/>
    </g>
    ${speech(86, -34, 64, "BOO!", "#5b2a86")}
  </svg>`;
}

function skeletonSvg() {
  const bone = (d, w = 6) =>
    `<path class="ln" style="stroke:#2f3440;stroke-width:${w + 3}" d="${d}"/>` +
    `<path class="ln" style="stroke:#f5f1e6;stroke-width:${w}" d="${d}"/>`;
  const leg = (x, offset) => `<g class="leg swing" style="${delayed(offset)}">
      ${bone(`M${x} 106 L${x} 136`)}
      <g class="shin" style="${delayed(offset)}">${bone(`M${x} 136 L${x} 164`)}${bone(`M${x} 165 L${x + 11} 166`, 5)}</g>
    </g>`;
  const arm = (offset) => `<g class="arm swing-small" style="${delayed(offset)}">
      ${bone("M52 66 L50 88", 5)}${bone("M50 88 L54 108", 5)}
      <circle fill="#f5f1e6" style="stroke:#2f3440;stroke-width:1.5" cx="54" cy="110" r="3.5"/>
    </g>`;
  return `${svgOpen("skeleton", [0, 0, 120, 185])}
    ${leg(54, 0.5)}${arm(0)}
    ${bone("M55 58 L54 64", 5)}${bone("M54 62 L56 104", 5)}
    ${bone("M55 67 C70 65 74 76 62 80", 4)}${bone("M55 75 C70 74 73 85 62 88", 4)}${bone("M55 83 C68 83 70 91 62 94", 4)}
    <path fill="#f5f1e6" style="stroke:#2f3440;stroke-width:1.6" d="M45 101 C45 95 66 95 68 101 C68 109 60 113 56 113 C50 113 45 109 45 101 Z"/>
    ${leg(57, 0)}${arm(0.5)}
    <g class="skull">
      <path fill="#f5f1e6" style="stroke:#2f3440;stroke-width:2" d="M38 34 C38 18 50 10 60 10 C74 10 82 20 80 36 C80 42 76 46 72 48 L72 52 L52 52 L52 48 C44 46 38 42 38 34 Z"/>
      <ellipse class="ns" fill="#2f3440" cx="60" cy="31" rx="5.5" ry="6.5"/><ellipse class="ns" fill="#2f3440" cx="73" cy="32" rx="4.2" ry="6"/>
      <path class="ns" fill="#2f3440" d="M74 39 L77 45 L71 45 Z"/>
      <g class="jaw"><path fill="#f5f1e6" style="stroke:#2f3440;stroke-width:2" d="M52 50 L74 50 C76 56 72 60 64 60 C56 60 52 56 52 50 Z"/>
        <path class="ln" style="stroke:#2f3440;stroke-width:1.2" d="M58 50 L58 54 M63 50 L63 55 M68 50 L68 54"/></g>
    </g>
  </svg>`;
}

function pumpkinSvg() {
  return `${svgOpen("pumpkin", [0, 0, 120, 116])}
    <path fill="#e8730c" d="M14 68 C14 40 34 28 60 28 C86 28 106 40 106 68 C106 96 86 108 60 108 C34 108 14 96 14 68 Z"/>
    <path fill="#f28c1c" d="M24 68 C24 44 34 30 48 30 C40 40 38 54 38 68 C38 84 40 98 48 106 C34 104 24 90 24 68 Z"/>
    <path fill="#f28c1c" d="M96 68 C96 44 86 30 72 30 C80 40 82 54 82 68 C82 84 80 98 72 106 C86 104 96 90 96 68 Z"/>
    <path fill="#f79a2b" d="M44 68 C44 44 50 30 60 30 C70 30 76 44 76 68 C76 92 70 106 60 106 C50 106 44 92 44 68 Z"/>
    <path fill="#5d7a2a" d="M56 31 C55 21 58 13 66 9 C69 12 65 18 65 31 Z"/>
    <path class="ln" style="stroke:#5d7a2a;stroke-width:2.5" d="M64 22 C72 16 82 20 78 28"/>
    <g class="face">
      <path fill="#ffd54a" d="M36 58 L50 51 L48 65 Z"/><path fill="#ffd54a" d="M76 51 L90 58 L78 65 Z"/>
      <path fill="#ffd54a" d="M60 67 L66 67 L63 73 Z"/>
      <path fill="#ffd54a" d="M34 78 L42 82 L48 77 L54 83 L60 77 L66 83 L72 77 L78 83 L84 77 L92 78 C84 96 42 96 34 78 Z"/>
    </g>
  </svg>`;
}

const HALLOWEEN_CSS = `
.cape, .hair { transform-box: fill-box; transform-origin: 100% 0; animation: flutter calc(var(--cycle) * 0.8) ease-in-out infinite; }
.hair { animation-delay: -0.15s; }
.tailcat { transform-box: fill-box; transform-origin: 100% 100%; animation: swing-small calc(var(--cycle) * 2) ease-in-out infinite; }
.bat { animation: wobble 0.9s ease-in-out infinite alternate; }
.wing-l { transform-box: fill-box; transform-origin: 100% 30%; animation: bat-l 0.22s ease-in-out infinite; }
.wing-r { transform-box: fill-box; transform-origin: 0% 30%; animation: bat-r 0.22s ease-in-out infinite; }
.ghost { transform-box: fill-box; transform-origin: 50% 15%; animation: sway-soft calc(var(--cycle) * 2.5) ease-in-out infinite, flicker 1.3s ease-in-out infinite; }
.skeleton .leg, .skeleton .arm, .skeleton .shin { transform-box: fill-box; transform-origin: 0 0; }
.skeleton .shin { animation: bend var(--cycle) ease-in-out infinite; }
.skull { transform-box: fill-box; transform-origin: 40% 100%; animation: swing-tiny var(--cycle) ease-in-out infinite; }
.jaw { transform-box: fill-box; transform-origin: 0 0; animation: chatter 0.16s ease-in-out infinite alternate; }
.face { animation: flicker 0.45s ease-in-out infinite alternate; }
@keyframes flutter { 0%, 100% { transform: skewY(0deg) scaleX(1); } 50% { transform: skewY(-7deg) scaleX(1.07); } }
@keyframes bat-l { 0%, 100% { transform: rotate(28deg); } 50% { transform: rotate(-32deg); } }
@keyframes bat-r { 0%, 100% { transform: rotate(-28deg); } 50% { transform: rotate(32deg); } }
@keyframes sway-soft { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
@keyframes bend { 0%, 45%, 100% { transform: rotate(0deg); } 75% { transform: rotate(38deg); } }
@keyframes chatter { from { transform: rotate(0deg); } to { transform: rotate(9deg); } }
`;

/* ---- Easter ------------------------------------------------------------- */

function bunnySvg() {
  return `${svgOpen("bunny", [0, -20, 170, 180])}
    <g class="ear ear-far"><path fill="#e9e4dc" d="M100 40 C93 16 94 0 100 -6 C108 0 110 18 108 40 Z"/></g>
    <circle fill="#ffffff" cx="36" cy="104" r="12"/>
    <path fill="#f6f3ee" d="M38 112 C28 84 46 60 74 58 C102 56 120 78 118 106 C116 126 98 138 78 138 C58 138 44 128 38 112 Z"/>
    <path class="ns" fill="#ffffff" d="M84 76 C104 80 112 100 104 120 C98 130 86 134 78 132 C92 122 96 98 84 76 Z"/>
    <path fill="#f6f3ee" d="M50 130 C46 140 54 146 68 146 L98 146 C106 146 106 136 98 134 L64 128 Z"/>
    <path fill="#f6f3ee" d="M96 52 C94 36 106 26 120 26 C136 26 146 38 144 52 C142 64 132 70 120 70 C108 70 98 62 96 52 Z"/>
    <g class="ear"><path fill="#f6f3ee" d="M108 34 C100 10 102 -8 110 -14 C120 -8 122 12 118 34 Z"/>
      <path class="ns" fill="#f8bbd0" d="M110 30 C106 12 107 -2 111 -7 C115 -2 116 14 114 30 Z"/></g>
    <ellipse class="ns" fill="#2b2b2b" cx="127" cy="44" rx="3.2" ry="4"/>
    <circle class="ns" fill="#ffffff" cx="128" cy="42.5" r="1.2"/>
    <circle class="ns" fill="#f8bbd0" opacity="0.7" cx="132" cy="56" r="4"/>
    <path fill="#f48fb1" d="M141 51 C144 50 146 52 145 54 C143 56 141 55 141 51 Z"/>
    <path class="ln" style="stroke:#8d6e63;stroke-width:1.3" d="M143 56 C142 60 138 61 136 59"/>
    <path class="ln" style="stroke:#bdb5ab;stroke-width:1" d="M140 55 L156 52 M140 57 L156 60"/>
    <path fill="#42a5f5" d="M104 66 L95 60 L95 72 Z M104 66 L113 60 L113 72 Z"/>
    <circle fill="#1e88e5" cx="104" cy="66" r="3"/>
    <path class="ln" style="stroke:#8d5a2b;stroke-width:3.5" d="M118 96 C120 74 152 74 154 96"/>
    <ellipse fill="#f48fb1" cx="126" cy="94" rx="7" ry="9"/>
    <ellipse fill="#81d4fa" cx="138" cy="91" rx="7" ry="9.5"/>
    <ellipse fill="#fff176" cx="149" cy="95" rx="6.5" ry="8.5"/>
    <path class="ln" style="stroke:#ffffff;stroke-width:1.5" d="M131.5 92 L134.5 89 L137.5 92 L140.5 89 L143.5 92"/>
    <circle class="ns" fill="#ffffff" cx="124" cy="91" r="1.4"/><circle class="ns" fill="#ffffff" cx="128" cy="96" r="1.4"/>
    <path fill="#c48a48" d="M114 96 L158 96 L152 120 C150 124 146 126 142 126 L130 126 C126 126 122 124 120 120 Z"/>
    <path class="ln" style="stroke:#8d5a2b;stroke-width:1.2" d="M116 104 L156 104 M118 112 L154 112 M126 96 L128 126 M136 96 L136 126 M146 96 L144 126"/>
    <ellipse fill="#f6f3ee" cx="114" cy="100" rx="7" ry="6"/>
  </svg>`;
}

function chickSvg() {
  const leg = (x, offset) => `<g class="leg swing" style="${delayed(offset)}">
      <path class="ln" style="stroke:#f57c00;stroke-width:3" d="M${x} 82 L${x} 94 M${x} 94 L${x + 7} 95 M${x} 94 L${x + 5} 98"/></g>`;
  return `${svgOpen("chick", [0, 0, 100, 100])}
    ${leg(45, 0.5)}${leg(56, 0)}
    <g class="waddle">
      <path fill="#ffd93b" d="M21 52 L8 46 L16 59 Z"/>
      <path fill="#ffd93b" d="M18 58 C18 36 34 22 54 22 C74 22 86 38 84 58 C82 76 68 86 52 86 C34 86 18 76 18 58 Z"/>
      <g class="cwing"><path fill="#ffc400" d="M36 52 C26 56 26 70 36 74 C46 72 52 62 46 54 Z"/></g>
      <path fill="#fffdf6" d="M30 34 C32 16 46 6 60 8 C74 10 82 20 80 32 L74 27 L68 33 L62 26 L56 33 L50 27 L44 33 L38 28 Z"/>
      <circle class="ns" fill="#b3e5fc" cx="48" cy="18" r="2.5"/><circle class="ns" fill="#f8bbd0" cx="64" cy="16" r="2"/>
      <circle class="ns" fill="#2b2b2b" cx="66" cy="44" r="3"/><circle class="ns" fill="#ffffff" cx="67" cy="43" r="1"/>
      <path fill="#ff9800" d="M82 48 L96 52 L82 57 Z"/>
      <circle class="ns" fill="#ffab91" opacity="0.8" cx="70" cy="54" r="4"/>
    </g>
  </svg>`;
}

function butterfly(x, y, s, wingA, wingB, delay) {
  const d = `animation-delay:${delay}s`;
  return `<g transform="translate(${x} ${y}) rotate(62) scale(${s})"><g class="bfly" style="${d}">
    <g class="bw-l" style="${d}">
      <path fill="${wingA}" d="M-2 -3 C-12 -24 -36 -26 -34 -8 C-32 2 -16 3 -2 0 Z"/>
      <path fill="${wingB}" d="M-2 2 C-12 4 -28 12 -21 23 C-15 29 -4 19 -2 6 Z"/>
      <circle class="ns" fill="#ffffff" opacity="0.8" cx="-20" cy="-11" r="3.5"/>
    </g>
    <g class="bw-r" style="${d}">
      <path fill="${wingA}" d="M2 -3 C12 -24 36 -26 34 -8 C32 2 16 3 2 0 Z"/>
      <path fill="${wingB}" d="M2 2 C12 4 28 12 21 23 C15 29 4 19 2 6 Z"/>
      <circle class="ns" fill="#ffffff" opacity="0.8" cx="20" cy="-11" r="3.5"/>
    </g>
    <ellipse fill="#4e342e" cx="0" cy="2" rx="2.4" ry="12"/>
    <path class="ln" style="stroke:#4e342e;stroke-width:1.2" d="M-1 -9 C-4 -16 -8 -19 -10 -18 M1 -9 C4 -16 8 -19 10 -18"/>
  </g></g>`;
}

function butterfliesSvg() {
  return `${svgOpen("butterflies", [0, 0, 220, 140])}
    ${butterfly(56, 56, 1, "#f48fb1", "#ce93d8", 0)}
    ${butterfly(132, 98, 0.8, "#81d4fa", "#80cbc4", -0.25)}
    ${butterfly(184, 38, 0.65, "#fff176", "#ffcc80", -0.45)}
  </svg>`;
}

const EASTER_CSS = `
.ear { transform-box: fill-box; transform-origin: 50% 100%; animation: ear-flop var(--cycle) ease-in-out infinite; }
.ear-far { animation-delay: -0.05s; }
.waddle { transform-box: fill-box; transform-origin: 50% 100%; animation: swing-tiny var(--cycle) ease-in-out infinite; }
.cwing { transform-box: fill-box; transform-origin: 50% 10%; animation: cflap calc(var(--cycle) / 2) ease-in-out infinite alternate; }
.bfly { animation: wobble 0.7s ease-in-out infinite alternate; }
.bw-l { transform-box: fill-box; transform-origin: 100% 50%; animation: bw 0.16s ease-in-out infinite alternate; }
.bw-r { transform-box: fill-box; transform-origin: 0% 50%; animation: bw 0.16s ease-in-out infinite alternate; }
@keyframes ear-flop { 0%, 100% { transform: rotate(4deg); } 50% { transform: rotate(-14deg); } }
@keyframes cflap { from { transform: rotate(10deg); } to { transform: rotate(-35deg); } }
@keyframes bw { from { transform: scaleX(1); } to { transform: scaleX(0.2); } }
`;

const DRAGON_CSS = `
.dragon path { stroke: var(--line); stroke-width: 1.1; stroke-linejoin: round; }
.dragon .bones { fill: none; stroke-width: 1.4; stroke-linecap: round; opacity: 0.9; }
.dragon .jaw, .dragon .sheen { fill: none; stroke-width: 1.4; stroke-linecap: round; }
.dragon .sheen { stroke: rgba(255, 255, 255, 0.18); stroke-width: 2.5; }
.dragon .blast path, .dragon circle, .dragon ellipse { stroke: none; }
.wing {
  transform-box: view-box; transform-origin: ${SHOULDER};
  animation: flap var(--cycle) ease-in-out infinite;
}
.wing-far { animation-delay: calc(var(--cycle) * -0.1); }
.tail {
  transform-box: view-box; transform-origin: ${TAIL_ROOT};
  animation: sway calc(var(--cycle) * 2) ease-in-out infinite;
}
.head {
  transform-box: view-box; transform-origin: ${NECK};
  animation: nod calc(var(--cycle) * 2) ease-in-out infinite;
}
.blast {
  opacity: 0;
  animation: blast var(--event-len) ease-out var(--event-at) 1 both;
}
@keyframes flap {
  0%, 100% { transform: scaleY(1) skewX(0deg); }
  50% { transform: scaleY(-0.62) skewX(-8deg); }
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

/* ------------------------------------------------------------------------ */
/* Cast                                                                     */
/* ------------------------------------------------------------------------ */
// motion: fly | float travel through the air, walk | hop | surf along the bottom.
// scale: width relative to the size option. vb: the SVG viewBox.
// theme: one theme or a list of themes. weight: how often it is picked within
// its theme. flip: false keeps front-facing art (and its text) unmirrored
// when travelling left.

const dragonActor = (key) => ({
  theme: "dragons", name: DRAGONS[key].name, motion: "fly", bob: "fly",
  scale: 1, vb: [0, -40, 320, 240], weight: 1, cycle: 0.42, tilt: 22,
  line: DRAGONS[key].line, glow: DRAGONS[key].glow, css: DRAGON_CSS,
  event: { max: 0.9, share: 0.3 }, svg: () => dragonSvg(DRAGONS[key]),
});

const SAY = { max: 1.8, share: 0.4 };

const ACTORS = {
  shadow: dragonActor("shadow"),
  spike: dragonActor("spike"),
  ember: dragonActor("ember"),
  moon: dragonActor("moon"),

  sleigh: {
    theme: "christmas", name: "Santa's sleigh", motion: "fly", bob: "gentle",
    scale: 2, maxWidth: 0.75, vb: [0, -40, 560, 210], weight: 3, cycle: 0.5, tilt: 10,
    line: "#4a2c17", css: CHRISTMAS_CSS, event: SAY, svg: sleighSvg,
  },
  xmasdragon: {
    ...dragonActor("shadow"), theme: ["christmas", "australianchristmas"],
    name: "Dragon in a Santa hat", weight: 2,
    svg: () => dragonSvg(DRAGONS.shadow, { santaHat: true }),
  },
  reindeer: {
    theme: "christmas", name: "Flying reindeer", motion: "fly", bob: "gentle",
    scale: 0.62, vb: [0, -18, 100, 90], weight: 1, cycle: 0.5, tilt: 14,
    line: "#4a2c17", css: CHRISTMAS_CSS, svg: reindeerSvg,
  },
  elf: {
    theme: "christmas", name: "Elf with a present", motion: "walk",
    scale: 0.4, vb: [0, 0, 110, 150], weight: 2, cycle: 0.34,
    line: "#3b2a20", css: CHRISTMAS_CSS, svg: elfSvg,
  },

  kangaroos: {
    theme: "australianchristmas", name: "Santa's kangaroo sleigh", motion: "fly", bob: "gentle",
    scale: 2, maxWidth: 0.75, vb: [0, -40, 560, 210], weight: 3, cycle: 0.5, tilt: 10,
    line: "#4a2c17", css: AUSSIE_CSS, event: SAY, svg: kangaroosSvg,
  },
  surfing: {
    theme: "australianchristmas", name: "Surfing Santa", motion: "surf", bob: "none",
    scale: 0.85, vb: [0, -10, 200, 180], weight: 3, cycle: 0.5,
    line: "#4a2c17", css: AUSSIE_CSS, svg: surfingSvg,
  },
  cricket: {
    theme: "australianchristmas", name: "Santa playing cricket", motion: "walk",
    scale: 0.5, vb: [0, -40, 130, 184], weight: 2, cycle: 0.3,
    line: "#3b2a20", css: AUSSIE_CSS, event: SAY, svg: cricketSvg,
  },
  coolreindeer: {
    theme: "australianchristmas", name: "Reindeer keeping cool", motion: "walk",
    scale: 0.62, vb: [0, -34, 124, 112], weight: 2, cycle: 0.5,
    line: "#4a2c17", css: AUSSIE_CSS, svg: coolReindeerSvg,
  },
  aircon: {
    theme: "australianchristmas", name: "Santa cooling off by the air conditioner", motion: "float", bob: "float",
    scale: 1, vb: [0, -40, 230, 170], weight: 3, cycle: 0.6, tilt: 4, waves: [1, 1.8],
    line: "#4a2c17", css: AUSSIE_CSS, event: SAY, svg: airconSvg,
  },
  floatie: {
    theme: "australianchristmas", name: "Santa on a pool floatie", motion: "float", bob: "float",
    scale: 0.85, vb: [0, -10, 190, 130], weight: 2, cycle: 0.6, tilt: 5, waves: [1.2, 2],
    line: "#4a2c17", css: AUSSIE_CSS, svg: floatieSvg,
  },

  witch: {
    theme: "halloween", name: "Witch on a broomstick", motion: "fly", bob: "gentle",
    scale: 1.2, vb: [0, -20, 300, 180], weight: 3, cycle: 0.45, tilt: 14,
    line: "#120f16", css: HALLOWEEN_CSS, svg: witchSvg,
  },
  bats: {
    theme: "halloween", name: "Bats", motion: "fly", bob: "none", flip: false,
    scale: 1, vb: [0, 0, 260, 160], weight: 2, cycle: 0.5, tilt: 8, waves: [1.5, 2.5],
    line: "#1a1222", glow: "rgba(205, 180, 255, 0.55)", css: HALLOWEEN_CSS, svg: batsSvg,
  },
  ghost: {
    theme: "halloween", name: "Ghost", motion: "float", bob: "float", flip: false,
    scale: 0.55, vb: [0, -34, 150, 204], weight: 2, cycle: 0.6, tilt: 4, waves: [1.5, 2.5],
    line: "#b9bfd8", glow: "rgba(220, 230, 255, 0.8)", css: HALLOWEEN_CSS, event: SAY,
    svg: ghostSvg,
  },
  skeleton: {
    theme: "halloween", name: "Skeleton", motion: "walk",
    scale: 0.46, vb: [0, 0, 120, 185], weight: 3, cycle: 0.42,
    line: "none", css: HALLOWEEN_CSS, svg: skeletonSvg,
  },
  pumpkin: {
    theme: "halloween", name: "Jack-o'-lantern", motion: "hop",
    scale: 0.42, vb: [0, 0, 120, 116], weight: 1, cycle: 0.5,
    line: "#9a4204", glow: "rgba(255, 170, 40, 0.55)", css: HALLOWEEN_CSS, svg: pumpkinSvg,
  },

  bunny: {
    theme: "easter", name: "Easter bunny", motion: "hop",
    scale: 0.62, vb: [0, -20, 170, 180], weight: 4, cycle: 0.55,
    line: "#b3a99e", css: EASTER_CSS, svg: bunnySvg,
  },
  chick: {
    theme: "easter", name: "Chick", motion: "walk",
    scale: 0.32, vb: [0, 0, 100, 100], weight: 2, cycle: 0.3,
    line: "#c99400", css: EASTER_CSS, svg: chickSvg,
  },
  butterflies: {
    theme: "easter", name: "Butterflies", motion: "fly", bob: "gentle",
    scale: 0.85, vb: [0, 0, 220, 140], weight: 2, cycle: 0.5, tilt: 10, waves: [2, 3.5],
    line: "#3e2723", css: EASTER_CSS, svg: butterfliesSvg,
  },
};

/* ------------------------------------------------------------------------ */
/* Flight                                                                   */
/* ------------------------------------------------------------------------ */

const COMMON_CSS = `
:host { all: initial; }
.flight {
  position: absolute; left: 0; top: 0;
  width: var(--w); height: var(--h);
  will-change: transform;
}
.bob, .facing { width: 100%; height: 100%; }
.facing.rtl { transform: scaleX(-1); }
svg { display: block; width: 100%; height: 100%; overflow: visible; filter: var(--glow, none); }
svg :is(path, circle, ellipse, rect) { stroke: var(--line); stroke-width: 1.2; stroke-linejoin: round; stroke-linecap: round; }
svg .ns, svg text { stroke: none; }
svg .ln { fill: none; }
svg text { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.bob-fly { animation: bob-fly var(--cycle) ease-in-out infinite; }
.bob-gentle { animation: bob-gentle calc(var(--cycle) * 2.5) ease-in-out infinite; }
.bob-float { animation: bob-float calc(var(--cycle) * 3) ease-in-out infinite; }
.bob-walk { animation: bob-walk var(--cycle) linear infinite; }
.bob-hop { transform-origin: 50% 100%; animation: bob-hop var(--cycle) linear infinite; }
.leg, .arm { transform-box: fill-box; transform-origin: 50% 0; }
.swing { animation: swing var(--cycle) ease-in-out infinite; }
.swing-small { animation: swing-small var(--cycle) ease-in-out infinite; }
.gallop { animation: gallop var(--cycle) ease-in-out infinite; }
.twinkle { transform-box: fill-box; transform-origin: center; animation: twinkle 0.8s ease-in-out infinite; }
.say { transform-box: fill-box; transform-origin: center; }
.facing.rtl .say { transform: scaleX(-1); }
.pop {
  transform-box: fill-box; transform-origin: 30% 100%; opacity: 0;
  animation: pop var(--event-len) ease-out var(--event-at) 1 both;
}
@keyframes bob-fly { 0%, 100% { transform: translateY(5%); } 50% { transform: translateY(-5%); } }
@keyframes bob-gentle { 0%, 100% { transform: translateY(3%); } 50% { transform: translateY(-3%); } }
@keyframes bob-float { 0%, 100% { transform: translateY(6%); } 50% { transform: translateY(-6%); } }
@keyframes bob-walk { 0%, 50%, 100% { transform: translateY(0); } 25%, 75% { transform: translateY(-3%); } }
@keyframes bob-hop {
  0% { transform: translateY(0) scale(1.08, 0.92); animation-timing-function: ease-out; }
  10% { transform: translateY(-6%) scale(0.95, 1.06); animation-timing-function: ease-out; }
  50% { transform: translateY(-40%) scale(1, 1); animation-timing-function: ease-in; }
  92% { transform: translateY(-3%) scale(0.97, 1.04); }
  100% { transform: translateY(0) scale(1.08, 0.92); }
}
@keyframes swing { 0%, 100% { transform: rotate(-24deg); } 50% { transform: rotate(24deg); } }
@keyframes swing-small { 0%, 100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }
@keyframes swing-tiny { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
@keyframes gallop { 0%, 100% { transform: rotate(-34deg); } 50% { transform: rotate(30deg); } }
@keyframes twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes wobble { from { transform: translate(-3px, -5px); } to { transform: translate(4px, 5px); } }
@keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.82; } }
@keyframes pop {
  0% { opacity: 0; transform: scale(0.3); }
  12% { opacity: 1; transform: scale(1.12); }
  22% { transform: scale(1); }
  85% { opacity: 1; }
  100% { opacity: 0; transform: scale(1); }
}
`;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function flightPath(vw, vh, w, h, ltr, actor, steps = 24) {
  const startX = ltr ? -w * 1.05 : vw + w * 0.05;
  const endX = ltr ? vw + w * 0.05 : -w * 1.05;
  const maxY = Math.max(0, vh - h);
  const floaty = actor.motion === "float";
  const baseY = rand(0.05, 0.5) * maxY;
  const swoop = rand(floaty ? 0.05 : 0.12, floaty ? 0.12 : 0.3) * maxY * (Math.random() < 0.5 ? 1 : -1);
  const drift = rand(-0.2, 0.2) * maxY;
  const [minWaves, maxWaves] = actor.waves || [0.8, 1.5];
  const waves = rand(minWaves, maxWaves);
  const tilt = actor.tilt ?? 22;

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
    angle = clamp(angle * 0.8, -tilt, tilt) * (ltr ? 1 : -1);
    return { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`, offset: i / steps };
  });
}

// Walkers and hoppers cross along the bottom edge of the screen.
function groundPath(vw, vh, w, h, ltr) {
  const y = Math.max(0, vh - h - 4);
  const startX = ltr ? -w * 1.05 : vw + w * 0.05;
  const endX = ltr ? vw + w * 0.05 : -w * 1.05;
  return [
    { transform: `translate(${startX}px, ${y}px)` },
    { transform: `translate(${endX}px, ${y}px)` },
  ];
}

function activeTheme(cfg, now = new Date()) {
  return cfg.theme === "auto" ? seasonFor(now, inAustralia()) : cfg.theme;
}

function createFlyby(cfg) {
  let active = null;
  let lastKey = null;

  // request: a character key, a theme name, or nothing for the current theme.
  function pickActor(request) {
    if (request && ACTORS[request]) return request;
    const theme = THEMES.includes(request) ? request : activeTheme(cfg);
    if (theme === "dragons" && cfg.dragon !== "random") return cfg.dragon;
    let cast = Object.keys(ACTORS).filter((k) => [].concat(ACTORS[k].theme).includes(theme));
    if (cast.length > 1) cast = cast.filter((k) => k !== lastKey);
    const total = cast.reduce((sum, k) => sum + ACTORS[k].weight, 0);
    let roll = Math.random() * total;
    for (const k of cast) {
      roll -= ACTORS[k].weight;
      if (roll < 0) return k;
    }
    return cast[cast.length - 1];
  }

  function fly(request) {
    if (active || !document.body) return false;
    const key = pickActor(request);
    const actor = ACTORS[key];
    lastKey = key;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const [, , vbW, vbH] = actor.vb;
    const w = Math.round(Math.min(SIZES[cfg.size] * actor.scale, vw * (actor.maxWidth ?? 0.45)));
    const h = Math.round((w * vbH) / vbW);
    const ltr = Math.random() < 0.5;
    const mirror = !ltr && actor.flip !== false;
    const onGround = ["walk", "hop", "surf"].includes(actor.motion);
    const durationMs = Math.round(cfg.duration * 1000);
    let cycle = actor.cycle * (cfg.size === "large" ? 1.15 : 1);
    // Slower crossings get slower steps so feet don't skate.
    if (actor.motion === "walk" || actor.motion === "hop") {
      cycle *= clamp(cfg.duration / DEFAULT_DURATION_S, 0.75, 1.6);
    }
    const bob = actor.bob || (onGround ? actor.motion : "fly");
    const event = actor.event || SAY;

    // Click-through overlay, isolated in a shadow root so it neither inherits
    // nor leaks any styling. Nothing else on the page is changed.
    const host = document.createElement("dragon-flyby-overlay");
    host.setAttribute("aria-hidden", "true");
    host.dataset.character = key;
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;" +
      "overflow:hidden;contain:strict;display:block;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${COMMON_CSS}${actor.css || ""}</style>
      <div class="flight"><div class="bob bob-${bob}"><div class="facing ${mirror ? "rtl" : ""}">
        ${actor.svg()}
      </div></div></div>`;
    const flight = root.querySelector(".flight");
    const vars = {
      "--w": `${w}px`,
      "--h": `${h}px`,
      "--cycle": `${cycle.toFixed(3)}s`,
      "--line": actor.line,
      "--event-at": `${(cfg.duration * 0.42).toFixed(2)}s`,
      "--event-len": `${Math.min(event.max, cfg.duration * event.share).toFixed(2)}s`,
    };
    if (actor.glow) vars["--glow"] = `drop-shadow(0 0 6px ${actor.glow})`;
    for (const [name, value] of Object.entries(vars)) flight.style.setProperty(name, value);

    document.body.appendChild(host);

    const path = onGround ? groundPath(vw, vh, w, h, ltr) : flightPath(vw, vh, w, h, ltr, actor);
    const animation = flight.animate(path, { duration: durationMs, easing: "linear", fill: "forwards" });

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
    return key;
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
    themes: [...THEMES],
    characters: Object.keys(ACTORS),
    dragons: Object.keys(DRAGONS),
    theme: () => activeTheme(cfg),
    fly: (request) => flyby.fly(request),
    stop: () => {
      clearInterval(timer);
      clearTimeout(firstFlight);
      flyby.cancel();
    },
  };

  console.info(
    `%c DRAGON-FLYBY %c v${VERSION} - ${activeTheme(cfg)}, every ${cfg.interval} min, ${cfg.duration}s `,
    "color:#fff;background:#23272f;font-weight:700;",
    "color:#23272f;background:#a8e65c;",
  );
}

start();
