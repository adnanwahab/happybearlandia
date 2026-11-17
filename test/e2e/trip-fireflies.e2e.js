import {test,expect} from '@playwright/test';
test('World exposes honest missing state; representative particles inspect and dispose',async({page})=>{
 await page.goto('/world?source=none&seed=42&living=1');
 await page.waitForFunction(()=>window.hblTripFireflies&&window.hblLivingWorld?.getRuntime()?.getSnapshot());
 await page.evaluate(()=>{document.querySelector('#top').open=true;document.querySelector('#worldAdvanced').open=true;document.querySelector('#commuter-fireflies').open=true;});
 await expect(page.locator('#commuter-fireflies')).toContainText('Modeled active trips:');
 await page.locator('#commuter-fireflies input').check();
 const receipt=await page.evaluate(async()=>{
  const {mountTripFireflies}=await import('/world/population/fireflies.js');
  // Authored representative fixture, detached from the live authority.
  const route={kind:'mapped-sidewalk',rulesVersion:'sidewalks.v1',points:[[0,0],[10,0]],distanceMetres:10};
  const frame={minute:1080,effectiveConfig:{seed:42},modelVersion:'fixture.v1',runtime:{id:'fixture',revision:1},metrics:{activeTrips:1200},visibleAgents:[{id:'fixture-p0',weight:10,trip:{schemaVersion:'population-current-trip.v1',departureMinute:1070,remainingMinutes:10,progress:.5,route}}]};
  const container=document.createElement('div');container.id='fixture-fireflies';document.body.append(container);
  let selected=null;const ui=mountTripFireflies({container,controls:container,getFrame:()=>frame,project:()=>({x:700,y:400}),onSelect:id=>selected=id});
  container.querySelector('details').open=true;container.querySelector('input').checked=true;
  ui.update(100);const first=JSON.stringify(ui.getState().latest);ui.update(116);if(first!==JSON.stringify(ui.getState().latest))throw Error('Pause drift');
  container.querySelector('button').click();const text=container.textContent;
  window.fixtureFireflies={ui,container};return {selected,text};
 });
 expect(receipt.selected).toBe('fixture-p0');expect(receipt.text).toContain('"departureMinute": 1070');expect(receipt.text).toContain('Sampling weights unknown');
 await page.screenshot({path:'test-results/trip-fireflies/representative.png'});
 const disposal=await page.evaluate(()=>{const {ui,container}=window.fixtureFireflies;ui.destroy();ui.destroy();return{state:ui.getState(),children:container.children.length};});
 expect(disposal.state.allocatedMarkers).toBe(0);expect(disposal.children).toBe(0);
});
