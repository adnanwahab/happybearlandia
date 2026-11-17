import {test, expect} from 'bun:test';
import {describeModelChange, mountChangeNarration} from '../world/future-machine/story/narration.js';
const frame={month:12,baseline:{},plan:{}};
const selection={collection:'households',id:'h1'};
const diff={available:true,entities:[{...selection,kind:'changed',before:{income:100,savings:3},after:{income:0,savings:null},changedFields:['savings','income']}]};
test('narration preserves actual zero/null values, units, identity and deterministic ordering',()=>{
 const text=describeModelChange(frame,diff,selection);
 expect(text).toContain('Month 12: households h1');
 expect(text).toContain('income: without plan 100 USD/month; with plan 0 USD/month.');
 expect(text).toContain('savings: without plan 3 USD; with plan null.');
 expect(describeModelChange(frame,structuredClone(diff),selection)).toBe(text);
 expect(describeModelChange(frame,{...diff,entities:[]},selection)).toContain('No recorded difference');
 expect(describeModelChange(frame,{available:false},selection)).toContain('unavailable');
 for(const kind of ['added','removed'])expect(describeModelChange(frame,{...diff,entities:[{...diff.entities[0],kind}]},selection)).toContain('inventory difference');
});
test('narration bounds fields and distinguishes absent values from zero',()=>{
 const row={...diff.entities[0],before:{},after:{a:0},changedFields:['a','b','c','d','e']};
 const text=describeModelChange(frame,{...diff,entities:[row]},selection);
 expect(text).toContain('a: without plan unavailable; with plan 0');
 expect(text).toContain('1 additional changed fields');
});

test('persistent live output writes only on explicit distinct requests and stops after disposal',()=>{
 let writes=0,value='',removed=false;const attributes={};
 const output={dataset:{},setAttribute:(key,value)=>attributes[key]=value,remove:()=>removed=true,
 get textContent(){return value;},set textContent(text){writes++;value=text;}};
 const host={ownerDocument:{createElement:()=>output},append:()=>{}};
 const narrator=mountChangeNarration(host);
 expect(writes).toBe(0);expect(attributes).toEqual({role:'status','aria-live':'polite','aria-atomic':'true'});
 narrator.announce('Month 12: savings 0');narrator.announce('Month 12: savings 0');expect(writes).toBe(1);
 narrator.announce('Month 13: savings 3');expect(writes).toBe(2);
 narrator.dispose();narrator.announce('ignored');expect(writes).toBe(2);expect(removed).toBe(true);
});

test.skipIf(!process.env.HBL_FM_BROWSER)('browser: keyboard request announces once; rerender and time changes stay silent',async()=>{
 const {chromium}=await import('@playwright/test');
 const root=new URL('../',import.meta.url).pathname;
 const server=Bun.serve({port:0,fetch(request){
  const path=new URL(request.url).pathname;
  return path==='/'?new Response('<!doctype html><body><main></main>',{headers:{'content-type':'text/html'}}):new Response(Bun.file(root+path));
 }});
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.port}`);
  await page.evaluate(async({frame,diff,selection})=>{
   const {renderStory}=await import('/world/future-machine/story/index.js');
   const {mountChangeNarration,describeModelChange}=await import('/world/future-machine/story/narration.js');
   const host=document.querySelector('main'),story=document.createElement('div');host.append(story);
   const narrator=mountChangeNarration(host);let dispose=()=>{};
   window.draw=(month)=>{dispose();frame.month=month;dispose=renderStory(story,{title:'Selected entity',summary:'Exact comparison',evidence:[]},{onNarrate:()=>narrator.announce(describeModelChange(frame,diff,selection))});};
   window.writes=0;new MutationObserver(rows=>window.writes+=rows.length).observe(host.querySelector('[role=status]'),{childList:true,subtree:true,characterData:true});
   window.cleanup=()=>{dispose();narrator.dispose();};draw(12);
  },{frame,diff,selection});
  const output=page.getByRole('status');
  expect(await output.textContent()).toBe('');
  const button=page.getByRole('button',{name:'Describe selected change'});
  await button.focus();await page.keyboard.press('Enter');
  expect(await output.textContent()).toContain('with plan 0 USD/month');
  expect(await output.getAttribute('aria-live')).toBe('polite');
  expect(await page.evaluate(()=>writes)).toBe(1);
  await button.click();expect(await page.evaluate(()=>writes)).toBe(1);
  await page.evaluate(()=>{draw(13);draw(14);});
  expect(await page.evaluate(()=>writes)).toBe(1);
  await button.focus();await page.keyboard.press('Space');
  expect(await output.textContent()).toContain('Month 14');
  expect(await page.evaluate(()=>writes)).toBe(2);
  await page.evaluate(()=>cleanup());expect(await output.count()).toBe(0);
 }finally{await browser?.close();server.stop(true);}
});
