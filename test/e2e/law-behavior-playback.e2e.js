import {test,expect} from '@playwright/test';

/** This is a real browser/Worker test, without World Diff network loading, an iframe, or mock model outputs. */
test('numeric law edit reruns true paired actors and scrubs actual worker frames',async({page})=>{
  test.setTimeout(120000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:940,height:800});
  await page.route('**/__law-behavior-qa',route=>route.fulfill({
    contentType:'text/html',body:'<!doctype html><html><meta charset="utf-8"><title>Law playback worker QA</title><div id="root"></div></html>'
  }));
  await page.goto('/__law-behavior-qa');
  await page.evaluate(async()=>{
    const {mountLawPanel}=await import('/world/laws/law-panel.js');
    const {getLaw}=await import('/world/laws/catalog.js');
    window.__testLaw=getLaw;
    window.__lawPanel=mountLawPanel(document.querySelector('#root'),{
      getContext:()=>({seed:42,population:24,minutes:120,
        worldContext:{districts:[{id:'west',x:0,z:0},{id:'east',x:1500,z:0}]}})
    });
    window.__lawPanel.open();
    window.__lawPanel.selectLaw(getLaw(83));
  });
  const panel=page.getByTestId('law-panel'),viewer=page.getByTestId('law-behavior-playback');
  await expect(viewer).toBeVisible({timeout:60000});
  await expect(viewer.locator('svg polyline')).toHaveCount(2);
  await expect(viewer.locator('iframe, img')).toHaveCount(0);
  const original=await page.evaluate(()=>window.__lawPanel.getComparison());
  expect(original?.engine).toBe('population');
  expect(original.manifest.selectedConfig.transitService).toBe(1.5);
  expect(original.manifest.initialConfig.transitService).toBe(1);
  expect(original.baseline.timeline.length).toBeGreaterThan(1);
  expect(original.selected.timeline.at(-1).actors[0].id).toBe(original.baseline.timeline.at(-1).actors[0].id);
  const strength=panel.getByLabel('Implementation strength percent');
  await expect(strength).toHaveValue('100');
  await strength.evaluate(element=>{
    element.value='50';
    element.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__lawPanel.getComparison()?.manifest?.implementationStrength),{
    timeout:60000
  }).toBe(.5);
  await expect(viewer).toContainText('implementation strength 50%');
  const edited=await page.evaluate(()=>window.__lawPanel.getComparison());
  expect(edited.manifest.selectedConfig.transitService).toBe(1.25);
  expect(edited.manifest.seed).toBe(original.manifest.seed);
  expect(edited.baseline.timeline).toEqual(original.baseline.timeline);
  await expect(viewer.locator('.law-behavior-reference')).toContainText('Original 100% reviewed setting');
  const scrub=viewer.getByLabel('Recorded simulation checkpoint');
  await expect(scrub).toHaveValue(String(edited.baseline.timeline.length-1));
  await scrub.evaluate(element=>{
    element.value='0';element.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await expect(viewer.locator('.law-behavior-clock')).toContainText('Minute 0');
  const valueBefore=await viewer.locator('.law-behavior-clock').innerText();
  await viewer.getByRole('button',{name:/Play recorded frames/}).click();
  await expect.poll(async()=>await viewer.locator('.law-behavior-clock').innerText(),{
    timeout:12000
  }).not.toBe(valueBefore);
  await viewer.screenshot({path:test.info().outputPath('real-law-behavior.png')});
  // Unsupported proposals never inherit prior frames or an editable strength control.
  await page.evaluate(()=>window.__lawPanel.selectLaw(window.__testLaw(31)));
  await expect(viewer).toBeHidden();
  await expect(panel.locator('.law-lever-editor')).toBeHidden();
  await expect(panel.getByRole('status')).toContainText('Effects unavailable');
  expect(errors).toEqual([]);
});

test('monthly policy actor samples remain month-aligned without claiming real housing changes',async({page})=>{
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/__law-city-qa',route=>route.fulfill({
    contentType:'text/html',body:'<!doctype html><html><meta charset="utf-8"><title>Law city worker QA</title><div id="root"></div></html>'
  }));
  await page.goto('/__law-city-qa');
  await page.evaluate(async()=>{
    const {mountLawPanel}=await import('/world/laws/law-panel.js');
    const {getLaw}=await import('/world/laws/catalog.js');
    window.__lawPanel=mountLawPanel(document.querySelector('#root'),{
      getContext:()=>({seed:42,population:12,months:4,
        worldContext:{districts:[{id:'west',x:0,z:0},{id:'east',x:1500,z:0}]}})
    });
    window.__lawPanel.open();
    window.__lawPanel.selectLaw(getLaw(22));
  });
  const viewer=page.getByTestId('law-behavior-playback');
  await expect(viewer).toBeVisible({timeout:60000});
  const first=await page.evaluate(()=>window.__lawPanel.getComparison());
  expect(first.engine).toBe('city');
  expect(first.baseline.timeline.map(row=>row.month)).toEqual([0,1,2,3,4]);
  expect(first.baseline.timeline.every(row=>row.actors.length>0)).toBe(true);
  await expect(viewer.locator('.law-behavior-clock')).toContainText('Month 4');
  await expect(viewer).toContainText('Household state differences');
  const input=page.getByLabel('Implementation strength percent');
  await input.evaluate(element=>{element.value='50';element.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect.poll(()=>page.evaluate(()=>window.__lawPanel.getComparison()?.manifest?.implementationStrength),{
    timeout:60000
  }).toBe(.5);
  const revised=await page.evaluate(()=>window.__lawPanel.getComparison());
  expect(revised.manifest.selectedParameters.constructionCost).toBeCloseTo(
    revised.manifest.initialParameters.constructionCost*.95,6);
  expect(revised.baseline.timeline).toEqual(first.baseline.timeline);
  expect(viewer).toBeTruthy();
});
