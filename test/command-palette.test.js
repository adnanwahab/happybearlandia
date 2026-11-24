import {test,expect} from 'bun:test';
import {EXPERIENCES,searchExperiences} from '../world/universe/registry.js';
import {mountCommandPalette,availableActions} from '../world/universe/command-palette.js';
// Same optional DOM dependency convention as browser tests; set to an installed happy-dom module.
const domPath=process.env.HBL_PALETTE_DOM;
const domTest=domPath?test:test.skip;
domTest('combobox keyboard, no results, context preservation, stale and denied native actions, cleanup',async()=>{
 const {Window}=await import(domPath);const win=new Window({url:'http://localhost/?tick=12&runId=run:test:one'}),doc=win.document;
 win.HTMLElement.prototype.scrollIntoView=function(){};
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const action=doc.createElement('button');action.dataset.paletteAction='follow';action.dataset.paletteContext='person:1';action.textContent='Actual resident';action.getClientRects=()=>[{}];let calls=0;action.onclick=()=>calls++;doc.body.append(action);
 const palette=mountCommandPalette(doc.body),trigger=doc.querySelector('.hbl-command-trigger'),input=doc.querySelector('input'),dialog=doc.querySelector('dialog');
 const key=(target,value,extra={})=>target.dispatchEvent(new win.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}));
 const search=value=>{input.value=value;input.dispatchEvent(new win.Event('input'));};
 trigger.focus();key(win,'k',{ctrlKey:true});expect(dialog.open).toBe(true);expect(doc.activeElement).toBe(input);expect(input.getAttribute('aria-expanded')).toBe('true');expect(doc.querySelectorAll('[role=option]')).toHaveLength(34);
 key(input,'ArrowUp');expect(input.getAttribute('aria-activedescendant')).toBe('hbl-command-option-33');
 search('no-such-route');expect(input.hasAttribute('aria-activedescendant')).toBe(false);key(input,'Enter');expect(dialog.open).toBe(true);
 search('follow selection');expect(doc.querySelectorAll('[role=option]')).toHaveLength(1);action.disabled=true;key(input,'Enter');expect(calls).toBe(0);expect(doc.querySelector('[role=status]').textContent).toContain('unavailable');
 action.disabled=false;search('follow selection');action.dataset.paletteContext='person:2';key(input,'Enter');expect(calls).toBe(0);
 search('follow selection');key(input,'Enter');expect(calls).toBe(1);expect(dialog.open).toBe(false);expect(doc.activeElement).toBe(action);
 trigger.focus();key(win,'k',{metaKey:true});key(input,'Escape');expect(doc.activeElement).toBe(trigger);expect(input.getAttribute('aria-expanded')).toBe('false');
 action.hidden=true;expect(availableActions(doc)).toHaveLength(0);action.hidden=false;
 win.history.replaceState(null,'','/?tick=invalid');palette.open();expect(doc.querySelectorAll('[role=option]')).toHaveLength(0);
 palette.dispose();expect(doc.querySelector('dialog')).toBe(null);key(win,'k',{ctrlKey:true});expect(doc.querySelector('dialog')).toBe(null);win.happyDOM.abort();
});

test('all canonical routes remain searchable; owner guards deny hidden, busy and unknown actions',()=>{
 expect(EXPERIENCES).toHaveLength(35);
 for(const app of EXPERIENCES)expect(searchExperiences(app.route).some(row=>row.id===app.id)).toBe(true);
 const button=(action,disabled=false,hidden=false,visible=true)=>({dataset:{paletteAction:action},disabled,getClientRects:()=>visible?[{}]:[],closest:()=>hidden?{}:null});
 const allowed=button('follow'),buttons=[allowed,button('photo',true),button('why',false,true),button('compare',false,false,false),button('invent-evidence')];
 expect(availableActions({querySelectorAll:()=>buttons})).toEqual([allowed]);
});
