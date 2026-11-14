import {test,expect} from '@playwright/test';
const area={source:'osm',origin:{lat:29.7286,lng:-95.4746},buildings:[
 {id:'way/469-A',kind:'home',name:'Pin fixture A',levels:2,pts:[[29.7285,-95.4747],[29.7285,-95.4745],[29.7287,-95.4745],[29.7287,-95.4747]]},
 {id:'way/469-B',kind:'shop',name:'Pin fixture B',pts:[[29.729,-95.4747],[29.729,-95.4745],[29.7292,-95.4745],[29.7292,-95.4747]]}],roads:[],pois:[]};
for(let i=0;i<14;i++)area.buildings.push({...area.buildings[0],id:`fixture-${i}`,pts:area.buildings[0].pts.map(([lat,lng])=>[lat+.001*(i+1),lng+.001])});
for(const mobile of [false,true])test.describe(mobile?'mobile':'desktop',()=>{
 test.use({hasTouch:mobile,isMobile:mobile,viewport:mobile?{width:390,height:844}:{width:1200,height:800}});
 test(`World pinboard exact IDs, empty, incompatible and clear (${mobile?'touch':'keyboard'})`,async({page},info)=>{
 if(mobile){await page.setViewportSize({width:390,height:844});}
 await page.route('**/api/area*',route=>route.fulfill({json:area}));
 await page.goto('/world/?renderer=canvas2d&people=16&seed=469');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 await page.locator('#top > summary').click();
 const host=page.locator('#comparison-pinboard');await host.locator('summary').click();
 await expect(host).toContainText('A: Empty');await expect(host).toContainText('B: Empty');
 await page.screenshot({path:info.outputPath('before-pinning.png')});
 const pin=async(type,id)=>{await host.getByLabel('Entity type').selectOption(type);await host.getByLabel('Source ID').fill(id);
   if(mobile)await host.getByRole('button',{name:'Pin ID',exact:true}).tap();else await host.getByLabel('Source ID').press('Enter');};
 await pin('building','missing');await expect(host.getByRole('status')).toContainText('unavailable');
 await pin('building','way/469-A');await pin('building','way/469-B');
 await expect(host).toContainText('A: building way/469-A');await expect(host).toContainText('B: building way/469-B');
 await expect(host.locator('table')).toContainText('Unavailable');await expect(host).toContainText('seed 469');
 await expect(host.getByRole('status')).toContainText('Normal selection restored');
 await page.screenshot({path:info.outputPath('two-pins.png')});
 await host.getByRole('button',{name:'Clear A',exact:true}).click();await expect(host).toContainText('B: building way/469-B');
 await expect(host.getByRole('status')).toContainText('Normal selection available');
 await pin('person','not-present');await expect(host).toContainText('Object unavailable');
 // Discover the actual synthetic identity from the existing activity read interface.
 const id=await page.evaluate(()=>window.hblWorldActivity.getSnapshot().people[0].id);
 await pin('person',id);await expect(host).toContainText('Different entity types');await expect(host.locator('table')).toHaveCount(0);
});
});
test('component captures scene selections without replacing either pin, bounds repeated capture cost, and reports unmapped models',async({page},info)=>{
 await page.goto('/world/?renderer=canvas2d&people=16&seed=469');await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 const result=await page.evaluate(async()=>{
  const {mountComparisonPinboard}=await import('/world/comparison-pinboard.js');const fixture=document.createElement('div');document.body.append(fixture);
  let available=true;const ui=mountComparisonPinboard(fixture,{available:()=>available,resolve:(type,id)=>({type,id,fields:{area:1},authority:'legacy-world',minute:360,seed:469,source:'Synthetic fixture'})});
  fixture.querySelector('button').click();ui.observe('building','A');ui.observe('building','B');
  const start=performance.now();for(let i=0;i<10000;i++)ui.observe('building','C');const ms=performance.now()-start;
  const text=fixture.textContent;fixture.querySelector('[data-pins] button').click();fixture.querySelector('button').click();available=false;ui.observe('person','population-id');
  return {text,ms,unavailable:fixture.textContent};
 });
 expect(result.text).toContain('A: building A');expect(result.text).toContain('B: building B');expect(result.text).not.toContain('C:');
 expect(result.unavailable).toContain('identities are not mapped');
 await info.attach('capture-cost.json',{body:JSON.stringify({iterations:10000,elapsedMs:result.ms,scope:'inactive pinboard observation only; not whole-world FPS'}),contentType:'application/json'});
});

test('normal Canvas2D scene clicks keep both actual resident IDs',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.route('**/api/area*',route=>route.abort());
 // Observe projected target coordinates only; the real pointer handler chooses the residents.
 await page.route('**/canvas2d-world.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nwindow.__pinSceneTargets=()=>{const c=coords(),r=canvas.getBoundingClientRect(),seen=new Set();return world.people.filter(p=>{const key=p.x+':'+p.z;if(seen.has(key))return false;seen.add(key);return true;}).map(p=>({id:String(p.id),x:r.left+c.x(p.x)*r.width/canvas.width,y:r.top+c.z(p.z)*r.height/canvas.height}));};`});});
 await page.goto('/world/?renderer=canvas2d&people=16&seed=469');await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 await page.locator('#top > summary').click();await page.locator('#speeds button[data-s="0"]').click();
 const host=page.locator('#comparison-pinboard');await host.locator('summary').click();await host.getByRole('button',{name:'Start pinning'}).click();
 const targets=await page.evaluate(()=>window.__pinSceneTargets().filter(p=>p.x>370&&p.x<1100&&p.y>150&&p.y<800));expect(targets.length).toBeGreaterThanOrEqual(2);
 await page.mouse.click(targets[0].x,targets[0].y);await page.mouse.click(targets[1].x,targets[1].y);
 await expect(host.locator('summary')).toContainText(`A: ${targets[0].id}`);await expect(host.locator('summary')).toContainText(`B: ${targets[1].id}`);
 await expect(host.getByRole('status')).toContainText('Normal selection restored');
});
