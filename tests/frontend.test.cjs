// Browser tests for the dragon script.
// Run with:  node --test tests/frontend.test.cjs   (needs "playwright" and Chromium)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MINUTE = 60 * 1000;
let server;
let browser;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return res.writeHead(404).end();
    const type = file.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": type }).end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/tests/fixture.html`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function open(query = "", { clock = true, reducedMotion = "no-preference", time = 0, timezoneId = "Europe/London" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 }, timezoneId });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.emulateMedia({ reducedMotion });
  if (clock) {
    // Frozen fake clock: time only moves when a test calls runFor().
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time).getTime() + 1000);
  }
  await page.goto(`${base}${query ? `?${query}` : ""}`);
  await page.evaluate(() => window.loaded);
  page.errors = errors;
  return page;
}

const overlayCount = (page) => page.locator("dragon-flyby-overlay").count();

test("defaults: every 15 minutes, 5 seconds on screen", async () => {
  const page = await open();
  const cfg = await page.evaluate(() => window.dragonFlyby.config);
  assert.equal(cfg.interval, 15);
  assert.equal(cfg.duration, 5);
  assert.equal(cfg.dragon, "random");
  assert.equal(cfg.unicorn, 5);

  await page.clock.runFor(15 * MINUTE - 1000);
  assert.equal(await overlayCount(page), 0, "no dragon before 15 minutes");
  await page.clock.runFor(1000);
  assert.equal(await overlayCount(page), 1, "dragon appears at 15 minutes");
  await page.clock.runFor(5000);
  assert.equal(await overlayCount(page), 0, "dragon gone after 5 seconds");
  await page.clock.runFor(15 * MINUTE - 5000);
  assert.equal(await overlayCount(page), 1, "and again 15 minutes after the first");
  assert.deepEqual(page.errors, []);
  await page.close();
});

test("duration of up to 10 seconds is allowed", async () => {
  const page = await open("duration=8");
  assert.equal(await page.evaluate(() => window.dragonFlyby.config.duration), 8);
  await page.evaluate(() => window.dragonFlyby.fly());
  await page.clock.runFor(7999);
  assert.equal(await overlayCount(page), 1);
  await page.clock.runFor(1);
  assert.equal(await overlayCount(page), 0);
  await page.close();
});

test("duration can never exceed 10 seconds", async () => {
  const page = await open("duration=30");
  assert.equal(await page.evaluate(() => window.dragonFlyby.config.duration), 10);
  await page.evaluate(() => window.dragonFlyby.fly());
  await page.clock.runFor(9999);
  assert.equal(await overlayCount(page), 1);
  await page.clock.runFor(1);
  assert.equal(await overlayCount(page), 0);
  await page.close();
});

test("custom interval and dragon from the resource URL", async () => {
  const page = await open("interval=2&dragon=ember&size=small");
  await page.clock.runFor(2 * MINUTE);
  assert.equal(await overlayCount(page), 1);
  const blast = await page.evaluate(() =>
    document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector(".blast path").getAttribute("fill"));
  assert.equal(blast, "#ff4b00", "ember dragon breathes fire");
  await page.close();
});

