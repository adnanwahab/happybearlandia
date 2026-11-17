import {test,expect} from '@playwright/test';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {injectUniverseBootstrap} from '../../world/universe/html-navigation.js';
import {CONTINUITY_VERSION,continuityURL} from '../../world/continuity/contract.js';
// Real HTML/bootstrap source, without model APIs or synthetic restoration adapters.
// This certifies disclosure/transport interaction only, not cross-model restoration.
test.beforeEach(async({context})=>{
 await context.route('http://127.0.0.1:39961/**',async route=>{
  const url=new URL(route.request().url());let relative=decodeURIComponent(url.pathname).slice(1),file=path.resolve(relative);
  if(!file.startsWith(process.cwd()+'/'))return route.abort();
  if(existsSync(file)&&statSync(file).isDirectory()){relative+='/index.html';file=path.resolve(relative);}
  if(!existsSync(file)||statSync(file).isDirectory())return route.fulfill({status:404,body:'Source transport: unavailable'});
  const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
  return route.fulfill({body:ext==='.html'?injectUniverseBootstrap(readFileSync(file,'utf8'),relative):readFileSync(file),contentType:types[ext]||'application/octet-stream'});
 });
});
const payload={version:CONTINUITY_VERSION,sourceSurface:'world',authority:'test:synthetic',runId:'test-run',checkpointId:'test-checkpoint',modelVersion:'test.v1',entity:{namespace:'test',kind:'building',id:'1'},camera:{mapping:'test-local',version:'v1',position:[0,12,24],target:[0,0,0]},clock:{id:'test',unit:'month',origin:'2026-01',tick:0}};
async function open(page, touch) {
 const nav=page.getByRole('navigation',{name:'Connected universe',exact:true});
 const toggle=nav.getByRole('button',{name:'Open universe navigation',exact:true});
 if(touch) await toggle.tap(); else {await toggle.focus();await page.keyboard.press('Enter');}
 const summary=nav.locator('summary').filter({hasText:'Place and time continuity'});
 if(touch) await summary.tap();else {await summary.focus();await page.keyboard.press('Enter');}
 return nav.getByRole('navigation',{name:'Place and time destinations',exact:true});
}
for(const touch of [false,true])test(`native three-route receipt transport and fallback, ${touch?'mobile touch':'keyboard'}`,async({page})=>{
 await page.setViewportSize(touch?{width:390,height:844}:{width:1440,height:1000});
 await page.goto(continuityURL('world',payload));
 for(const [name,surface] of [['Future Machine','future-machine'],['Decision Studio','decision'],['World','world']]) {
  const links=await open(page,touch);
  await expect(page.getByText('Context carried only.',{exact:false})).toBeVisible();
  const a=links.getByRole('link',{name,exact:true});
  if(touch)await a.tap();else{await a.focus();await page.keyboard.press('Enter');}
  await page.waitForURL(url=>url.pathname===continuityURL(surface,null));
  expect(JSON.parse(new URL(page.url()).searchParams.get('continuity'))).toEqual(payload);
 }
 await page.goto('/world/decision.html?continuity=%7B');await open(page,touch);
 await expect(page.getByText('Continuity unavailable: invalid or unsupported context.',{exact:false})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Place and time destinations'}).getByRole('link',{name:'World',exact:true})).toHaveAttribute('href',/^\/world\?universeId=/);
 await page.goto('/world/future-machine.html');await open(page,touch);
 await expect(page.getByText('Continuity unavailable: no checkpoint context.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});
