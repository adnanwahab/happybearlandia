import {test,expect} from '@playwright/test';

test('World normal entry exposes honest missing source without inventing trips',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/area?**',route=>route.fulfill({json:{source:'none',buildings:[],roads:[],pois:[]}}));
 await page.goto('/world?demo=1&synthetic=1&people=16&seed=42&quality=LOW');
 try{await page.waitForFunction(()=>window.hblTripFireflies?.getState().updates>0,null,{timeout:30000});}catch(error){throw Error(`${error.message}; page errors: ${JSON.stringify(errors)}`);}
 await page.getByRole('button',{name:'More tools',exact:true}).click();
 await page.locator('#worldAdvanced > summary').click();
 await page.locator('#commuter-fireflies > summary').click();
 await expect(page.locator('#commuter-fireflies')).toContainText('Modeled active trips: unavailable');
 await expect(page.locator('#commuter-fireflies')).toContainText('Living Population trip source unavailable');
 await page.locator('#commuter-fireflies input').check();
 expect(await page.evaluate(()=>window.hblTripFireflies.getState().allocatedMarkers)).toBe(0);
});

test('representative source receipt: pointer/keyboard, pause, revision isolation and disposal',async({page},info)=>{
 await page.route('**/__trip-fireflies-representative',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main><h1>Commuter marker contract diagnostic</h1><p>Authored representative source records, not observed people or the dense GPU City X-Ray effect.</p><div id="fixture-fireflies"></div></main>'}));
 await page.goto('/__trip-fireflies-representative');
 await page.evaluate(async()=>{
  const {mountTripFireflies}=await import('/world/population/fireflies.js');
  const route={kind:'mapped-sidewalk',rulesVersion:'sidewalks.v1',points:[[0,0],[10,0]],distanceMetres:10};
  const frame={minute:1080,effectiveConfig:{seed:42},modelVersion:'fixture.v1',runtime:{id:'fixture',revision:1},metrics:{activeTrips:1200},visibleAgents:[{id:'fixture-p0',weight:10,trip:{schemaVersion:'population-current-trip.v1',departureMinute:1070,remainingMinutes:10,progress:.5,route}}]};
  const container=document.querySelector('#fixture-fireflies');let selected=null;
  const ui=mountTripFireflies({container,controls:container,getFrame:()=>window.fixtureFireflies.frame,project:()=>({x:innerWidth/2,y:innerHeight*.6}),onSelect:id=>selected=id});
  window.fixtureFireflies={ui,container,frame,getSelected:()=>selected};container.querySelector('details').open=true;container.querySelector('input').checked=true;
  ui.update(100);const before=JSON.stringify(ui.getState().latest);ui.update(116);if(before!==JSON.stringify(ui.getState().latest))throw Error('Pause drift');
 });
 const marker=page.getByRole('button',{name:'Inspect source trip fixture-p0, departure 1070',exact:true});
 await marker.click();expect(await page.evaluate(()=>window.fixtureFireflies.getSelected())).toBe('fixture-p0');
 await expect(page.locator('#fixture-fireflies pre')).toContainText('"departureMinute": 1070');await expect(page.locator('#fixture-fireflies')).toContainText('Sampling weights unknown');
 await marker.focus();await page.keyboard.press('Enter');await expect(page.locator('#fixture-fireflies pre')).toContainText('"modelVersion": "fixture.v1"');
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.fixtureFireflies.ui.update(132));await page.screenshot({path:info.outputPath(`${name}-representative.png`),fullPage:true});}
 await page.evaluate(()=>{const f=window.fixtureFireflies;f.frame=structuredClone(f.frame);f.frame.runtime.revision++;f.ui.update(148);});
 await expect(page.locator('#fixture-fireflies pre')).toHaveText('');
 await page.evaluate(()=>{const f=window.fixtureFireflies;f.frame=null;f.ui.update(164);});await expect(marker).toBeHidden();
 const disposal=await page.evaluate(()=>{const {ui,container}=window.fixtureFireflies;ui.destroy();ui.destroy();return{state:ui.getState(),children:container.children.length};});
 expect(disposal.state.allocatedMarkers).toBe(0);expect(disposal.children).toBe(0);
});
