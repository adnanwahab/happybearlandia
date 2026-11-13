import {test, expect} from '@playwright/test';

for (const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:1024},{width:1280,height:784},{width:1520,height:784},{width:1920,height:1080}]) {
  test(`World HUD ${viewport.width}px`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/world?renderer=webgl');
    const dock = page.getByRole('region', {name:'World explorer'});
    await expect(page.locator('#firstRunGuide')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dock).toBeVisible();
    await expect(page.locator('.bw-world-tools')).toBeVisible();
    await expect(page.getByTestId('scrapbook-button')).toBeVisible();
    async function checkLaunchers() {
      const controls = page.locator('#world-quick-toolbar button, .world-utilities button, .world-utilities>a, #top>summary, .bw-world-tools>summary, .explorer-dock button');
      const measurements = [];
      for (const node of await controls.all()) {
        if (!await node.isVisible()) continue;
        await node.scrollIntoViewIfNeeded();
        const result = await node.evaluate(el => {
          const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {text:el.textContent, x:r.x,y:r.y,width:r.width,height:r.height,receivesPointer:el===hit||el.contains(hit)};
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
    // Mask only the live scene and dynamic playback facts, never HUD controls.
    const screenshot = name => expect(page).toHaveScreenshot(`${viewport.width}-world-${name}.png`, {
      mask:[page.locator('#view'),page.locator('#world-playback-facts'),page.locator('#world-first-run-guide'),page.locator('#world-stream-status'),page.locator('#loading')],
    });
    await screenshot('expanded');
    await dock.getByRole('button',{name:'1 · Choose a place',exact:true}).click();
    await dock.getByRole('button',{name:'2 · Try a policy',exact:true}).click();
    await expect(dock).toHaveClass(/is-collapsed/);
    await expect(dock.getByRole('button',{name:'Explore neighborhood',exact:true})).toBeVisible();
    const top = page.locator('#top'), storm = page.getByRole('button',{name:'Storm',exact:true});
    await expect(storm).toBeEnabled();
    await storm.scrollIntoViewIfNeeded();
    const before = await top.evaluate(el=>el.scrollTop);
    await storm.click();
    await expect.poll(()=>top.evaluate(el=>el.scrollTop)).toBe(before);
    await screenshot('collapsed');
    await dock.getByRole('button',{name:'Dismiss',exact:true}).click();
    await expect(dock).toBeHidden();
    await checkLaunchers();
  });
}
