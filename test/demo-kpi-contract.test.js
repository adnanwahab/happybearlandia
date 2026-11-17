import {test, expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {getFrame} from '../world/future-machine/data/index.js';
import {compareFrame} from '../world/future-machine/diff/index.js';
import {metricPresentation} from '../world/future-machine/ui/model.js';
import {cityMetrics} from '../world/city/engine.js';

// Synthetic snapshot fixture, not an empirical result or an engine forecast.
// Keep seed/model and explicit monthly identity while varying only recorded metrics.
const keys = ['housingUnits', 'meanRent', 'capitalSpending'];
const units = ['homes', 'USD/month', 'USD total'];
function fixture() {
  const initial = createCity({seed:42, households:3});
  const rows = [0,16,120].map(month => {
    const state = structuredClone(initial); state.month = month;
    return {month, state, metrics:{...cityMetrics(state), capitalSpending:0}, events:[], causalRecords:[], decisions:[]};
  });
  const indexed = Array(121).fill(null); for (const row of rows) indexed[row.month] = row;
  return {seed:42, modelVersion:initial.version, experimentId:'synthetic-kpi-contract.v1', baseline:indexed, plan:structuredClone(indexed)};
}

for (const [index,key] of keys.entries()) {
  test(`${key}: source mutation, selected time, missing and zero presentation contract`, () => {
    const history = fixture();
    const present = month => {
      const metric = compareFrame(getFrame(history,month)).metrics[key];
      return metricPresentation({baseline:metric.baseline, intervention:metric.plan, unit:metric.unit});
    };
    for (const month of [16,120]) {
      history.baseline[month].metrics[key] = month + 11;
      history.plan[month].metrics[key] = month + 28;
      expect(present(month).baseline).toBe(`${month + 11} ${units[index]}`);
      expect(present(month).intervention).toBe(`${month + 28} ${units[index]}`);
      expect(present(month).delta).toBe(`+17 ${units[index]}`);
    }
    for (const arm of ['baseline','plan']) {
      for (const missing of [undefined,null,NaN,Infinity,'99']) {
        history[arm][120].metrics[key] = missing;
        expect(present(120).delta).toBe('Unavailable');
      }
      history[arm][120].metrics[key] = 0;
    }
    expect(present(120).delta).toBe(`0 ${units[index]}`);
    expect(present(16).delta).toBe(`+17 ${units[index]}`);
    expect(present(17).delta).toBe('Unavailable');
  });
}

// The explicit browser command sets HBL_FM_BROWSER=1; ordinary unit runs remain headless.
// HBL_PLAYWRIGHT_MODULE may select an existing Playwright installation.
test.skipIf(!process.env.HBL_FM_BROWSER)('every demo KPI follows snapshot mutations and selected month; missing is never zero', async () => {
  const {chromium} = await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
  const root = new URL('../', import.meta.url).pathname;
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('http://kpi-contract.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({contentType:'text/html', body:'<!doctype html><body>'});
      if (!path.startsWith('/world/') || path.includes('..')) return route.fulfill({status:404, body:''});
      return route.fulfill({contentType:'application/javascript', body:await Bun.file(root + path).text()});
    });
    await page.goto('http://kpi-contract.test/');
    await page.evaluate(async history => {
      const {createUI} = await import('/world/future-machine/ui/index.js');
      const {getFrame} = await import('/world/future-machine/data/index.js');
      const {compareFrame} = await import('/world/future-machine/diff/index.js');
      window.historyFixture = history;
      window.selectMonth = month => {
        const frame = getFrame(historyFixture, month);
        ui.update({status:'ready', month, frame, diff:compareFrame(frame), provenance:historyFixture});
      };
      window.ui = createUI(document.body, {onMonth:month => selectMonth(month), onMetric:()=>{}});
      selectMonth(0);
    }, fixture());
    const cards = page.locator('.fm-card');
    // Exact inventory prevents a fourth displayed KPI silently escaping this contract.
    expect(await cards.locator('h2').allTextContents()).toEqual(['Homes','Mean unit rent','City spending']);
    for (const [index, key] of keys.entries()) {
      const card = cards.nth(index), unit = units[index];
      for (const month of [16,120]) {
        await page.evaluate(({key,month,index}) => {
          for (const [arm,value] of [['baseline',11 + index + month],['plan',28 + index + month]]) {
            historyFixture[arm][month].metrics[key] = value;
          }
        }, {key,month,index});
        // Exercise the native timeline callback, not just a formatter or canned diff.
        await page.getByRole('slider').fill(String(month));
        expect(await card.locator('.fm-value-baseline').textContent()).toBe(`WITHOUT PLAN  ${11 + index + month} ${unit}`);
        expect(await card.locator('.fm-value-plan').textContent()).toBe(`WITH PLAN  ${28 + index + month} ${unit}`);
        expect(await card.locator('strong').textContent()).toBe(`+17 ${unit}`);
        expect(await page.locator('.fm-run-provenance').textContent()).toContain(`MONTH ${month} / 120 · SEED 42 · MODEL`);
      }
      for (const arm of ['baseline','plan']) {
        for (const missing of ['deleted','null','NaN','Infinity','string']) {
          await page.evaluate(({key,arm,missing}) => {
            const metrics = historyFixture[arm][120].metrics;
            if (missing==='deleted') delete metrics[key];
            else metrics[key] = {null:null,NaN:NaN,Infinity:Infinity,string:'99'}[missing];
            selectMonth(120);
          }, {key,arm,missing});
          expect(await card.locator('strong').textContent()).toBe('Unavailable');
          expect(await card.locator('.fm-value-baseline').textContent()).toBe('WITHOUT PLAN  Unavailable');
          expect(await card.locator('.fm-value-plan').textContent()).toBe('WITH PLAN  Unavailable');
          expect(await card.locator('button').isDisabled()).toBe(true);
        }
        await page.evaluate(({key,arm}) => {historyFixture[arm][120].metrics[key]=0; selectMonth(120);}, {key,arm});
      }
      expect(await card.locator('strong').textContent()).toBe(`0 ${unit}`);
      expect(await card.locator('button').isEnabled()).toBe(true);
      // Reverse time must restore the previously recorded values, not retain Month 120.
      await page.getByRole('slider').fill('16');
      expect(await card.locator('strong').textContent()).toBe(`+17 ${unit}`);
    }
    // A missing snapshot must not retain any last-known headline.
    await page.getByRole('slider').fill('17');
    expect(await cards.locator('strong').allTextContents()).toEqual(['Unavailable','Unavailable','Unavailable']);
    expect(errors).toEqual([]);
  } finally {await browser?.close();}
}, 30000);
