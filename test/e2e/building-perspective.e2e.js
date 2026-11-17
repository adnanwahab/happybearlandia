import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/building-perspective.js','utf8'),presets=readFileSync('world/camera-presets.js','utf8');
for(const mobile of [false,true])for(const motion of ['reduce','no-preference'])test(`building round trip ${mobile?'touch':'keyboard'} ${motion}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});await page.emulateMedia({reducedMotion:motion});
 await page.route('https://perspective.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main>'}));await page.goto('https://perspective.test/');
 await page.evaluate(async({source,presets})=>{
 const presetURL='data:text/javascript;base64,'+btoa(presets);
 const {mountBuildingPerspective}=await import('data:text/javascript;base64,'+btoa(source.replace("'./camera-presets.js'",JSON.stringify(presetURL))));
 const vector=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
 window.building={id:'fixture-7',height:24,poly:[[-10,-10],[10,-10],[10,10],[-10,10]]};
 window.record={selected:building.id,minute:123,seed:42,runId:'fixture-run',modelVersion:'v1'};
 window.camera={position:vector(320,125,450)};window.controls={target:vector(0,0,0),update(){}};window.cutaway=false;window.current=building;
 window.picker=mountBuildingPerspective({container:document.querySelector('main'),camera,controls,getBuilding:()=>current,getBuildings:()=>[building],getCutaway:()=>cutaway,setCutaway:v=>cutaway=v,stopGuidance(){}});
 },{source,presets});
 const root=page.getByTestId('building-perspective');await root.locator('summary').click();
 const before=await page.evaluate(()=>JSON.stringify(record));
 for(const label of ['Room detail','Rooftop','Skyline']){
  const button=root.getByRole('button',{name:label,exact:true});
  if(mobile)await button.tap();else{await button.focus();await page.keyboard.press('Enter');}
  await expect(button).toBeFocused();await expect(root.getByRole('status')).toContainText(label);
  expect(await page.evaluate(()=>JSON.stringify(record))).toBe(before);
  expect(await page.evaluate(()=>cutaway)).toBe(label==='Room detail');
 }
 await root.getByRole('button',{name:'Return to previous view'}).click();await expect(root.locator('summary')).toBeFocused();
 expect(await page.evaluate(()=>[camera.position.x,camera.position.y,camera.position.z])).toEqual([320,125,450]);expect(await page.evaluate(()=>cutaway)).toBe(false);
 await page.evaluate(()=>{current={...building,roofAccess:false};picker.refresh();});await expect(root.getByRole('button',{name:'Rooftop',exact:true})).toBeDisabled();
 await page.evaluate(()=>{current=null;picker.update();});await expect(root.getByRole('button',{name:'Room detail'})).toBeDisabled();await expect(root.getByRole('status')).toContainText('unavailable');
 await page.screenshot({path:test.info().outputPath('building-perspective.png')});
 await page.evaluate(()=>picker.dispose());await expect(root).toHaveCount(0);
});
