import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`named scenes reopen and erase (${mobile?'touch':'keyboard'})`,async({page})=>{
 if(mobile){await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});}
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 const panel=page.getByRole('region',{name:'Personal event bookmarks'}); // section has an accessible name
 await expect(panel.getByText('No bookmarks saved.')).toBeVisible();
 await expect(panel.getByRole('button',{name:'Save event bookmark',exact:true})).toBeDisabled();
 await page.screenshot({path:`.mini-symphony-evidence/SHE-486-bookmarks-before-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status),{timeout:90000}).toBe('ready');
 const id=await page.evaluate(()=>window.futureMachine.state.experimentId);
 for(const month of [0,16,120]){
  const timeline=page.getByTestId('future-machine-timeline');await timeline.fill(String(month));await timeline.dispatchEvent('input');
  await page.getByRole('button',{name:/building-d1 · schematic/}).first().click();
  await panel.getByRole('textbox',{name:'Bookmark label'}).fill(`Scene ${month}`);
  const save=panel.getByRole('button',{name:'Save event bookmark',exact:true});if(mobile)await save.tap();else{await save.focus();await page.keyboard.press('Enter');}
 }
 await page.reload();
 for(const month of [0,16,120]){
  const start=Date.now();await panel.getByRole('button',{name:`Reopen Scene ${month} · Month ${month}`,exact:true}).click();
  await expect(panel.getByRole('status')).toHaveText(`Opened Scene ${month} at Month ${month}.`);
  expect(await page.evaluate(()=>({id:window.futureMachine.state.experimentId,month:window.futureMachine.state.month}))).toEqual({id,month});
  console.log(`bookmark reopen ${month}: ${Date.now()-start}ms`);
 }
 const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'Export recipes and bookmarks'}).click();expect((await downloadPromise).suggestedFilename()).toBe('future-machine-bookmarks.json');
 await page.screenshot({path:`.mini-symphony-evidence/SHE-486-bookmarks-after-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.route('**/api/city-experiments/**',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Experiment not found'})}));
 await panel.getByRole('button',{name:'Reopen Scene 0 · Month 0',exact:true}).click();await expect(panel.getByRole('status')).toContainText('unavailable');
 await panel.getByRole('button',{name:'Remove all bookmarks',exact:true}).click();await expect(panel.getByText('No bookmarks saved.')).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('hbl.future-machine.bookmarks.v1','{'));await page.reload();await expect(panel.getByRole('status')).toContainText('corrupt or expired');await panel.getByRole('button',{name:'Remove all bookmarks',exact:true}).click();
});
