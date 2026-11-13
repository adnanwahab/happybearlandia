import {describe,test,expect} from 'bun:test';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
import {createStage} from '../world/future-machine/scene/index.js';
const state=(buildings=[],projects=[],month=0)=>({month,buildings,projects});
const building=id=>({id,floors:2});
const sourced=(id,sourceId='12')=>({...building(id),source:'osm',sourceId,geometry:{type:'Polygon',coordinates:[[[1,1],[1.001,1],[1.001,1.001],[1,1]]]}});
describe('Future Machine City scene projection',()=>{
 test('module imports without DOM or Three initialization',()=>expect(typeof createStage).toBe('function'));
 test('zero difference and immutable source records',()=>{const s=state([building('a')]);const before=JSON.stringify(s);const frame=createSpatialMapping().frame(s,s);expect(frame.physicalDifference).toBe(false);expect(frame.a).toEqual(frame.b);expect(frame.label).toContain('Synthetic layout');expect(JSON.stringify(s)).toBe(before);});
 test('additions and removals have stable slots across arms and scrubs',()=>{const map=createSpatialMapping();const first=map.frame(state([building('a')]),state([building('b')]));const next=map.frame(state([building('b')],[],1),state([building('a'),building('b')],[],1));expect(first.physicalDifference).toBe(true);expect(next.a[0].x).toBe(first.b[0].x);expect(next.b[0].x).toBe(first.a[0].x);});
 test('source geometry requires explicit identity and unique source mapping',()=>{const map=createSpatialMapping();const valid=map.frame(state([sourced('a')]),state([sourced('a')]));expect(valid.a[0].mapping).toBe('sourced-footprint');expect(valid.a[0].polygon).toEqual(valid.b[0].polygon);const invalid=map.frame(state([sourced('a'),sourced('b')]),state([sourced('a')]));expect(invalid.a.every(r=>r.mapping==='synthetic-layout')).toBe(true);expect(invalid.b[0].mapping).toBe('synthetic-layout');});
 test('unverified geometry and inferred parcels never become locations',()=>{const b={...sourced('a'),sourceId:null,parcelId:'real-parcel'};expect(createSpatialMapping().frame(state([b]),state([b])).a[0].polygon).toBe(null);});
 test('unlocated inventory stays outside sourced footprint extent',()=>{const s=state([sourced('real'),building('unlocated')]);const f=createSpatialMapping().frame(s,s);expect(f.a[1].x).toBeGreaterThan(Math.max(...f.a[0].polygon.map(p=>p[0]))+50);});
 test('only housing projects with recorded bounded progress render',()=>{const projects=[{id:'p',type:'housing',stage:'construction',progress:3,duration:12},{id:'done',type:'housing',stage:'completion',progress:12,duration:12},{id:'water',type:'utility',progress:1,duration:6}];const f=createSpatialMapping().frame(state([],projects),state([],projects));expect(f.a.length).toBe(1);expect(f.a[0].progress).toBe(.25);expect(f.a[0].mapping).toBe('synthetic-layout');expect(f.physicalDifference).toBe(false);});
 test('missing collections, duplicate IDs and mismatched months fail explicitly',()=>{const m=createSpatialMapping();expect(()=>m.frame({},{})).toThrow();expect(()=>m.frame(state(),state([],[],1))).toThrow();expect(()=>m.frame(state([building('a'),building('a')]),state())).toThrow();});
 test('unsupported holes are schematic rather than misrendered sourced footprints',()=>{const b=sourced('a');b.geometry.coordinates.push(b.geometry.coordinates[0]);expect(createSpatialMapping().frame(state([b]),state([b])).a[0].mapping).toBe('synthetic-layout');});
});

