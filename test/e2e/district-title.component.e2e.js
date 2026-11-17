import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/district-title.js','utf8');
for(const mobile of [false,true])test.describe(mobile?'mobile':'desktop',()=>{
 test.use({hasTouch:mobile});
 test(`district arrival ${mobile?'mobile reduced motion':'desktop keyboard'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:mobile?'reduce':'no-preference'});
 await page.route('https://district.test/**',route=>route.fulfill({contentType:'text/html',body:'<button id="west">West camera destination</button><button id="east">East camera destination</button>'}));
 await page.goto('https://district.test/');
 await page.evaluate(async source=>{
  const {mountDistrictTitle}=await import('data:text/javascript;base64,'+btoa(source));
  window.point={x:-30,z:0};window.frame={minute:360,context:{id:'fixture',provenance:{geometrySource:'osm'},districts:[{id:'w',name:'West · synthetic district',bounds:{minX:-100,maxX:0,minZ:-100,maxZ:100}},{id:'e',name:'East · synthetic district',bounds:{minX:0,maxX:100,minZ:-100,maxZ:100}}]}};
  window.title=mountDistrictTitle({container:document.body,getFrame:()=>frame,getPoint:()=>point});window.time=0;
  for(const [id,x]of [['west',-30],['east',30]])document.getElementById(id).onclick=()=>{point.x=x;title.update(time+=1000);title.update(time+=700);};
 },source);
 const west=page.getByRole('button',{name:'West camera destination'});
 if(mobile)await west.tap();else{await west.focus();await page.keyboard.press('Enter');}
 const card=page.getByRole('status');await expect(card).toContainText('West · synthetic district');await expect(card).toContainText('Modeled day 1 · 06:00');await expect(card).toHaveAttribute('aria-atomic','true');
 expect(await card.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.evaluate(()=>{window.mutations=0;window.observer=new MutationObserver(rows=>mutations+=rows.length);observer.observe(document.querySelector('.district-title'),{childList:true,subtree:true});for(let i=0;i<20;i++){point.x=i%2?1:-1;title.update(time+=100);}});expect(await page.evaluate(()=>mutations)).toBe(0);
 if(mobile)await page.getByRole('button',{name:'East camera destination'}).tap();else await page.getByRole('button',{name:'East camera destination'}).click();await expect(card).toContainText('East · synthetic district');
 const box=await card.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(mobile?390:1440);
 await page.screenshot({path:test.info().outputPath('district-arrival.png')});
 await page.evaluate(()=>title.update(time+=4500));await expect(card).toBeHidden();
 await page.evaluate(()=>{frame=null;title.update(time+=1000);});await expect(card).toBeHidden();
 await page.evaluate(()=>{title.destroy();observer.disconnect();});await expect(page.locator('.district-title')).toHaveCount(0);
});
});
