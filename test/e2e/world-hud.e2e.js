import {test, expect} from '@playwright/test';

const viewports=[
  {width:320,height:640},{width:390,height:844},{width:768,height:1024},
  {width:1280,height:784},{width:1520,height:784},{width:1920,height:1080},
];
const primarySelector='#launch-navigation button, #launch-playback button, #world-quick-toolbar button, .fps-meter-toggle';

for(const viewport of viewports){
 test(`World HUD ${viewport.width}px`,async({page},info)=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize(viewport);
  await page.goto('/world?people=30&quality=LOW&seed=42',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.hblCityRenderer&&window.hblPersonCommands,null,{timeout:90000});
  expect(await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().backend)).toBe('webgpu');
  // Freeze actual model observations, leaving the native scene/camera live. This
  // prevents activity text from changing between otherwise-identical UI goldens.
  await page.evaluate(()=>window.hblSimulationPlayback.pause());
  await expect(page.locator('#launch-navigation')).toBeVisible();
  await expect(page.locator('#firstRunGuide')).toBeHidden();
  await expect(page.locator('.explorer-dock')).toBeHidden();
  await expect(page.locator(primarySelector)).toHaveCount(21);

  async function checkControls(state){
   const measurements=[];
   for(const control of await page.locator(primarySelector).all()){
    await expect(control).toHaveAccessibleName(/\S/);
    await expect(control).toBeEnabled();
    // The mobile navigation is intentionally horizontal. Scroll each control
    // into view, then check its actual hit target rather than its DOM existence.
    await control.scrollIntoViewIfNeeded();
    await control.click({trial:true});
    const result=await control.evaluate(element=>{
     const rect=element.getBoundingClientRect();
     const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
     return{label:element.getAttribute('aria-label')||element.textContent.trim(),x:rect.x,y:rect.y,width:rect.width,height:rect.height,receivesPointer:element===hit||element.contains(hit)};
    });
    expect(result.receivesPointer,result.label).toBe(true);
    expect(result.x,result.label).toBeGreaterThanOrEqual(-1);
    expect(result.y,result.label).toBeGreaterThanOrEqual(-1);
    expect(result.x+result.width,result.label).toBeLessThanOrEqual(viewport.width+1);
    expect(result.y+result.height,result.label).toBeLessThanOrEqual(viewport.height+1);
    measurements.push(result);
   }
   await info.attach(`HUD ${state} bounds`,{body:JSON.stringify({viewport,measurements},null,2),contentType:'application/json'});
  }
  async function resetNavigationScroll(){
   await page.locator('#launch-navigation').evaluate(element=>{element.scrollLeft=0;element.scrollTop=0;});
  }
  const screenshot=async state=>{
   await resetNavigationScroll();
   // toHaveScreenshot accepts stylePath, not page.screenshot's inline style.
   // Apply the temporary style explicitly so every browser actually hides the
   // live canvas while preserving the overlay controls and their hit geometry.
   const freeze=await page.addStyleTag({content:'#view canvas{visibility:hidden!important} #view{background:#27303b!important} .world-fps-meter output{display:inline-block;width:160px} [data-launch-clock]{width:120px}'});
   try{
    await expect(page).toHaveScreenshot(`${viewport.width}-world-${state}.png`,{
     mask:[page.locator('.world-fps-meter output'),page.locator('#clock'),page.locator('[data-launch-clock]'),page.locator('#loading')],
    });
   }finally{await freeze.evaluate(element=>element.remove());}
  };

  await checkControls('initial-shell');
  await screenshot('initial-shell');
  await page.locator('[data-launch=people]').scrollIntoViewIfNeeded();
  await page.locator('[data-launch=people]').click();
  const panel=page.getByRole('dialog',{name:'World explorer panel'});
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading',{name:'Meet the residents'})).toBeVisible();
  await expect(panel.getByRole('searchbox',{name:'Find a resident'})).toBeVisible();
  expect(await panel.locator('.launch-person-list button').count()).toBeGreaterThan(0);
  const bounds=await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+1);
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height+1);
  // Search is a real interaction: filtering to an impossible identity yields
  // no resident rows; clearing restores source-backed clickable observations.
  const search=panel.getByRole('searchbox',{name:'Find a resident'});
  await search.fill('no-such-observed-resident-identity');
  await expect(panel.locator('.launch-person-list button')).toHaveCount(0);
  await search.fill('');
  await panel.locator('.launch-person-list button').first().click({trial:true});
  await screenshot('people-panel');
  await panel.getByRole('button',{name:'Close panel',exact:true}).click();
  await expect(panel).toBeHidden();
  await checkControls('after-dismiss');
  expect(errors).toEqual([]);
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