test("overlay is click-through and leaves the dashboard untouched", async () => {
  const page = await open("", { clock: false });
  const before = await page.evaluate(() => document.getElementById("dashboard").outerHTML);
  await page.evaluate(() => {
    window.taps = 0;
    document.getElementById("tap").addEventListener("click", () => window.taps++);
    window.dragonFlyby.fly("shadow");
  });
  // Wait until the dragon is mid-screen, then click right on top of it.
  await page.waitForTimeout(2200);
  const box = await page.evaluate(() => {
    const svg = document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector("svg");
    const r = svg.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).id, box);
  assert.equal(hit, "tap", "the dragon does not intercept the pointer");
  await page.mouse.click(Math.min(1000, Math.max(5, box.x)), Math.min(590, Math.max(5, box.y)));
  assert.equal(await page.evaluate(() => window.taps), 1);

  await page.waitForTimeout(3000);
  assert.equal(await overlayCount(page), 0);
  assert.equal(await page.evaluate(() => document.getElementById("dashboard").outerHTML), before);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test("only flies on dashboards when dashboards_only is on", async () => {
  const page = await open("interval=1");
  await page.evaluate(() => {
    const ha = document.createElement("home-assistant");
    ha.hass = { panels: { tests: { component_name: "config" } } };
    document.body.append(ha);
  });
  await page.clock.runFor(MINUTE);
  assert.equal(await overlayCount(page), 0, "skipped on a settings page");
  await page.evaluate(() => {
    document.querySelector("home-assistant").hass.panels.tests.component_name = "lovelace";
  });
  await page.clock.runFor(MINUTE);
  assert.equal(await overlayCount(page), 1, "flies on a dashboard");
  await page.close();
});

test("respects reduced motion", async () => {
  const page = await open("interval=1", { reducedMotion: "reduce" });
  await page.clock.runFor(3 * MINUTE);
  assert.equal(await overlayCount(page), 0);
  await page.close();
});

test("fly on load", async () => {
  const page = await open("onload=1");
  await page.clock.runFor(3000);
  assert.equal(await overlayCount(page), 1);
  await page.close();
});

const CAST = {
  dragons: ["shadow", "spike", "ember", "moon"],
  christmas: ["sleigh", "reindeer", "elf", "xmasdragon"],
  australianchristmas: ["kangaroos", "surfing", "cricket", "aircon", "coolreindeer", "floatie", "xmasdragon"],
  halloween: ["witch", "bats", "ghost", "skeleton", "pumpkin"],
  easter: ["bunny", "chick", "butterflies"],
  minecraft: ["steve", "creeper", "enderman", "mcskeleton", "denis"],
  weather: ["sun", "cloud", "raincloud", "stormcloud", "duck", "kite", "snowman", "penguin", "owl", "icecream"],
  newyear: ["fireworks", "bannerplane", "partydragon"],
  lunarnewyear: ["liondance", "paradedragon", "lanterns"],
  valentines: ["cupid", "hearts", "lovebirds"],
  stpatricks: ["leprechaun", "shamrocks", "rainbowgold"],
  diadelosmuertos: ["calavera", "monarchs", "marigolds"],
  diwali: ["diyas", "rangoli", "fireworks"],
  eid: ["crescent", "fanous"],
  birthdays: ["balloons", "cake", "bannerplane", "partydragon"],
};
const character = (page) => page.locator("dragon-flyby-overlay").getAttribute("data-character");

test("every character renders and is cleaned up", async () => {
  const page = await open("duration=2");
  const all = await page.evaluate(() => window.dragonFlyby.characters);
  assert.deepEqual([...all].sort(), [...new Set([...Object.values(CAST).flat(), "unicorn"])].sort());
  for (const key of all) {
    assert.equal(await page.evaluate((k) => window.dragonFlyby.fly(k), key), key);
    assert.equal(await character(page), key);
    const size = await page.evaluate(() => {
      const r = document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector("svg").getBoundingClientRect();
      return r.width * r.height;
    });
    assert.ok(size > 1000, `${key} is drawn at a visible size`);
    await page.clock.runFor(2000);
    assert.equal(await overlayCount(page), 0, `${key} removed after its flight`);
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

for (const theme of ["christmas", "australianchristmas", "halloween", "easter", "minecraft", "newyear",
  "lunarnewyear", "valentines", "stpatricks", "diadelosmuertos", "diwali", "eid", "birthdays"]) {
  test(`${theme} theme only sends ${theme} visitors`, async () => {
    const page = await open(`theme=${theme}&interval=1&unicorn=0`);
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await page.clock.runFor(60 * 1000);
      seen.add(await character(page));
    }
    for (const key of seen) assert.ok(CAST[theme].includes(key), `${key} belongs to ${theme}`);
    assert.ok(seen.size >= Math.min(2, CAST[theme].length), `more than one ${theme} character shows up`);
    await page.close();
  });
}

test("walkers and hoppers cross along the bottom of the screen", async () => {
  const page = await open("", { clock: false });
  for (const key of ["elf", "skeleton", "pumpkin", "bunny", "chick", "surfing", "cricket", "coolreindeer", "steve",
    "creeper", "enderman", "mcskeleton", "denis", "duck", "snowman", "penguin", "icecream", "liondance", "leprechaun",
    "calavera", "cake"]) {
    const bottom = await page.evaluate((k) => {
      window.dragonFlyby.stop();
      window.dragonFlyby.fly(k);
      const flight = document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector(".flight");
      return flight.getBoundingClientRect().bottom;
    }, key);
    assert.ok(Math.abs(bottom - (600 - 4)) < 2, `${key} walks on the bottom edge (bottom=${bottom})`);
  }
  await page.close();
});

test("auto theme follows the calendar", async () => {
  const cases = [
    ["2026-10-15T12:00:00", "halloween"],
    ["2026-12-10T12:00:00", "christmas"],
    ["2026-07-04T12:00:00", "dragons"],
    ["2026-03-29T12:00:00", "easter"], // a week before Easter Sunday (5 April 2026)
    ["2026-04-06T12:00:00", "easter"], // Easter Monday
    ["2026-04-07T12:00:00", "dragons"],
    ["2027-03-28T12:00:00", "easter"], // Easter Sunday 2027
    ["2026-12-31T12:00:00", "newyear"],
    ["2027-01-01T12:00:00", "newyear"],
    ["2027-01-02T12:00:00", "dragons"],
    ["2026-02-13T12:00:00", "valentines"],
    ["2026-02-16T12:00:00", "lunarnewyear"], // eve of Lunar New Year (17 Feb 2026)
    ["2026-02-23T12:00:00", "lunarnewyear"],
    ["2026-02-24T12:00:00", "dragons"],
    ["2034-02-19T12:00:00", "lunarnewyear"], // a leap-month year
    ["2026-03-17T12:00:00", "stpatricks"],
    ["2026-03-20T12:00:00", "eid"], // Eid al-Fitr 2026
    ["2026-05-27T12:00:00", "eid"], // Eid al-Adha 2026
    ["2026-11-02T12:00:00", "diadelosmuertos"],
    ["2026-11-08T12:00:00", "diwali"],
    ["2026-11-10T12:00:00", "diwali"],
    ["2026-11-11T12:00:00", "dragons"],
    ["2027-10-29T12:00:00", "diwali"], // wins over Halloween month
    ["2031-11-14T12:00:00", "diwali"],
  ];
  for (const [date, expected] of cases) {
    const page = await open("theme=auto&interval=1&unicorn=0", { time: new Date(date).getTime() });
    assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), expected, date);
    await page.clock.runFor(60 * 1000);
    assert.ok(CAST[expected].includes(await character(page)), `${date} sends a ${expected} visitor`);
    await page.close();
  }
});

test("auto theme uses the Australian Christmas in Australia", async () => {
  const december = new Date("2026-12-10T12:00:00").getTime();

  // Home Assistant's country setting wins.
  let page = await open("theme=auto&interval=1&unicorn=0", { time: december });
  await page.evaluate(() => {
    const ha = document.createElement("home-assistant");
    ha.hass = { panels: {}, config: { country: "AU", time_zone: "Europe/London" } };
    document.body.append(ha);
  });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "australianchristmas");
  await page.clock.runFor(60 * 1000);
  assert.ok(CAST.australianchristmas.includes(await character(page)));
  await page.close();

  // Without Home Assistant settings, the browser's time zone decides.
  page = await open("theme=auto", { time: december, timezoneId: "Australia/Perth" });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "australianchristmas");
  await page.close();

  // Elsewhere it stays a snowy Christmas, and Halloween is unchanged.
  page = await open("theme=auto", { time: december, timezoneId: "America/New_York" });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "christmas");
  await page.close();
  page = await open("theme=auto", { time: new Date("2026-10-20T12:00:00").getTime(), timezoneId: "Australia/Sydney" });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "halloween");
  await page.close();
});

