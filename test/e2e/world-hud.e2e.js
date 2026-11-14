import {test, expect} from '@playwright/test';

for (const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:1024},{width:1280,height:784},{width:1520,height:784},{width:1920,height:1080}]) {
  test(`World HUD ${viewport.width}px`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/world?renderer=webgl&demo=1&synthetic=1&people=16&seed=263');
    const dock = page.getByRole('region', {name:'World explorer'});
    await expect(page.locator('#firstRunGuide')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dock).toBeVisible();
    await expect(page.locator('.bw-world-tools')).toBeVisible();
    await expect(page.getByTestId('scrapbook-button')).toBeVisible();
    async function checkLaunchers() {
      const controls = page.locator('#world-quick-toolbar button, .world-utilities button, .world-utilities a, .world-utilities summary, #top>summary, .bw-world-tools>summary, .explorer-dock button, .explorer-home');
      const measurements = [];
      for (const node of await controls.all()) {
        if (!await node.isVisible()) continue;
        await node.scrollIntoViewIfNeeded();
        const result = await node.evaluate(el => {
          const r = el.getBoundingClientRect();
          // Check edges as well as the center: partial occlusion was the bug.
          const receivesPointer = [[.1,.1],[.9,.1],[.5,.5],[.1,.9],[.9,.9]].every(([x,y]) => {
            const hit = document.elementFromPoint(r.x+r.width*x,r.y+r.height*y);
            return el===hit||el.contains(hit);
          });
          return {text:el.textContent, x:r.x,y:r.y,width:r.width,height:r.height,receivesPointer};
        });
        expect(result.receivesPointer, result.text).toBe(true);
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeGreaterThanOrEqual(0);
        expect(result.x+result.width).toBeLessThanOrEqual(viewport.width+1);
        expect(result.y+result.height).toBeLessThanOrEqual(viewport.height+1);
        measurements.push(result);
      }
      await info.attach('HUD bounds', {body:JSON.stringify({viewport,measurements},null,2),contentType:'application/json'});
    }
    await checkLaunchers();
    // Hide scene pixels using CSS. Masking #view would paint over the entire
    // viewport, including the HUD that these snapshots must actually inspect.
    const screenshot = name => expect(page).toHaveScreenshot(`${viewport.width}-world-${name}.png`, {
      style:'#view canvas { visibility: hidden !important; }',
      mask:[page.locator('#world-playback-facts'),page.locator('#world-stream-status'),page.locator('#loading')],
    });
    await screenshot('expanded');
    await dock.getByRole('button',{name:'1 · Choose a place',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Choose a place',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close place picker',exact:true}).click();
    await dock.getByRole('button',{name:'2 · Try a policy',exact:true}).click();
    await expect(dock).toHaveClass(/is-collapsed/);
    await expect(dock.getByRole('button',{name:'Explore neighborhood',exact:true})).toBeVisible();
    await checkLaunchers();
    const top = page.locator('#top'), storm = page.getByRole('button',{name:'Storm',exact:true});
    await expect(storm).toBeEnabled();
    await storm.scrollIntoViewIfNeeded();
    const before = await top.evaluate(el=>el.scrollTop);
    await storm.click();
    await expect(storm).toBeEnabled();
    await expect.poll(()=>top.evaluate(el=>el.scrollTop)).toBe(before);
    await screenshot('collapsed');
    await dock.getByRole('button',{name:'Dismiss',exact:true}).click();
    await expect(dock).toBeHidden();
    await checkLaunchers();
    await screenshot('dismissed');
  });
}

test('World HUD postcard arrival completes onboarding after policy', async ({page}) => {
  await page.goto('/world?renderer=webgl&demo=1&synthetic=1&people=16&seed=263&arrival=1');
  await expect(page.locator('#firstRunGuide')).toBeVisible();
  await page.keyboard.press('Escape');
  const dock = page.getByRole('region', {name:'World explorer'});
  await dock.getByRole('button',{name:'2 · Try a policy',exact:true}).click();
  await expect(dock).toHaveClass(/is-collapsed/);
  await dock.getByRole('button',{name:'Explore neighborhood',exact:true}).click();
  await expect(dock).not.toHaveClass(/is-collapsed/);
  await dock.getByRole('button',{name:'Minimize',exact:true}).click();
  await expect(dock).toHaveClass(/is-collapsed/);
  await dock.getByRole('button',{name:'Dismiss',exact:true}).click();
  await expect(dock).toBeHidden();
});
