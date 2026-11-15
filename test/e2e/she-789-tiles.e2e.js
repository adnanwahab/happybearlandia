import {test,expect} from '@playwright/test';
for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 test(`tile view shares actual World authority at ${viewport.width}px`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('World page error:',e.message);});await page.setViewportSize(viewport);
  await page.goto('/world?demo=1&people=30&quality=LOW',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldTileSource?.getFrame()?.buildings?.length)),{timeout:60000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.hblCityRenderer?.getPerformanceStats()?.backend),{timeout:60000}).toBe('webgpu');
  const before=await page.evaluate(()=>{window.hblSimulationPlayback.pause();const f=window.hblWorldTileSource.getFrame();return {runId:f.runId,minute:f.minute,people:f.people.length,seed:f.seed};});
  await page.locator('[data-launch=tiles]').click();
  const dialog=page.getByRole('dialog',{name:'World tile view'});await expect(dialog).toBeVisible();await expect(dialog.locator('[data-source]')).toContainText(String(before.seed));
  const canvas=dialog.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowRight');await expect(dialog.locator('output')).toContainText('Tile ');
  await dialog.getByRole('button',{name:'Zoom into tile map'}).click();await dialog.getByRole('button',{name:'Fit map'}).click();
  await page.screenshot({path:info.outputPath('tiles.png')});
  const after=await page.evaluate(()=>{const f=window.hblWorldTileSource.getFrame();return {runId:f.runId,minute:f.minute,people:f.people.length,seed:f.seed};});expect(after).toEqual(before);
  const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+1);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height+1);
  const target=await page.evaluate(async()=>{const {createWorldTiles}=await import('/world/launch-tiles-model.js');const tiles=createWorldTiles(window.hblWorldTileSource.getFrame()),index=tiles.cells.findIndex(c=>c.buildings.length),b=tiles.buildings.get(tiles.cells[index].buildings[0]),rect=document.querySelector('.world-tiles canvas').getBoundingClientRect(),scale=Math.min(rect.width/(tiles.columns+2),rect.height/(tiles.rows+2));return{x:rect.x+(rect.width-tiles.columns*scale)/2+(index%tiles.columns+.5)*scale,y:rect.y+(rect.height-tiles.rows*scale)/2+(Math.floor(index/tiles.columns)+.5)*scale,label:`${b.name??b.id} · ${b.kind??'lot'} · inspect`};});
  await page.mouse.click(target.x,target.y);await dialog.getByRole('button',{name:target.label,exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('#inspect')).toBeVisible();
  await page.locator('[data-launch=tiles]').click();await expect(dialog).toBeVisible();await canvas.focus();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();expect(errors).toEqual([]);
 });
}