test("the Santa-hat dragon visits both Christmas themes", async () => {
  for (const theme of ["christmas", "australianchristmas"]) {
    const page = await open(`theme=${theme}&interval=1`);
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.clock.runFor(60 * 1000);
      found = (await character(page)) === "xmasdragon";
    }
    assert.ok(found, `xmasdragon shows up in ${theme}`);
    const hat = await page.evaluate(() =>
      document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector('.head path[fill="#d62828"]') !== null);
    assert.ok(hat, "and wears its Santa hat");
    await page.close();
  }
});

test("the unicorn turns up by chance in every theme", async () => {
  for (const theme of ["dragons", "christmas", "minecraft"]) {
    const page = await open(`theme=${theme}&interval=1&unicorn=25`);
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.clock.runFor(60 * 1000);
      seen.push(await character(page));
    }
    const unicorns = seen.filter((k) => k === "unicorn").length;
    assert.ok(unicorns >= 1 && unicorns <= 25, `${theme}: ${unicorns} unicorns in 40 visits at 25%`);
    for (const k of seen) assert.ok(k === "unicorn" || CAST[theme].includes(k), `${k} fits ${theme}`);
    await page.close();
  }
});

test("unicorn chance 0 turns it off, and the chance is capped at 25%", async () => {
  let page = await open("interval=1&unicorn=0");
  for (let i = 0; i < 40; i++) {
    await page.clock.runFor(60 * 1000);
    assert.notEqual(await character(page), "unicorn");
  }
  await page.close();
  page = await open("unicorn=80");
  assert.equal(await page.evaluate(() => window.dragonFlyby.config.unicorn), 25);
  assert.equal(await page.evaluate(() => window.dragonFlyby.fly("unicorn")), "unicorn");
  await page.close();
});

