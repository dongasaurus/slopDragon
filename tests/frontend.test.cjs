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

async function open(query = "", { clock = true, reducedMotion = "no-preference" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.emulateMedia({ reducedMotion });
  if (clock) {
    // Frozen fake clock: time only moves when a test calls runFor().
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
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
