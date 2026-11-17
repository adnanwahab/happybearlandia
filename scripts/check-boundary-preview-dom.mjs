// Optional local DOM check; does not establish browser layout or rendering.
const { Window } = await import(process.env.HBL_DOM_MODULE || 'happy-dom');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = process.cwd();
const window = new Window();
window.document.write(readFileSync(root + '/world/invention/diorama/index.html','utf8'));
Object.assign(globalThis,{ window, document:window.document, Option:function(text,value) { const el=window.document.createElement('option'); el.textContent=text; el.value=value; return el; }, requestAnimationFrame:window.requestAnimationFrame.bind(window), cancelAnimationFrame:window.cancelAnimationFrame.bind(window) });
await import(root + '/world/invention/diorama/page.js');
const $ = id => document.getElementById(id);
$('enter').click(); $('preview-boundary').click();
assert.equal(document.activeElement.id,'offset-x');
assert.equal($('boundary-shape').children.length,5);
assert.match($('boundary-reading').textContent,/1532.90016/);
async function offset(value) { $('offset-x').value=value; $('offset-x').dispatchEvent(new window.Event('input')); await new Promise(resolve=>setTimeout(resolve,40)); }
await offset('100'); assert.equal($('apply-boundary').disabled,true); assert.match($('boundary-reading').textContent,/overlaps/);
await offset(''); assert.match($('boundary-reading').textContent,/finite meters/);
await offset('5'); assert.equal($('apply-boundary').disabled,false);
$('cancel-boundary').click(); assert.equal($('x').value,'-50'); assert.equal($('boundary-shape').children.length,0);
$('preview-boundary').click(); await offset('5'); $('apply-boundary').click(); assert.equal($('x').value,'-45');
$('exit').click(); $('enter').click(); assert.equal($('x').value,'-50');
$('preview-boundary').click(); await offset('5'); document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); assert.equal($('editor').hidden,false); assert.equal($('boundary-preview').hidden,true);
$('preview-boundary').click(); $('offset-x').dispatchEvent(new window.Event('input')); window.dispatchEvent(new window.Event('pagehide')); assert.equal($('boundary-pacing').dataset.pending,'0');
console.log('DOM interaction checks passed: success, failure, cancel, apply, discard, Escape, pending-frame cleanup.');
await window.happyDOM.close();