import {recordedEntityLabel} from '../world/future-machine/scene/effects.js';
test('localized building evidence distinguishes added, changed and removed inventory',()=>{
 const row={collection:'buildings',id:'b'};
 const diff=kind=>({entities:[{...row,kind}]});
 expect(recordedEntityLabel(row,24,diff('added'),'plan')).toBe('24 homes · added in plan');
 expect(recordedEntityLabel(row,24,diff('changed'),'plan')).toBe('24 homes · recorded change');
 expect(recordedEntityLabel(row,24,diff('removed'),'baseline')).toBe('24 homes · absent in plan');
 expect(recordedEntityLabel(row,0,null,'plan')).toBe('Building');
 expect(recordedEntityLabel(row,24,{entities:[{collection:'projects',id:'b',kind:'added'}]},'plan')).toBe('24 homes');
});

test('stage inventory selects exact IDs and missing snapshots clear selection and labels',async()=>{
 const elements=[],motionListeners=new Set();
 const context=new Proxy({},{get:()=>()=>{},set:()=>true});
 const locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?renderer=canvas2d'}});
 const doc={defaultView:{matchMedia:()=>({matches:false,addEventListener:(_,fn)=>motionListeners.add(fn),removeEventListener:(_,fn)=>motionListeners.delete(fn)})},createElement(tag){const node={tag,children:[],style:{},dataset:{},clientWidth:640,clientHeight:320,
  setAttribute(){},append(...children){for(const child of children){this.children.push(child);if(child&&typeof child==='object')child.parentNode=this;}},insertBefore(child,before){const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,child);child.parentNode=this;},before(...children){for(const child of children)this.parentNode.insertBefore(child,this);},replaceChildren(...children){this.children=[];this.append(...children);},
  addEventListener(){},removeEventListener(){},remove(){this.removed=true;},getContext:()=>context,ownerDocument:doc};elements.push(node);return node;}};
 const container=doc.createElement('div'), selections=[];
 let stage;
 try{
  stage=createStage(container,{onSelect:selection=>selections.push(selection)});
  await stage.whenReady();expect(stage.getStats().backend).toBe('canvas2d');
  const s=state([building('a')]);stage.update({month:0,baseline:{month:0,state:s},plan:{month:0,state:s}},{entities:[]});
  const button=elements.find(node=>node.tag==='button'&&node.textContent?.includes('schematic · unlocated'));
  expect(button.textContent).toContain('schematic · unlocated');button.onclick();
  expect(selections).toEqual([{collection:'buildings',id:'a',arm:'baseline'}]);
  expect(stage.focus({collection:'buildings',id:'a'})).toBe(true);
  const home=(month,buildingId)=>({month,buildings:[building('a'),building('b')],projects:[],households:[{id:'h1',unitId:'u1',income:2000}],units:[{id:'u1',householdId:'h1',status:'occupied',rent:500,buildingId}]});
  stage.update({month:0,baseline:{month:0,state:home(0,'a')},plan:{month:0,state:home(0,'b')}},{entities:[]});
  stage.followHousehold('h1');expect(stage.getStats().followedBuildings).toEqual({baseline:'a',plan:'b'});
  stage.update({month:1,baseline:{month:1,state:home(1,'b')},plan:{month:1,state:home(1,'a')}},{entities:[]});
  expect(stage.getStats().followedBuildings).toEqual({baseline:'b',plan:'a'});
  stage.followHousehold(null);expect(stage.getStats().followedBuildings).toEqual({baseline:null,plan:null});
  stage.update({month:1,baseline:null,plan:null},null);
  expect(stage.focus({collection:'buildings',id:'a'})).toBe(false);
  expect(stage.getStats().objects).toBe(0);expect(stage.getStats().month).toBe(null);
  expect(elements.find(node=>node.dataset.nativeCityLabels).children).toEqual([]);
 }finally{stage?.dispose();stage?.dispose();if(locationDescriptor)Object.defineProperty(globalThis,'location',locationDescriptor);else delete globalThis.location;}
 expect(stage.getStats().disposed).toBe(true);expect(motionListeners.size).toBe(0);
});
