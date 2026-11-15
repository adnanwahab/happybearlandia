import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
let source,css;
test.beforeAll(async()=>{source=await readFile('world/hud-status.js','utf8');css=(await Promise.all(['first-run-guide.css','map-controls.css','launch-shell.css'].map(name=>readFile('world/'+name,'utf8')))).join('\n');});
for(const width of [390,1680])for(const shell of [false,true]){
 test(`top-right status widgets do not overlap ${width}px ${shell?'shell':'classic'}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.setContent(`<style>${css}</style><body class="${shell?'launch-world':''}"><nav id="world-quick-toolbar"><button>Start here</button><button id="activity-dashboard-button">Activity</button></nav><output id="world-playback-facts" style="position:fixed;right:12px;top:64px;background:white;padding:8px">Mood: 68 / 100 · Seed: 29.7286,-95.4746</output>${shell?'<section class="launch-panel"><h2>People</h2></section>':''}</body>`);
  await page.evaluate(async module=>{const {mountWorldStatusStack}=await import('data:text/javascript,'+encodeURIComponent(module));mountWorldStatusStack();},source);
  // The FPS widget mounts asynchronously in the actual renderer as well.
  await page.evaluate(()=>{const meter=document.createElement('aside');meter.className='world-fps-meter';meter.innerHTML='<output>RAF FPS 60 · 16.7ms</output><button class="fps-meter-toggle" aria-label="Toggle FPS meter">FPS</button>';document.body.append(meter);});
  const widgets=page.locator('#world-status-stack > :visible');
  await expect(widgets).toHaveCount(3);
  for(const selector of ['#world-quick-toolbar','#world-playback-facts','.world-fps-meter'])await expect(page.locator('#world-status-stack '+selector)).toBeVisible();
  await expect.poll(()=>page.locator('#world-status-stack > .world-fps-meter').count()).toBe(1);
  const bounds=await widgets.evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}));
  for(let i=0;i<bounds.length;i++){const b=bounds[i];expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);if(i)expect(b.y).toBeGreaterThanOrEqual(bounds[i-1].y+bounds[i-1].height+7);}
  for(const button of await page.locator('#world-status-stack button:visible').all()){await button.click({trial:true});expect(await button.evaluate(node=>{const b=node.getBoundingClientRect();return node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);}
  if(shell){const panel=await page.locator('.launch-panel').boundingBox();expect(panel.y).toBeGreaterThanOrEqual(bounds.at(-1).y+bounds.at(-1).height+7);}
  if(width===1680&&!shell)await page.screenshot({path:'artifacts/she-789/status-widgets-separated.png'});
 });
}
