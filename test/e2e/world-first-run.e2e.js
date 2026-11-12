import {test, expect} from '@playwright/test';

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

test('guided actions operate on the actual World simulator', async ({page}) => {
  test.setTimeout(120000);
  const lat=29.7286,lng=-95.4746,radiusM=400,kx=111320*Math.cos(lat*Math.PI/180);
  const coord=(x,z)=>[lat-z/110540,lng+x/kx];
  const buildings=Array.from({length:16},(_,i)=>{
    const x=(i%4-1.5)*85,z=(Math.floor(i/4)-1.5)*85;
    return {id:'first-run-building-'+i,kind:i%5===0?'work':'home',levels:3,
      pts:[coord(x-12,z-12),coord(x+12,z-12),coord(x+12,z+12),coord(x-12,z+12),coord(x-12,z-12)]};
  });
  const core={source:'osm',origin:{lat,lng},radiusM,areaKey:lat+','+lng+','+radiusM,
    bbox:{s:lat-radiusM/110540,n:lat+radiusM/110540,w:lng-radiusM/kx,e:lng+radiusM/kx},
    buildings,roads:[{kind:'residential',pts:[coord(-300,0),coord(300,0)]}],pois:[],
    attribution:'Synthetic test geometry',phase:'core',floodZones:[],
    floodZonesSource:'pending',floodZonesStatus:'pending'};
  await page.route('**/api/area?**',route=>route.fulfill({json:core}));
  await page.route('**/api/area/enrichment?**',route=>route.fulfill({json:{
    ...core,source:'area-enrichment',floodZonesSource:'unavailable',
    floodZonesStatus:'ready',floodZones:[],
  }}));
  await page.route('**/api/plan',route=>route.fulfill({json:{packages:[]}}));
  await page.route('**/api/dear-congress/**',route=>route.fulfill({json:{packages:[]}}));
  await page.goto('/world?demo=1&people=16&renderer=webgl',{waitUntil:'domcontentloaded'});
  const guide=page.locator('#world-first-run-guide');
  await expect(guide).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblGuidedActions && window.hblWorldStartup?.readyMs)),{timeout:90000}).toBe(true);
  // The early guide hands visibility to the richer ready-state guide. Its live
  // experiments remain available through one explicitly selected companion sheet.
  await expect(page.locator('#firstRunGuide')).toBeVisible();
  await expect(guide).toBeHidden();
  await page.getByText('More city actions', {exact:true}).click();
  await page.getByTestId('live-experiment-feedback').click();
  await expect(guide).toBeVisible();
  await expect(page.locator('#firstRunGuide')).toBeHidden();
  await expect(guide.locator('[data-guide-action="storm"]')).toBeEnabled();
  await guide.locator('[data-guide-action="storm"]').click();
  await expect(guide.locator('[data-guide-kind]')).toHaveText('Storm result');
  await expect(guide.locator('[data-guide-metrics]')).toContainText('Flooded parcels');
  await expect(page.locator('#overlayMode')).toHaveValue('flood');
  await guide.locator('[data-guide-action="week"]').click();
  await expect(guide.locator('[data-guide-kind]')).toHaveText('Paired weekly result',{timeout:90000});
  await expect(guide.locator('[data-guide-metrics]')).toContainText('Well-being difference');
  await expect(guide.locator('[data-guide-metrics]')).toContainText('Residents better off');
});
