import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
for (const mobile of [false,true]) test(`trade-offs normal entry ${mobile?'mobile':'desktop'}`,async({page,context})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 const size=mobile?'mobile':'desktop', dir='.mini-symphony-evidence';mkdirSync(dir,{recursive:true});
 // Serve the actual baseline sources for before evidence; all data is disposable.
 const paths=['world/decision.html','world/decision/studio.js','world/decision/studio.css'];
 for(const path of paths) await page.route(`**/${path}`,route=>route.fulfill({body:execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}),contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'}));
 await page.goto('/world/decision.html');await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await page.locator('#futures').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/SHE-509-decision-before-${size}.png`});
 await page.unrouteAll({behavior:'wait'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/decision.html');await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await expect(page.locator('[data-tradeoff]')).toHaveCount(3);
 await expect(page.locator('#policy-tradeoffs')).toContainText('Missing data is not a tie');
 await page.locator('#try-example').click();await page.locator('#auto-preview').uncheck();
 await page.locator('#run-count').selectOption('10');await page.locator('#run-experiment').click();
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio.state.experiment?.status)).toBe('completed');
 await expect(page.locator('#policy-tradeoffs a').first()).toBeVisible();
 const a=page.locator('#policy-tradeoffs a').first();await a.focus();
 const opening=context.waitForEvent('page');await a.press('Enter');const source=await opening;await source.waitForLoadState();expect(await source.locator('body').innerText()).toContain('modelVersion');await source.close();
 await page.locator('#policy-tradeoffs').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/SHE-509-decision-after-${size}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const before=await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.state.summaryResults));
 for(let i=0;i<12;i++) {await page.locator('#building-month').fill(String(i));await page.locator('#building-month').dispatchEvent('input');}
 await page.locator('#building-world').dispatchEvent('wheel',{deltaY:150});
 expect(await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.state.summaryResults))).toBe(before);
 // pagehide releases the renderer, pending traces, watcher and playback timer.
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 await expect(page.locator('#building-world canvas')).toHaveCount(0);
 expect(errors).toEqual([]);await page.goto('/');
});
