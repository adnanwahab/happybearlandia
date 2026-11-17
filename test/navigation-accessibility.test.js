import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {mountUniverseNavigation} from '../world/universe/connected-navigation.js';
const domPath=process.env.HBL_NAV_DOM;
const source=readFileSync(new URL('../world/universe/navigation-accessibility.js',import.meta.url),'utf8');
const Window=domPath ? (await import(domPath)).Window : null;
function setup({back=false,storage=true,heading=true}={}) {
  const win=new Window({url:'http://hbl.local/routes'});
  win.document.body.innerHTML=(heading?'<h1>Directory</h1>':'')+'<a href="/world">Open World</a><a href="/world">Second World link</a>';
  win.HTMLElement.prototype.getClientRects=function(){return [{}];};
  win.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(win.performance,'getEntriesByType',{configurable:true,value:()=>[{type:back?'back_forward':'navigate'}]});
  if(!storage) Object.defineProperty(win,'sessionStorage',{get(){throw Error('denied');}});
  win.eval(source);
  docNoNavigate(win);
  const show=(persisted=false)=>{const event=new win.Event('pageshow');Object.defineProperty(event,'persisted',{value:persisted});win.dispatchEvent(event);};
  return {win,doc:win.document,show};
}
function docNoNavigate(win){win.document.addEventListener('click',event=>event.preventDefault());}
const check=Window?test:test.skip;
check('arrival focuses heading once without animation APIs; repeat events do not steal focus',()=>{
  const {win,doc,show}=setup();
  show();expect(doc.activeElement.tagName).toBe('H1');
  expect(doc.querySelector('[role=status]').textContent).toBe('Destination ready. Focus at page heading.');
  const link=doc.querySelector('a[href="/world"]');link.focus();show();win.dispatchEvent(new win.Event('pagereveal'));
  expect(doc.activeElement === link).toBe(true);expect(doc.querySelectorAll('[role=status]').length).toBe(1);
  win.close();
});
check('native departure retains existing history and exact duplicate-link opener on back',()=>{
  const {win,doc,show}=setup({back:true});win.history.replaceState({existing:'preserved'},'');
  const links=doc.querySelectorAll('a[href="/world"]');links[1].dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(win.history.state.existing).toBe('preserved');
  expect(win.history.state.hblNavigationFocus.index).toBe(1);
  show();expect(doc.activeElement === links[1]).toBe(true);expect(links[1].dataset.navigationFocus).toBe('restored');
  expect(doc.querySelector('[role=status]').dataset.restoredFocus).toBe('true');win.close();
});
check('missing and hidden openers fall back to heading, including blocked storage',()=>{
  for(const missing of [false,true]) {
    const {win,doc,show}=setup({back:true,storage:false});
    const link=doc.querySelector('a[href="/world"]');
    win.history.replaceState({hblNavigationFocus:{href:link.href,index:0}},'');
    if(missing) doc.querySelectorAll('a[href="/world"]').forEach(el=>el.remove());else link.hidden=true;
    show();expect(doc.activeElement.tagName).toBe('H1');expect(doc.activeElement.dataset.navigationFocus).toBe('heading');win.close();
  }
});
check('no heading gets a visible destination heading; bfcache restores once per reveal',()=>{
  const {win,doc,show}=setup({heading:false});show();expect(doc.activeElement.textContent).toBe('HappyBearLandia workspace');
  const link=doc.querySelector('a[href="/world"]');link.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));
  win.dispatchEvent(new win.Event('pagehide'));show(true);expect(doc.activeElement === link).toBe(true);
  expect(doc.querySelectorAll('h1').length).toBe(1);win.eval(source);expect(doc.querySelectorAll('[role=status]').length).toBe(1);win.close();
});
check('modified/external/hash/download links do not write navigation markers',()=>{
  const {win,doc}=setup();const link=doc.querySelector('a[href="/world"]');
  link.dispatchEvent(new win.MouseEvent('click',{bubbles:true,ctrlKey:true}));expect(win.history.state).toBeNull();
  for(const href of ['https://other.invalid/','/routes#section']) {win.happyDOM.setURL('http://hbl.local/routes');link.href=href;link.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));expect(win.history.state).toBeNull();}
  link.href='/world';link.download='file';link.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));expect(win.history.state).toBeNull();win.close();
});
check('Escape closes standalone navigation and restores its toggle',()=>{
  const {win,doc}=setup();const nav=mountUniverseNavigation(doc.body,{experienceId:'world'});
  const toggle=doc.querySelector('button');toggle.click();const link=doc.querySelector('nav a');link.focus();
  link.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(doc.activeElement === toggle).toBe(true);nav.dispose();win.close();
});
