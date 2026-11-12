import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {activityRequest} from '../world/activity-dashboard.js';
import {EXPERIENCES} from '../world/universe/registry.js';

// Execute the directory's normal module entry with a small DOM, including its
// actual search and favorite handlers, rather than duplicating catalog logic.
function directorySession(saved='[]') {
 class Node {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.value='';this._text='';this.hidden=false;}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}
  append(...nodes){this.children.push(...nodes);}
  prepend(node){this.children.unshift(node);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return key==='href'?this.href:this.attributes[key];}
  addEventListener(type,handler){this.listeners[type]=handler;}
  querySelectorAll(selector){const matches=n=>selector.startsWith('.')?n.className===selector.slice(1):n.tag===selector;return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
  cloneNode(){const node=new Node(this.tag);Object.assign(node,{href:this.href,_text:this._text});return node;}
  focus(){}
 }
 const selectors=['.routes','#search','.filters','#results-heading','#result-count','.empty','.clear-search','#reset','.directory-tools'];
 const nodes=Object.fromEntries(selectors.map(key=>[key,new Node()]));
 nodes['.empty'].append(new Node('p'));
 const old=new Node('article'),primary=new Node('a'),secondary=new Node('a');primary.href='/reality-compiler';secondary.href='/world/experiment-lab.html';old.append(primary,secondary);nodes['.routes'].append(old);
 const document={querySelector:selector=>selector==='.empty p'?nodes['.empty'].querySelector('p'):nodes[selector],createElement:tag=>new Node(tag)};
 const localStorage={getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
 const html=readFileSync(new URL('../routes.html',import.meta.url),'utf8');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import .*?;\n/,'');
 new Function('document','localStorage','EXPERIENCES',script)(document,localStorage,EXPERIENCES);
 return {nodes,saved:()=>JSON.parse(saved)};
}

test('directory renders every registry route and retains secondary destinations',()=>{
 const {nodes}=directorySession();const cards=nodes['.routes'].children;
 expect(cards.map(card=>card.dataset.experienceId)).toEqual(EXPERIENCES.map(row=>row.id));
 expect(cards.map(card=>card.querySelector('a').href)).toEqual(EXPERIENCES.map(row=>row.route));
 expect(nodes['#result-count'].textContent).toBe(`${EXPERIENCES.length} of ${EXPERIENCES.length} workspaces`);
 expect(cards.find(card=>card.dataset.experienceId==='experiments').querySelectorAll('a').map(a=>a.href)).toContain('/world/experiment-lab.html');
 expect(nodes['.directory-tools'].hidden).toBe(false);
});

test('registry directory supports search, category filtering and durable favorites',()=>{
 const {nodes,saved}=directorySession();const input=nodes['#search'],cards=nodes['.routes'].children;
 input.value='houston';input.listeners.input();expect(cards.filter(card=>!card.hidden).map(card=>card.dataset.experienceId)).toEqual(['houston-map']);
 nodes['.clear-search'].listeners.click();expect(cards.every(card=>!card.hidden)).toBe(true);
 const flagship=cards.find(card=>card.dataset.experienceId==='future-machine');flagship.querySelector('.favorite').listeners.click();expect(saved()).toEqual(['/world/future-machine.html']);
 nodes['.filters'].children.find(node=>node.textContent==='Favorites').listeners.click();expect(cards.filter(card=>!card.hidden)).toEqual([flagship]);
 const restored=directorySession(JSON.stringify(saved())).nodes;restored['.filters'].children.find(node=>node.textContent==='Favorites').listeners.click();expect(restored['.routes'].children.filter(card=>!card.hidden).map(card=>card.dataset.experienceId)).toEqual(['future-machine']);
 nodes['.filters'].children.find(node=>node.textContent==='Tools & analysis').listeners.click();expect(cards.filter(card=>!card.hidden).every(card=>card.dataset.category==='Tools & analysis')).toBe(true);
});

test('homepage Play Demo targets flagship and keeps the World entry',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 expect(html).toMatch(/class="flagship-demo" href="\/world\/future-machine.html\?demo=1">Play Demo/);
 expect(EXPERIENCES.find(row=>row.id==='world').route).toBe('/world');
});

 test('Activity requests bound stalled sources and propagate real failures without replacing results',async()=>{
 const history={buckets:[],coverage:{toMinute:42}};
 expect(await activityRequest(()=>history,50)).toBe(history);
 expect(await activityRequest(()=>Promise.resolve(history),50)).toBe(history);
 await expect(activityRequest(()=>{throw Error('source unavailable');},50)).rejects.toThrow('source unavailable');
 await expect(activityRequest(()=>Promise.reject(Error('query failed')),50)).rejects.toThrow('query failed');
 await expect(activityRequest(()=>new Promise(()=>{}),5)).rejects.toThrow('Close and reopen Activity to retry');
 });
