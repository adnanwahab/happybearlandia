import {test,expect} from '@playwright/test';
const path='/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline&people=30&quality=LOW';
test('People finds an actual outdoor resident and explains an indoor-only observation',async({page})=>{
 await page.goto(path);await page.waitForFunction(()=>window.hblWorldTileSource&&window.hblPersonCommands);
 await page.evaluate(()=>window.hblSimulationPlayback.pause());
 const identity=await page.evaluate(()=>{
  const source=window.hblWorldTileSource,read=source.getFrame.bind(source),person=read().people[0];
  window.__streetObservation=false;
  // Change only the observation for deterministic presentation-state coverage.
  source.getFrame=()=>{const frame=read();return {...frame,people:frame.people.map(p=>({...p,mode:'doing',action:'eat_home',...(window.__streetObservation&&p.id===person.id?{mode:'moving',travelMode:'walk'}:{})}))};};return String(person.id);
 });
 await page.locator('[data-launch=people]').click();const find=page.getByRole('button',{name:'Find someone outside',exact:true});
 await expect(find).toBeDisabled();await expect(page.locator('#launch-panel')).toContainText('Residents may be indoors');
 await page.evaluate(()=>window.__streetObservation=true);await expect(find).toBeEnabled();await find.click();
 await expect(page.locator('#launch-panel')).toBeHidden();await expect.poll(()=>page.evaluate(()=>String(window.hblPersonCommands.getActor()?.id))).toBe(identity);
 await page.getByRole('button',{name:'Social…',exact:true}).click();
 await expect(page.getByTestId('person-context-menu')).toBeVisible();await expect(page.getByTestId('person-context-menu')).toContainText(/Choose someone|Nobody nearby/);
 await expect(page.getByTestId('person-context-menu').getByRole('button',{name:'Refresh nearby residents'})).toBeEnabled();await page.keyboard.press('Escape');await expect(page.getByTestId('person-context-menu')).toBeHidden();
});
