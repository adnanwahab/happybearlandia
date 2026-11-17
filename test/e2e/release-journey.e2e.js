import { expect, test } from '@playwright/test';

async function savedFutureNavigation(page) {
  // The graphics-only fallback must retain a visible exit to the exact save.
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  const navigation = page.getByRole('navigation', { name: 'Saved future', exact: true });
  await expect(navigation).toBeVisible({ timeout: 45000 });
  const targets=await navigation.getByRole('link').evaluateAll(links=>links.map(link=>{
    const r=link.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {label:link.textContent,hit:link.contains(hit),inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
  }));
  for(const target of targets){expect(target.inViewport,target.label+' stays in viewport').toBe(true);expect(target.hit,target.label+' has an unobstructed pointer target').toBe(true);}
  const overlaps=await navigation.evaluate(nav=>{
    const a=nav.getBoundingClientRect();
    return ['#launch-navigation','.person-commands','[data-testid=living-person]','#inspect'].filter(selector=>{
      const node=document.querySelector(selector);if(!node)return false;const b=node.getBoundingClientRect();
      return b.width>0&&b.height>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    });
  });
  expect(overlaps,'saved exits do not cover or sit behind resident controls').toEqual([]);
  await page.screenshot({path:test.info().outputPath('saved-navigation-'+page.viewportSize().width+'.png')});
  return navigation;
}

test('an exact Living World future survives World, House, replay and a matched fork', async ({ page, request }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/');
  const moreTools = page.getByText('More worlds and tools', { exact: true });
  const toolsDisclosure = page.locator('details').filter({ has: moreTools });
  await expect(moreTools).toBeVisible();
  await expect(toolsDisclosure).not.toHaveAttribute('open', '');
  // The flagship stays primary; preserved experimental tools open through the
  // visible disclosure using its native keyboard interaction.
  await moreTools.focus();
  await expect(moreTools).toBeFocused();
  await moreTools.press('Enter');
  await expect(toolsDisclosure).toHaveAttribute('open', '');
  await page.getByRole('link', { name: 'Try Today’s Features', exact: true }).click();
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const original = await (await request.get('/api/world-experiments/' + parent)).json();
  const person = new URL(page.url()).searchParams.get('person');
  const canonical = new URL(page.url());
  canonical.searchParams.delete('experiment');
  canonical.searchParams.delete('person');
  await page.goto(canonical.href);
  await expect(page.locator('#clock')).toContainText('Minute 360');

  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  // Without WebGPU, World intentionally opens the geometry-only WebGL2 viewer.
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  await expect.poll(() => page.evaluate(() => window.hblStaticCity?.getState()?.ready), { timeout: 45000 }).toBe(true);
  await expect(page.locator('#provenance')).toContainText('1 buildings');
  await expect(page.locator('#provenance')).toContainText('Saved synthetic geometry');
  await expect(page.locator('#saved-scope')).toContainText('not a checkpoint replay');

  expect(new URL(page.url()).searchParams.get('entityId')).toBe('person:population:' + person);
  const navigation = await savedFutureNavigation(page);
  await navigation.getByRole('link', { name: 'Return to Worldline' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);

  // The Worldline entry keeps the authoritative saved House destination.
  await page.getByRole('link', { name: 'Open exact household in House Simulator' }).click();
  await expect(page.getByRole('heading', { name: 'Live a day as Alex Rivera' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to Worldline' })).toHaveAttribute('href', new RegExp('experiment=' + parent));
  await page.getByRole('link', { name: 'Return to Worldline' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);

  await page.getByLabel('Change summary').fill('Compare more rain');
  await page.getByRole('button', { name: 'Run matched remix and save child' }).click();
  await expect(page.locator('#pair')).toContainText('Tick 361');
  const child = new URL(page.url()).searchParams.get('experiment');
  expect(child).not.toBe(parent);
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('hbl-private-remix:' + id)), child);
  await expect(page.locator('#lineage')).toContainText(parent);
  await page.screenshot({path: '.mini-symphony-evidence/SHE-584-after-desktop.png', fullPage: true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: '.mini-symphony-evidence/SHE-584-after-mobile.png', fullPage:true});
  expect(saved.parentId).toBe(parent);
  expect((await (await request.get('/api/world-experiments/' + parent)).json()).checksum).toBe(original.checksum);
  await page.locator('#timeline').press('Home');
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.reload();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.locator('#timeline').press('End');
  await expect(page.locator('#pair')).toContainText('Tick 361');

  await page.locator('#timeline').press('Home');
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.getByLabel('Change summary').fill('Compare more rain');
  await page.getByRole('button', { name: 'Run matched remix and save child' }).click();
  await expect(page.locator('#pair')).toBeVisible();
  const replayedId = new URL(page.url()).searchParams.get('experiment');
  expect(replayedId).not.toBe(child);
  const replayed = await page.evaluate(id => JSON.parse(localStorage.getItem('hbl-private-remix:' + id)), replayedId);
  expect(replayed.parentId).toBe(parent);
  expect(replayed.save.view.journeyFork).toEqual(saved.save.view.journeyFork);
  expect(replayed.save.checkpoint).toEqual(saved.save.checkpoint);
});

test('invalid IDs and missing saved checkpoints are visible', async ({ page }) => {
  await page.goto('/tools/future-journey.html?experiment=bad');
  await expect(page.getByRole('status').filter({ hasText: 'Invalid saved experiment ID.' })).toBeVisible();
  await page.goto('/tools/future-journey.html?experiment=missing0001');
  await expect(page.getByRole('status').filter({ hasText: 'Saved checkpoint is missing.' })).toBeVisible();
});

test('saved WebGL2 city on a phone retains the exact checkpoint link without claiming replay', async ({ page }, testInfo) => {

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/future-journey.html');
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const person = new URL(page.url()).searchParams.get('person');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (/^\/world\/?$/.test(location.pathname)) {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    }
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  await expect.poll(() => page.evaluate(() => window.hblStaticCity?.getState()?.ready), { timeout: 45000 }).toBe(true);
  await expect(page.locator('#view canvas')).toBeVisible();
  await expect(page.locator('#provenance')).toContainText('1 buildings');
  await expect(page.locator('#provenance')).toContainText('Saved synthetic geometry');
  await expect(page.locator('#saved-scope')).toContainText('not a checkpoint replay');

  const navigation = await savedFutureNavigation(page);
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('entityId')).toBe('person:population:' + person);
  const state = await page.evaluate(() => window.hblStaticCity.getState());
  expect(state).toMatchObject({ backend: 'webgl2', viewOnly: true, people: 0, simulation: false, buildings: 1 });
  expect(state.minute).toBeUndefined();
  expect(await page.evaluate(() => ({
    living: typeof window.hblLivingWorld, playback: typeof window.hblSimulationPlayback,
  }))).toEqual({ living: 'undefined', playback: 'undefined' });
  expect(errors).toEqual([]);
  await testInfo.attach('saved-city-webgl2-fallback', { body: JSON.stringify({ parent, person, state, errors }, null, 2), contentType: 'application/json' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('saved-city-webgl2-phone.png') });

  await navigation.getByRole('link', { name: 'Return to Worldline' }).click();
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);
  await expect(page.locator('#clock')).toContainText('Minute 360');
});

// Even with no graphics backend, a saved resident must retain a way home.
test('saved World offers an exact return when every graphics backend is unavailable', async ({ page }) => {

  await page.goto('/tools/future-journey.html');
  await page.getByRole('button',{name:'Create a guided demo checkpoint'}).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent=new URL(page.url()).searchParams.get('experiment');
  const person=new URL(page.url()).searchParams.get('person');
  const original=await (await request.get('/api/world-experiments/'+parent)).json();
  const requests=[],errors=[];
  page.on('request',r=>requests.push(new URL(r.url()).pathname));
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...options) {
      return type === 'webgl2' ? null : context.call(this, type, ...options);
    };
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  await expect(page.getByRole('alert')).toContainText('WebGL2 is unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(await page.evaluate(() => window.hblStaticCity)).toBeUndefined();
  const navigation = await savedFutureNavigation(page);
  await navigation.getByRole('link', { name: 'Return to Worldline' }).click();

  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);
});

test('missing WebGPU and WebGL2 retain explicit recovery without a replacement model',async({page})=>{
  await page.goto('/tools/future-journey.html');
  await page.getByRole('button',{name:'Create a guided demo checkpoint'}).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent=new URL(page.url()).searchParams.get('experiment');
  const person=new URL(page.url()).searchParams.get('person');
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
    window.__releaseWorkers=0;const Native=window.Worker;
    window.Worker=class extends Native{constructor(...args){window.__releaseWorkers++;super(...args);}};
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};
  });
  await page.getByRole('link',{name:'Enter this future in 3D World'}).click();
  await expect(page).toHaveURL(/\/world\/static-city\.html/);
  await expect(page.getByRole('alert')).toContainText('WebGL2 is unavailable');
  await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Fit city'})).toBeDisabled();
  expect(await page.evaluate(()=>({workers:window.__releaseWorkers,model:typeof window.hblLivingWorld,clock:typeof window.hblSimulationPlayback,view:typeof window.hblStaticCity}))).toEqual({workers:0,model:'undefined',clock:'undefined',view:'undefined'});
  const full=new URL(await page.getByRole('link',{name:'Try the full game'}).getAttribute('href'),page.url());
  expect(full.searchParams.get('experiment')).toBe(parent);expect(full.searchParams.get('person')).toBe(person);
  await page.goBack();await expect(page.locator('#clock')).toContainText('Minute 360');
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
});
