import {test, expect} from '@playwright/test';

async function openWorldControls(page) {
  if (!await page.locator('#runCycleBtn').isVisible()) {
    await page.getByText('World controls', {exact:true}).click();
  }
  await expect(page.locator('#runCycleBtn')).toBeVisible();
}

const fixture = '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/world/first-run-guide.css"></head><body><script type="module" src="/world/first-run-guide.js"></script></body></html>';

test.beforeEach(async ({page}) => {
  await page.route('**/world/first-run-fixture.html*', route => route.fulfill({contentType:'text/html',body:fixture}));
});

test('first-run panel works before the expensive 3D renderer is ready', async ({page}) => {
  await page.goto('/world/first-run-fixture.html');
  const guide = page.locator('#world-first-run-guide');
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('heading', {name:'Make the city change.'})).toBeVisible();
  await expect(guide.locator('[data-guide-action]')).toHaveCount(4);
  await expect(guide.locator('[data-guide-action="week"]')).toBeDisabled();
  await expect(guide.locator('[data-guide-quick]')).toHaveAttribute('href', /quick=1.*$/);
  await expect(guide.locator('[data-guide-quick]')).toHaveAttribute('href', /autoplay=1/);

  await page.evaluate(() => {
    window.hblGuidedActions = {
      week: () => window.dispatchEvent(new CustomEvent('hbl:world-feedback', {
        detail: {type:'cycle',label:'Paired weekly result',message:'Synthetic result verified.',
          metrics:[{label:'Well-being difference',value:'+2.4'}],resultId:'cyclePanel'},
      })),
      storm: () => {},
      resident: () => {},
      tenYear: () => {},
    };
    window.dispatchEvent(new CustomEvent('hbl:world-ready'));
  });
  await expect(guide.locator('[data-guide-action="week"]')).toBeEnabled();
  await guide.locator('[data-guide-action="week"]').click();
  await expect(guide.locator('[data-guide-message]')).toContainText('Synthetic result verified');
  await expect(guide.locator('[data-guide-metrics]')).toContainText('+2.4');
  await expect(guide.locator('[data-guide-open-result]')).toBeVisible();
});

test('playback observations and minimization survive refresh without altering simulation', async ({page}) => {
  await page.goto('/world/first-run-fixture.html');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('hbl:world-feedback', {
      detail:{type:'snapshot',mood:49,clock:'Monday 08:00',mode:'legacy',activity:'5 walking'},
    }));
    window.dispatchEvent(new CustomEvent('hbl:world-feedback', {
      detail:{type:'playback',paused:false,speed:10},
    }));
    window.dispatchEvent(new CustomEvent('hbl:world-feedback', {
      detail:{type:'snapshot',mood:53,clock:'Monday 10:00',mode:'legacy',activity:'10 walking'},
    }));
  });
  const guide = page.locator('#world-first-run-guide');
  await expect(guide.locator('[data-guide-live]')).toContainText('+4 points');
  await guide.locator('[data-guide-toggle]').click();
  await expect(guide.locator('#world-guide-content')).toBeHidden();
  await page.reload();
  await expect(guide.locator('#world-guide-content')).toBeHidden();
  await guide.locator('[data-guide-toggle]').click();
  await expect(guide.locator('#world-guide-content')).toBeVisible();
  await page.goto('/world/first-run-fixture.html?embed=1');
  await expect(page.locator('#world-first-run-guide')).toHaveCount(0);
});

test('World HTML keeps primary actions visible and advanced controls opt-in', async ({request}) => {
  const response = await request.get('/world');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('id="worldAdvanced"');
  expect(html).toContain('Advanced settings');
  expect(html).toContain('id="runCycleBtn"');
  expect(html).toContain('id="demoBtn"');
  expect(html).toContain('/world/first-run-guide.js');
});

test('guided launch selects an actual resident and controls the same simulation', async ({page}) => {
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/area?**',route=>route.fulfill({json:{source:'none',buildings:[],roads:[],pois:[]}}));
  await page.goto('/world?demo=1&people=16&quality=LOW');
  await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.hblPersonCommands);
  expect(await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().backend)).toBe('webgpu');
  await page.getByRole('button',{name:'Get started →',exact:true}).click();
  await expect(page.locator('#inspect')).toBeVisible();
  await expect(page.locator('#inspect')).toContainText('Lives at');
  await page.getByRole('button',{name:'Play as resident',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.hblPersonCommands.getState().controlled)).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('unavailable WebGPU opens a city-only WebGL2 viewer without simulation', async ({page}) => {
  const errors=[],requests=[];let workers=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('worker',()=>workers++);
  page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,get:()=>undefined}));
  await page.goto('/world?demo=1&people=16');
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  await page.waitForFunction(()=>window.hblStaticCity?.getState().ready);
  expect(await page.evaluate(()=>window.hblStaticCity.getState())).toMatchObject({backend:'webgl2',viewOnly:true,people:0,workers:0,simulation:false});
  expect(workers).toBe(0);expect(requests.filter(path=>/\/(sim\.js|population\/|render\.js|simulation-playback\.js)/.test(path))).toEqual([]);
  expect(errors).toEqual([]);
});
