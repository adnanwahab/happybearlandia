import {test,expect} from '@playwright/test';

for(const renderer of ['canvas2d','webgl'])test(`${renderer}: bookmark restores the paired pose through navigation, month and layout changes`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/world/future-machine.html?renderer=${renderer}`);
  const save=page.getByRole('button',{name:'Save view',exact:true});
  const restore=page.getByRole('button',{name:'Restore view',exact:true});
  await expect(save).toBeDisabled();await expect(restore).toBeDisabled();
  await page.getByRole('button',{name:'Fork City',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe(renderer);
  await expect(save).toBeEnabled();await expect(restore).toBeDisabled();
  const camera=()=>page.evaluate(()=>window.futureMachine.stats.scene.camera);
  const canvas=page.getByRole('region',{name:'Synchronized City comparison'}).locator('canvas');
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.5);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.6,{steps:8});await page.mouse.up();
  await page.mouse.wheel(0,-120);
  await save.click();const saved=await camera();
  await page.getByRole('button',{name:/building-d1 · schematic/}).first().click();
  expect(await camera()).not.toEqual(saved);
  const timeline=page.getByTestId('future-machine-timeline');await timeline.fill('120');await timeline.dispatchEvent('input');
  await page.getByRole('button',{name:'Blink: Future A',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await restore.click();
  const restored=await camera();
  for(const key of Object.keys(saved)){
    if(Array.isArray(saved[key]))saved[key].forEach((value,i)=>expect(restored[key][i]).toBeCloseTo(value,8));
    else expect(restored[key]).toBeCloseTo(saved[key],8);
  }
  await page.getByRole('button',{name:'Side by side',exact:true}).click();
  expect(await page.evaluate(()=>window.futureMachine.stats.scene.mode)).toBe('split');
  await restore.click();await expect(page.getByText('Saved view restored in both worlds.',{exact:true})).toBeVisible();
  // Saving a second view replaces the first; starting a new run clears it.
  await page.getByRole('button',{name:/building-d1 · schematic/}).first().click();await save.click();
  const replacement=await camera();expect(replacement).not.toEqual(saved);
  await page.getByRole('button',{name:'Show Me What Changed',exact:true}).click();await restore.click();
  const again=await camera();for(const key of Object.keys(replacement)){
    if(Array.isArray(replacement[key]))replacement[key].forEach((value,i)=>expect(again[key][i]).toBeCloseTo(value,8));
    else expect(again[key]).toBeCloseTo(replacement[key],8);
  }
  await page.getByRole('button',{name:'Fork City',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status),{timeout:90000}).toBe('ready');
  await expect(restore).toBeDisabled();expect(errors).toEqual([]);
});
