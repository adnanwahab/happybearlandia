import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
const path='/world?people=30&quality=LOW';
async function ready(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(path);await page.waitForFunction(()=>window.hblWorldActivity&&window.hblPersonCommands,null,{timeout:90000});expect(await page.evaluate(()=>Boolean(navigator.gpu))).toBe(true);expect(await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().backend)).toBe('webgpu');return errors;}
test('launch shell navigation, named controls, real dialogue, play commands and keyboard pause',async({page})=>{
 test.setTimeout(180000);const errors=await ready(page);
 await expect(page.locator('#launch-navigation')).toBeVisible();
 const inventory=await page.locator('button:visible').evaluateAll(buttons=>buttons.map(b=>({label:b.getAttribute('aria-label')||b.textContent.trim(),id:b.id,action:b.dataset.launch??b.dataset.launchSpeed??(b.id==='world-guide-button'?'start':b.id==='activity-dashboard-button'?'activity':b.hasAttribute('data-world-sound')?'sound':null),disabled:b.disabled})));await writeFile('artifacts/she-789/visible-button-inventory.json',JSON.stringify(inventory,null,2));
 for(const row of inventory)expect(row.action||row.label==='Toggle FPS meter').toBeTruthy();
 await page.locator('[data-launch=sound]').click();await expect(page.locator('[data-launch=sound]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-launch=sound]').click();await expect(page.locator('[data-launch=sound]')).toHaveAttribute('aria-pressed','false');
 const fps=page.getByRole('button',{name:'Toggle FPS meter'});const shown=await fps.getAttribute('aria-pressed');await fps.click();expect(await fps.getAttribute('aria-pressed')).not.toBe(shown);
 const unnamed=await page.locator('button:visible').evaluateAll(buttons=>buttons.filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('aria-labelledby')).map(b=>b.outerHTML));expect(unnamed).toEqual([]);
 for(const action of ['people','quests','legends','search','time']){await page.locator(`[data-launch="${action}"]`).first().click();await expect(page.locator('#launch-panel')).toBeVisible();await expect(page.locator('#launch-panel [data-launch-content]')).not.toBeEmpty();await page.keyboard.press('Escape');await expect(page.locator('#launch-panel')).toBeHidden();}
 await page.keyboard.press('Control+k');await expect(page.getByRole('searchbox',{name:'Search world actions'})).toBeFocused();await page.keyboard.press('Escape');
 await page.locator('[data-launch=people]').click();await page.locator('.launch-person-list button').first().click();await expect(page.locator('#inspect')).toBeVisible();await expect(page.locator('#inspect')).not.toHaveAttribute('inert','');await expect(page.locator('#inspect')).not.toHaveAttribute('data-world-panel-suppressed','');await expect(page.locator('#inspect')).toContainText('Lives at');await expect(page.locator('#inspect')).toContainText('Works at');await expect(page.locator('#inspect').getByRole('region',{name:'Person needs'})).toBeVisible();
 await page.locator('#world-guide-button').click();await expect(page.locator('#inspect')).toBeVisible();await expect(page.locator('#firstRunGuide')).toBeHidden();
 await page.locator('#activity-dashboard-button').click();await expect(page.getByRole('dialog',{name:'Activity history dashboard'})).toBeVisible();await page.getByRole('dialog',{name:'Activity history dashboard'}).getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('[data-launch=start]').click();await expect(page.locator('#inspect')).toBeVisible();await expect(page.getByRole('button',{name:'Play as resident',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Play as resident',exact:true}).click();expect(await page.evaluate(()=>window.hblPersonCommands.getState().controlled)).toBe(true);
 await page.keyboard.press('d');await expect(page.locator('[data-command-status]')).toContainText(/accepted|traveling|walking|minutes|current trip/i);
 await page.getByRole('button',{name:'Talk / examine',exact:true}).click();await page.getByRole('button',{name:'How are you doing?',exact:true}).click();await expect(page.locator('#launch-panel')).toContainText('Current activity:');await page.getByRole('button',{name:'Where do you live and work?',exact:true}).click();await expect(page.locator('#launch-panel')).toContainText('Home:');await page.keyboard.press('Escape');
 await page.locator('[data-launch=pause]').click();expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(true);await page.keyboard.press('Space');expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(false);await page.keyboard.press('Space');expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().paused)).toBe(true);await page.keyboard.press('2');expect(await page.evaluate(()=>window.hblSimulationPlayback.getState())).toMatchObject({paused:false,speed:2});
 const before=await page.locator('#overlayMode').inputValue();await page.locator('[data-launch=overlay]').click();expect(await page.locator('#overlayMode').inputValue()).not.toBe(before);
 for(const speed of ['1','2','4']){await page.locator(`[data-launch-speed="${speed}"]`).click();expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().speed)).toBe(Number(speed));}
 await page.locator('[data-launch=tiles]').click();await expect(page.getByRole('dialog',{name:'World tile view'})).toBeVisible();await page.getByRole('button',{name:'Close tile view',exact:true}).click();
 await page.locator('[data-launch=world]').click();await expect(page.locator('#top')).toHaveAttribute('open','');await page.keyboard.press('Escape');await page.locator('[data-launch=tools]').click();await expect(page.locator('#top')).toHaveAttribute('open','');await page.keyboard.press('Escape');
 await page.locator('[data-launch=laws]').click();await expect(page.getByRole('dialog',{name:'Choose a law',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('[data-launch=build]').click();await expect(page.locator('.bw-world-tools')).toHaveAttribute('open','');await page.locator('.bw-world-tools').evaluate(el=>el.open=false);
 await page.locator('[data-launch=activity]').click();await expect(page.getByRole('dialog',{name:'Activity history dashboard'})).toBeVisible();await page.getByRole('dialog',{name:'Activity history dashboard'}).getByRole('button',{name:'Close',exact:true}).click();
 await page.screenshot({path:'artifacts/she-789/ui-desktop.png'});expect(errors).toEqual([]);
});
test('mobile navigation and panel stay within viewport',async({page})=>{test.setTimeout(120000);await page.setViewportSize({width:390,height:844});const errors=await ready(page);await page.locator('[data-launch=people]').click();await expect(page.locator('#launch-panel')).toBeVisible();const bounds=await page.locator('#launch-panel').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);expect(bounds.y).toBeGreaterThanOrEqual(70);await page.screenshot({path:'artifacts/she-789/ui-mobile.png'});expect(errors).toEqual([]);});

test('People fills when the first observation arrives while preserving search and focus',async({page})=>{
 test.setTimeout(120000);const errors=await ready(page);
 const query=await page.evaluate(()=>{
  const source=window.hblWorldTileSource,read=source.getFrame.bind(source),initial=read();
  const query=String(initial.people[0].name??initial.people[0].id);let released=false;
  // Delay only the presentation observation, never the actual simulation.
  source.getFrame=()=>{const frame=read();return released?frame:{...frame,people:[]};};
  window.__releasePeopleObservation=()=>{released=true;};return query;
 });
 await page.locator('[data-launch=people]').click();
 const search=page.getByRole('searchbox',{name:'Find a resident'});
 await search.fill(query);await expect(search).toBeFocused();
 await expect(page.locator('.launch-person-list button')).toHaveCount(0);
 await page.evaluate(()=>window.__releasePeopleObservation());
 await expect(page.locator('.launch-person-list button').first()).toBeVisible();
 await expect(page.locator('.launch-person-list button').first()).toContainText(query);
 await expect(search).toHaveValue(query);await expect(search).toBeFocused();
 expect(errors).toEqual([]);
});
