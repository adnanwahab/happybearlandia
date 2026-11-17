import {test,expect} from 'bun:test';
import {voiceQuery} from '../world/universe/voice-input.js';
import {mountCommandPalette} from '../world/universe/command-palette.js';
const domTest=process.env.HBL_PALETTE_DOM?test:test.skip;
async function setup(Recognition){
 const {Window}=await import(process.env.HBL_PALETTE_DOM);
 const win=new Window({url:'http://localhost/world?tick=12&runId=run:test:one'}),doc=win.document;
 win.HTMLElement.prototype.scrollIntoView=function(){};
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 win.SpeechRecognition=Recognition;
 const owner=doc.createElement('button');owner.textContent='Rent';owner.dataset.paletteAction='why';owner.dataset.paletteContext='run:test:one:12:rent';owner.getClientRects=()=>[{}];let calls=0;owner.onclick=()=>calls++;doc.body.append(owner);
 const palette=mountCommandPalette(doc.body);
 const key=value=>doc.querySelector('input').dispatchEvent(new win.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
 return {win,doc,owner,palette,key,calls:()=>calls,voice:()=>[...doc.querySelectorAll('dialog button')].find(b=>/voice/i.test(b.textContent)),cleanup(){palette.dispose();win.happyDOM.abort();}};
}
function recognizer(){
 const instances=[];
 class Recognition{
  processLocally=false;starts=0;aborts=0;
  constructor(){instances.push(this);}
  start(){this.starts++;}
  abort(){this.aborts++;}
  result(text){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}
 }
 return {Recognition,instances};
}
test('bounded phrase normalization preserves specific evidence subject',()=>{
 expect(voiceQuery('Show the school!')).toBe('school');expect(voiceQuery('why did rent change?')).toBe('why rent');
 expect(voiceQuery('delete all data')).toBe('delete all data');
});
domTest('opt-in local recognition, confirmation and native owner execution; no persistent transcript',async()=>{
 const {Recognition,instances}=recognizer(),s=await setup(Recognition);
 try{
  expect(instances).toHaveLength(0);s.palette.open();expect(instances).toHaveLength(0);
  s.voice().click();const r=instances[0];expect(r.starts).toBe(1);expect(r.processLocally).toBe(true);expect(r.continuous).toBe(false);expect(r.interimResults).toBe(false);
  r.result('why did rent change?');expect(r.aborts).toBe(1);expect(s.calls()).toBe(0);expect(s.doc.querySelectorAll('[role=option]')).toHaveLength(1);
  expect(s.doc.querySelector('#hbl-command-status').textContent).toContain('confirm');s.key('Enter');expect(s.calls()).toBe(1);
  expect(s.doc.querySelector('input').value).toBe('');expect(s.win.localStorage.length).toBe(0);expect(s.win.sessionStorage.length).toBe(0);
 }finally{s.cleanup();}
});
domTest('unsupported and cloud-only browsers never start; keyboard equivalent remains available',async()=>{
 for(const Recognition of [undefined,class {start(){throw Error('must not start');}}]){
  const s=await setup(Recognition);try{s.palette.open();s.voice().click();expect(s.doc.querySelector('dialog').textContent).toContain('typed command search');s.doc.querySelector('input').value='why rent';s.doc.querySelector('input').dispatchEvent(new s.win.Event('input'));s.key('Enter');expect(s.calls()).toBe(1);}finally{s.cleanup();}
 }
});
domTest('denial, missing evidence, stale selection/run, cancellation and late callbacks fail closed',async()=>{
 const {Recognition,instances}=recognizer(),s=await setup(Recognition);
 try{
  s.palette.open();s.voice().click();instances.at(-1).onerror({error:'not-allowed'});expect(s.doc.querySelector('dialog').textContent).toContain('access denied');expect(s.calls()).toBe(0);
  s.voice().click();instances.at(-1).result('show the school');expect(s.doc.querySelectorAll('[role=option]')).toHaveLength(0);s.key('Enter');expect(s.calls()).toBe(0);
  for(const mutate of [()=>s.owner.disabled=true,()=>s.owner.dataset.paletteContext='other',()=>s.win.history.replaceState(null,'','/world?tick=13')]){
   s.owner.disabled=false;s.voice().click();instances.at(-1).result('why did rent change?');mutate();s.key('Enter');expect(s.calls()).toBe(0);
  }
  s.voice().click();const r=instances.at(-1),late=r.onresult;s.key('Escape');expect(r.aborts).toBe(1);late({results:[Object.assign([{transcript:'why rent'}],{isFinal:true})]});expect(s.doc.querySelector('input').value).toBe('');
  s.palette.open();s.voice().click();const last=instances.at(-1);s.palette.dispose();expect(last.aborts).toBe(1);
 }finally{s.cleanup();}
});
domTest('World shell search event uses the same keyboard confirmation registry',async()=>{
 const s=await setup(undefined);try{
  s.doc.body.classList.add('launch-world');expect(s.win.dispatchEvent(new s.win.Event('hbl:open-commands',{cancelable:true}))).toBe(false);
  expect(s.doc.querySelector('dialog').open).toBe(true);s.key('Escape');
  s.win.dispatchEvent(new s.win.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));expect(s.doc.querySelector('dialog').open).toBe(true);
 }finally{s.cleanup();}
});

import {schoolTarget,mountSchoolCommand} from '../world/universe/school-command.js';
test('school selection requires source identity and rejects duplicate IDs and absent geometry',()=>{
 const frame={runId:'run:fixture:one',geometryKey:'synthetic:seed:42',buildings:[{id:'school:1',kind:'school',name:'Fixture school'}]};
 expect(schoolTarget(frame).id).toBe('school:1');expect(schoolTarget({...frame,runId:null})).toBe(null);
 expect(schoolTarget({...frame,buildings:[...frame.buildings,...frame.buildings]})).toBe(null);expect(schoolTarget({...frame,buildings:[]})).toBe(null);
});
domTest('show school passes through palette to source owner and rejects a changed run before click',async()=>{
 const {Recognition,instances}=recognizer(),s=await setup(Recognition);
 let frame={runId:'run:fixture:one',geometryKey:'synthetic:42',buildings:[{id:'s1',name:'Fixture school',kind:'school'}]},selected=[],denied=0;
 const command=mountSchoolCommand(s.doc.body,{getSource:()=>({getFrame:()=>frame,selectBuilding:id=>selected.push(id)}),onUnavailable:()=>denied++});
 command.refresh();const button=s.doc.querySelector('[data-palette-action=inspect]');button.getClientRects=()=>[{}];
 try{
  s.palette.open();s.voice().click();instances.at(-1).result('show the school');expect(s.doc.querySelectorAll('[role=option]')).toHaveLength(1);expect(selected).toEqual([]);s.key('Enter');expect(selected).toEqual(['s1']);
  s.palette.open();s.voice().click();instances.at(-1).result('show the school');frame={...frame,runId:'run:fixture:two'};s.key('Enter');expect(selected).toEqual(['s1']);expect(denied).toBe(1);
  frame={...frame,buildings:[]};command.refresh();expect(button.disabled).toBe(true);
 }finally{command.dispose();s.cleanup();}
});
