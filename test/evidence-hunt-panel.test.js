import {test,expect} from 'bun:test';
import {mountEvidenceHunt} from '../world/evidence-hunt/panel.js';
import {KEY} from '../world/evidence-hunt/core.js';
const domPath=process.env.HBL_HUNT_DOM;
const domTest=domPath?test:test.skip;
const raw=await Bun.file(new URL('../world/evidence-hunt/demo.json',import.meta.url)).text();
const settle=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,2));}throw Error('UI did not settle');};
domTest('World entry module and five inspector buttons persist actual local progress through remount',async()=>{
  const html=await Bun.file('world/index.html').text();expect(html).toContain('src="/world/evidence-hunt/main.js"');
  const {Window}=await import(domPath),win=new Window({url:'https://local/world'}),doc=win.document;
  const mount=()=>mountEvidenceHunt({container:doc.body,fetcher:async()=>new Response(raw)});
  let panel=mount();const click=name=>[...doc.querySelectorAll('button')].find(b=>b.textContent===name).click();
  const status=()=>doc.querySelector('[role=status]').textContent;
  click('Open pinned demo');await settle(()=>status().includes('0/5'));
  expect(doc.querySelector('pre').textContent).toBe('');
  expect([...doc.querySelectorAll('button')].find(b=>b.textContent==='Inspect transit').disabled).toBe(true);
  for(const id of ['housing','transit','flood','business','households']){
    click('Inspect '+id);expect(doc.querySelector('section').hidden).toBe(false);
    expect(JSON.parse(doc.querySelector('pre').textContent)).toBeTruthy();
    expect(doc.activeElement).toBe(doc.querySelector('section'));
  }
  expect(status()).toContain('Hunt complete');expect(JSON.parse(win.localStorage.getItem(KEY)).visited).toHaveLength(5);
  panel.destroy();panel=mount();click('Open pinned demo');await settle(()=>status().includes('5/5'));
  click('Cancel hunt');expect(doc.querySelector('section').hidden).toBe(true);expect(doc.querySelector('ol').children.length).toBe(0);
  click('Open pinned demo');await settle(()=>status().includes('5/5'));
  click('Reset local progress');expect(status()).toContain('0/5');
  panel.destroy();expect(doc.querySelector('details')).toBeNull();await win.happyDOM.abort();
});
domTest('missing data, archive mismatch, cancel/replacement and destroy suppress late responses',async()=>{
  const {Window}=await import(domPath),win=new Window({url:'https://local/world'}),doc=win.document;
  let mode='missing',resolve;
  const panel=mountEvidenceHunt({container:doc.body,fetcher:async()=>{
    if(mode==='missing')return new Response('',{status:404});
    if(mode==='mismatch')return new Response('{}');
    return new Promise(r=>{resolve=r;});
  }});
  const click=selector=>doc.querySelector(selector).click(),status=()=>doc.querySelector('[role=status]').textContent;
  click('[data-start]');await settle(()=>status().includes('No source data'));
  mode='mismatch';click('[data-start]');await settle(()=>status().includes('Replay mismatch'));
  mode='late';click('[data-start]');click('[data-cancel]');resolve(new Response(raw));
  await new Promise(r=>setTimeout(r,10));expect(status()).toContain('cancelled');
  expect(doc.querySelectorAll('ol li').length).toBe(0);expect(win.localStorage.getItem(KEY)).toBeNull();
  click('[data-start]');const old=resolve;click('[data-start]');old(new Response(raw));resolve(new Response(raw));
  await settle(()=>status().includes('0/5'));expect(doc.querySelectorAll('ol li').length).toBe(5);
  click('[data-start]');panel.destroy();resolve(new Response(raw));
  await new Promise(r=>setTimeout(r,10));expect(doc.querySelector('details')).toBeNull();await win.happyDOM.abort();
});
