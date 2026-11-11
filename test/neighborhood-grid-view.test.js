import { test, expect } from "bun:test";
import { normalizeGridFixture, gridCellLabel, gridCellColor, createNeighborhoodGridView } from "../world/causal/neighborhood-grid-view.js";
const fixture = () => ({ source: "fixture", metrics: [{ id: "homes", label: "Fixture homes", unit: "units", min: 0, max: 24 }, { id: "rent", label: "Fixture rent", unit: "USD/month", min: 0, max: 2000 }], cells: [{ id: "c00", row: 0, column: 0, values: { homes: { value: 0, source: "Authored fixture" } } }, { id: "c01", row: 0, column: 1, values: { homes: { value: 12 } } }, { id: "c10", row: 1, column: 0, values: { homes: { value: null, reason: "No locatable observations" } } }, { id: "c11", row: 1, column: 1, values: { homes: { value: 4 }, rent: { value: 800 } } }] });
test("fixture-only contract explicitly rejects real data and bounds workload", () => {
  expect(() => normalizeGridFixture({ ...fixture(), source: "city" })).toThrow("fixture");
  expect(() => normalizeGridFixture({ ...fixture(), metrics: [] })).toThrow();
  expect(() => normalizeGridFixture({ ...fixture(), cells: Array(257).fill(fixture().cells[0]) })).toThrow();
  expect(typeof createNeighborhoodGridView).toBe("function");
});
test("zero and missing stay distinct with source and reason, without mutating input", () => {
  const raw = fixture(), before = JSON.stringify(raw), view = normalizeGridFixture(raw);
  expect(view.cells[0].values.homes.value).toBe(0);
  expect(view.cells[2].values.homes.value).toBeNull();
  expect(gridCellLabel(view.cells[2], view.metrics[0])).toContain("No locatable observations");
  expect(gridCellLabel(view.cells[0], view.metrics[0])).toContain("0 units");
  expect(JSON.stringify(raw)).toBe(before);
});
test("missing metric and invalid values become unavailable rather than numeric zero", () => {
  const raw = fixture();
  raw.cells[0].values.homes.value = NaN;
  const view = normalizeGridFixture(raw);
  expect(view.cells[0].values.homes.value).toBeNull();
  expect(view.cells[0].values.rent.value).toBeNull();
  expect(gridCellColor(null, view.metrics[0])).toBeNull();
  expect(gridCellColor(0, view.metrics[0])).toContain("hsl");
});
test("duplicate identity, duplicate position, bad scale and out of bound coordinates fail", () => {
  for (const edit of [(f) => f.cells[1].id = "c00", (f) => f.cells[1].column = 0, (f) => f.cells[1].row = -1, (f) => f.cells[1].row = 16, (f) => f.metrics[1].id = "homes", (f) => f.metrics[0].max = 0]) {
    const f = fixture();
    edit(f);
    expect(() => normalizeGridFixture(f)).toThrow();
  }
});
test("empty fixture has bounded dimensions and no invented cells", () => {
  const f = fixture();
  f.cells = [];
  expect(normalizeGridFixture(f)).toMatchObject({ rows: 1, columns: 1, cells: [] });
});
test("stable ordering and scales do not depend on cell input order", () => {
  const a = fixture(), b = fixture();
  b.cells.reverse();
  expect(normalizeGridFixture(a)).toEqual(normalizeGridFixture(b));
  const metric = a.metrics[0];
  expect(gridCellColor(500, metric)).toBe(gridCellColor(24, metric));
});
test.skipIf(!process.env.HBL_GRID_BROWSER)("real Canvas fixture: GPU absent, keyboard selection, mobile bounds, missing hatch and disposal", async () => {
  const { createRequire } = await import("node:module"), { readFile, mkdir } = await import("node:fs/promises"), { chromium } = createRequire(process.env.HBL_GRID_TEST_DEPENDENCY_ROOT ? process.env.HBL_GRID_TEST_DEPENDENCY_ROOT + "/package.json" : import.meta.url)("@playwright/test"), moduleURL = new URL("../world/causal/neighborhood-grid-view.js", import.meta.url), cssURL = new URL("../world/causal/neighborhood-grid-view.css", import.meta.url), server = Bun.serve({ port: 0, async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/module.js")
      return new Response(await readFile(moduleURL), { headers: { "content-type": "text/javascript" } });
    if (path === "/style.css")
      return new Response(await readFile(cssURL), { headers: { "content-type": "text/css" } });
    return new Response(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><h1>Grid component fixture harness</h1><label>Harness month <input type="range" min="0" max="120"></label><div id="host"></div><script type="module">import {createNeighborhoodGridView} from '/module.js';window.selection=null;window.stage=createNeighborhoodGridView(document.querySelector('#host'),{onSelect:e=>window.selection=e});stage.update(${JSON.stringify(fixture())});</script>`, { headers: { "content-type": "text/html" } });
  } });
  let browser;
  try {
    browser = await chromium.launch({ headless: !0 });
    await mkdir("/tmp/hbl-neighborhood-grid/artifacts", { recursive: !0 });
    for (const width of [320, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: "reduce" }), errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", { value: void 0 });
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          return /webgl|webgpu/.test(type) ? null : original.call(this, type, ...args);
        };
      });
      await page.goto(`http://127.0.0.1:${server.port}`);
      await page.waitForFunction(() => window.stage);
      expect(await page.locator(".neighborhood-grid-view").innerText()).toContain("not connected to City data");
      await page.getByRole("button", { name: /^c00:/ }).focus();
      await page.keyboard.press("ArrowRight");
      expect(await page.evaluate(() => window.selection.cellId)).toBe("c01");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowLeft");
      expect(await page.evaluate(() => window.selection.value)).toBeNull();
      expect(await page.getByRole("status").innerText()).toContain("unavailable");
      await page.getByRole("combobox", { name: "Fixture metric" }).selectOption("rent");
      await page.getByRole("button", { name: /^c11:/ }).click();
      expect(await page.evaluate(() => window.selection)).toMatchObject({ cellId: "c11", metricId: "rent", value: 800, source: "Explicit synthetic fixture", dataSource: "fixture" });
      await page.keyboard.press("Tab");
      expect(await page.getByRole("button", { name: /^c11:/ }).evaluate((el) => document.activeElement === el)).toBe(!1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(!0);
      expect(await page.evaluate(() => window.stage.getStats())).toMatchObject({ backend: "canvas2d", animationFrames: 0 });
      const box = await page.locator("input[type=range]").boundingBox();
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe("INPUT");
      await page.screenshot({ path: `/tmp/hbl-neighborhood-grid/artifacts/${width}.png`, fullPage: !0 });
      await page.evaluate(() => {
        stage.dispose();
        stage.dispose();
      });
      expect(await page.locator(".neighborhood-grid-view").count()).toBe(0);
      expect(await page.evaluate(() => stage.getStats().cells)).toBe(0);
      expect(errors).toEqual([]);
      const cleanup = await page.evaluate(async () => {
        const { createNeighborhoodGridView } = await import("/module.js"), original = HTMLCanvasElement.prototype.getContext, host = document.createElement("div");
        document.body.append(host);
        HTMLCanvasElement.prototype.getContext = () => {
          throw Error("denied");
        };
        let threw = !1;
        try {
          createNeighborhoodGridView(host);
        } catch {
          threw = !0;
        }
        HTMLCanvasElement.prototype.getContext = original;
        const children = host.children.length;
        host.remove();
        return { threw, children };
      });
      expect(cleanup).toEqual({ threw: !0, children: 0 });
      await page.close();
    }
  } finally {
    await browser?.close();
    server.stop();
  }
}, 30000);