test("extra large size draws visitors bigger than large", async () => {
  const width = async (size) => {
    const page = await open(`size=${size}`);
    const w = await page.evaluate(() => {
      window.dragonFlyby.fly("shadow");
      return parseFloat(document.querySelector("dragon-flyby-overlay").shadowRoot
        .querySelector(".flight").style.getPropertyValue("--w"));
    });
    await page.close();
    return w;
  };
  const large = await width("large");
  const xl = await width("extralarge");
  assert.equal(large, 350);
  assert.ok(xl > large, `extralarge (${xl}) is bigger than large (${large})`);
});

// A fake Home Assistant with the given entity states (and sun position).
async function withStates(page, states) {
  await page.evaluate((states) => {
    let ha = document.querySelector("home-assistant");
    if (!ha) {
      ha = document.createElement("home-assistant");
      document.body.append(ha);
    }
    ha.hass = { panels: {}, config: { country: "GB" }, states };
  }, states);
}
const entity = (state, attributes = {}) => ({ state, attributes });
const day = entity("above_horizon");
const night = entity("below_horizon");

async function visitors(page, n = 10) {
  const seen = [];
  for (let i = 0; i < n; i++) {
    await page.clock.runFor(60 * 1000);
    seen.push(await character(page));
  }
  return seen;
}

test("weather theme reads your own weather entity (like the Bureau of Meteorology one)", async () => {
  const page = await open("theme=weather&weather=weather.melbourne&interval=1&unicorn=0");
  await withStates(page, {
    "weather.melbourne": entity("rainy", { temperature: 18, temperature_unit: "°C" }),
    "weather.forecast_home": entity("sunny", { temperature: 30, temperature_unit: "°C" }),
    "sun.sun": day,
  });
  const weather = await page.evaluate(() => window.dragonFlyby.weather());
  assert.equal(weather.entity, "weather.melbourne");
  assert.equal(weather.condition, "rainy");
  for (const k of await visitors(page)) assert.ok(["duck", "raincloud"].includes(k), `${k} fits rain`);
  await page.close();
});

test("weather theme swaps sun and owl by the sun's position", async () => {
  const page = await open("theme=weather&weather=weather.melbourne&interval=1&unicorn=0");
  // The Bureau of Meteorology integration reports today's forecast all day.
  await withStates(page, { "weather.melbourne": entity("sunny"), "sun.sun": night });
  assert.deepEqual([...new Set(await visitors(page, 3))], ["owl"]);
  await withStates(page, { "weather.melbourne": entity("clear-night"), "sun.sun": day });
  assert.deepEqual([...new Set(await visitors(page, 3))], ["sun"]);
  await page.close();
});

test("hot days bring a melting ice cream that tells you the temperature", async () => {
  const page = await open("theme=weather&weather=weather.melbourne&interval=1&unicorn=0");
  await withStates(page, { "weather.melbourne": entity("sunny", { temperature: 38.4, temperature_unit: "°C" }), "sun.sun": day });
  const seen = await visitors(page, 16);
  assert.ok(seen.includes("icecream"), "ice cream appears");
  assert.ok(seen.every((k) => ["sun", "icecream"].includes(k)));
  await page.evaluate(() => { window.dragonFlyby.stop(); window.dragonFlyby.fly("icecream"); });
  const text = await page.evaluate(() => document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector("text").textContent);
  assert.equal(text, "Phew, 38°!");
  await page.close();
});

test("weather words from a text sensor are understood", async () => {
  const page = await open("theme=weather&weather=sensor.melbourne_short_text_0&interval=1&unicorn=0");
  await withStates(page, { "sensor.melbourne_short_text_0": entity("Possible shower."), "sun.sun": day });
  assert.equal((await page.evaluate(() => window.dragonFlyby.weather())).condition, "rainy");
  await withStates(page, { "sensor.melbourne_short_text_0": entity("Snow developing."), "sun.sun": day });
  for (const k of await visitors(page, 4)) assert.ok(["snowman", "penguin"].includes(k), `${k} fits snow`);
  await page.close();
});

