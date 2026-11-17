// Dependency path is explicit: no test-only DOM package added to the application.
import {strict as assert} from 'node:assert';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mountMagicTour,tourStops} from '../world/universe/magic-tour.js';
const {Window}=await import(process.argv[2]);
const window=new Window({url:'http://hbl.test/routes#tour=arrive'});
const root=window.document.createElement('section');window.document.body.append(root);
let requests=0;window.fetch=()=>{requests++;throw Error('No requests permitted');};
const dispose=mountMagicTour(root),buttons=[...root.querySelectorAll('button')];
assert.equal(buttons.length,6);
const receipt={schemaVersion:'magic-tour-dom-receipt.v1',scope:'DOM interactions and recipe links only; no browser, camera, gameplay, access API or simulation acceptance',checks:[]};
for(const [i,stop] of tourStops().entries()){
 buttons[i].click();assert.equal(window.location.hash,'#tour='+stop.id);
 assert.equal(root.querySelector('h3').textContent,stop.title);
 assert.equal(root.querySelector('a').getAttribute('href'),stop.href);
 assert.equal(root.querySelector('[role=status]').textContent.includes('Not verified complete'),true);
 assert.equal(buttons.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);
 receipt.checks.push({stop:stop.id,passed:true});
}
window.history.replaceState(null,'','/routes#tour=household');window.dispatchEvent(new window.PopStateEvent('popstate'));
assert.equal(root.querySelector('h3').textContent,tourStops()[1].title);
window.history.replaceState(null,'','/routes#tour=missing');window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(root.querySelector('a').hidden,true);assert.equal(root.querySelector('a').hasAttribute('href'),false);
assert.equal(root.querySelector('h3').textContent,'Tour stop unavailable');
buttons[0].click();assert.equal(root.querySelector('a').hidden,false);
assert.equal(requests,0);assert.equal(window.localStorage.length,0);dispose();assert.equal(root.children.length,0);
receipt.checks.push({stop:'history-event, invalid bookmark, recovery, no fetch/storage, disposal',passed:true});
receipt.sources={};for(const path of ['routes.html','world/universe/magic-tour.js','world/future-machine/contracts.js','world/future-machine/share/index.js'])receipt.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile('docs/evidence/she788/dom-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log('7 DOM checks passed; receipt saved.');
