import {test,expect} from 'bun:test';
import {mountUniverseNavigation} from '../world/universe/connected-navigation.js';
import {CONTINUITY_VERSION,continuityURL,readContinuity} from '../world/continuity/contract.js';
const Window=process.env.HBL_NAV_DOM ? (await import(process.env.HBL_NAV_DOM)).Window : null;
const check=Window?test:test.skip;
check('native mounted disclosure retains receipt and canonical scope, refreshes fallback, disposes',()=>{
 const p={version:CONTINUITY_VERSION,sourceSurface:'world',authority:'test',runId:'r',checkpointId:'c',modelVersion:'m',entity:null,camera:null,clock:{id:'test',unit:'month',origin:'epoch',tick:0}};
 const win=new Window({url:'http://hbl.local'+continuityURL('world',p)+'&worldId=world%3Atest%3Acity'});
 const api=mountUniverseNavigation(win.document.body,{experienceId:'world'});
 const nav=win.document.querySelector('[aria-label="Connected universe"]');
 const toggle=nav.querySelector('button');toggle.click();expect(toggle.getAttribute('aria-expanded')).toBe('true');
 const summary=nav.querySelector('summary');expect(summary.textContent).toBe('Place and time continuity');
 expect(nav.textContent).toContain('Context carried only.');
 const links=[...nav.querySelectorAll('[aria-label="Place and time destinations"] a')];expect(links.length).toBe(3);
 for(const a of links){expect(readContinuity(a.href).payload).toEqual(p);expect(new URL(a.href).searchParams.get('worldId')).toBe('world:test:city');}
 win.history.replaceState(null,'','/world?continuity=broken');win.dispatchEvent(new win.PopStateEvent('popstate'));
 expect(nav.textContent).toContain('invalid or unsupported context');
 expect(readContinuity(nav.querySelector('[aria-label="Place and time destinations"] a').href).status).toBe('missing');
 win.history.replaceState(null,'','/world');win.dispatchEvent(new win.PopStateEvent('popstate'));expect(nav.textContent).toContain('no checkpoint context');
 api.dispose();expect(win.document.querySelector('[aria-label="Connected universe"]')).toBeNull();win.happyDOM.abort();
});
check('the normal bootstrap experience IDs expose the disclosure on all three surfaces only',()=>{
 for(const experienceId of ['world','living-city','future-machine','optimization','game']) {
  const win=new Window({url:'http://hbl.local/world'});const api=mountUniverseNavigation(win.document.body,{experienceId});
  expect(win.document.querySelectorAll('[aria-label="Place and time destinations"]').length).toBe(experienceId==='game'?0:1);api.dispose();win.happyDOM.abort();
 }
});