test("weather entity is found automatically, and dragons stand in without one", async () => {
  let page = await open("theme=weather&interval=1&unicorn=0");
  await withStates(page, {
    "weather.home_hourly": entity("sunny"),
    "weather.home": entity("windy"),
    "sun.sun": day,
  });
  const weather = await page.evaluate(() => window.dragonFlyby.weather());
  assert.equal(weather.entity, "weather.home");
  assert.deepEqual([...new Set(await visitors(page, 3))], ["kite"]);
  await page.close();

  page = await open("theme=weather&interval=1&unicorn=0");
  await withStates(page, { "sun.sun": day });
  for (const k of await visitors(page, 3)) assert.ok(CAST.dragons.includes(k), `${k} is a dragon`);
  await page.close();
});

test("birthdays: named greetings, auto takes over, other themes join in", async () => {
  const birthdays = encodeURIComponent(JSON.stringify([
    { name: "Mia", day: 12, month: 3, year: 2019 },
    { name: "<b>Sam</b>", day: 4, month: 11 },
  ]));
  let page = await open(`theme=auto&interval=1&unicorn=0&birthdays=${birthdays}`, { time: new Date("2026-03-12T09:00:00").getTime() });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "birthdays");
  await page.evaluate(() => window.dragonFlyby.fly("balloons"));
  assert.equal(await page.evaluate(() => document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector("text").textContent),
    "Happy 7th birthday, Mia!");
  await page.close();

  // Names are shown as text, never as HTML.
  page = await open(`theme=birthdays&birthdays=${birthdays}`, { time: new Date("2026-11-04T09:00:00").getTime() });
  const markup = await page.evaluate(() => {
    window.dragonFlyby.fly("cake");
    const root = document.querySelector("dragon-flyby-overlay").shadowRoot;
    return { text: root.querySelector("text").textContent, bold: root.querySelectorAll("b").length };
  });
  assert.equal(markup.text, "Happy birthday, <b>Sam</b>!");
  assert.equal(markup.bold, 0);
  await page.close();

  // In any other theme, about half the visits on the day are birthday visitors.
  page = await open(`theme=minecraft&interval=1&unicorn=0&birthdays=${birthdays}`, { time: new Date("2026-03-12T09:00:00").getTime() });
  const seen = await visitors(page, 30);
  assert.ok(seen.some((k) => CAST.birthdays.includes(k)), "birthday visitors join in");
  assert.ok(seen.some((k) => CAST.minecraft.includes(k)), "the theme still shows up");
  await page.close();

  // Without birthdays in the auto list, the day is ordinary.
  page = await open(`theme=auto&holidays=halloween&birthdays=${birthdays}`, { time: new Date("2026-03-12T09:00:00").getTime() });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "dragons");
  await page.close();
});

test("auto only uses the holidays you keep", async () => {
  const xmas = new Date("2026-12-25T12:00:00").getTime();
  let page = await open("theme=auto&holidays=halloween,diwali", { time: xmas });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "dragons");
  await page.close();
  page = await open("theme=auto&holidays=", { time: new Date("2026-10-15T12:00:00").getTime() });
  assert.equal(await page.evaluate(() => window.dragonFlyby.theme()), "dragons");
  await page.close();
});

test("New Year banner names the coming year", async () => {
  const page = await open("", { time: new Date("2026-12-31T20:00:00").getTime() });
  const text = await page.evaluate(() => {
    window.dragonFlyby.fly("bannerplane");
    return document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector("text").textContent;
  });
  assert.equal(text, "Happy New Year 2027!");
  await page.close();
});

test("fireworks appear in one spot and fade out", async () => {
  const page = await open("", { clock: false });
  const spots = await page.evaluate(async () => {
    window.dragonFlyby.fly("fireworks");
    const flight = document.querySelector("dragon-flyby-overlay").shadowRoot.querySelector(".flight");
    const at = () => {
      const r = flight.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), getComputedStyle(flight).opacity];
    };
    const first = (await new Promise((r) => setTimeout(r, 1500)), at());
    const second = (await new Promise((r) => setTimeout(r, 1500)), at());
    return [first, second];
  });
  assert.deepEqual(spots[0].slice(0, 2), spots[1].slice(0, 2), "does not travel");
  assert.equal(spots[0][2], "1");
  await page.close();
});
