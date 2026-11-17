import {test,expect} from 'bun:test';
import {buildingDestination} from '../world/building-perspective.js';
const building={id:'source-building-7',height:24,poly:[[-10,-10],[10,-10],[10,10],[-10,10]]};
test('building destinations frame same shell without modifying source/model records',()=>{
 const record={building,runId:'run-7',seed:42,minute:123,modelVersion:'fixture-v1'}, before=JSON.stringify(record);
 for(const kind of ['room','rooftop','skyline']){
  const p=buildingDestination(building,kind,[building]);expect(p).not.toBeNull();expect(p.target.x).toBe(0);expect(p.target.z).toBe(0);
  if(kind==='rooftop')expect(p.position.y).toBeGreaterThan(building.height);
 }
 expect(JSON.stringify(record)).toBe(before);
});
test('missing, unsupported and obstructed destinations remain unavailable',()=>{
 for(const b of [null,{...building,kind:'park'},{...building,height:NaN},{...building,poly:[]},{...building,poly:[[NaN,0],[0,0],[1,1]]}])expect(buildingDestination(b,'rooftop',[building])).toBeNull();
 expect(buildingDestination({...building,roofAccess:false},'rooftop',[building])).toBeNull();
 expect(buildingDestination(building,'unknown',[building])).toBeNull();
 const obstacle={id:'blocked',height:1500,poly:[[-1000,-1000],[1000,-1000],[1000,1000],[-1000,1000]]};
 expect(buildingDestination(building,'room',[building,obstacle])).toBeNull();
});

import {mountBuildingPerspective} from '../world/building-perspective.js';
function fixture(){
 const doc={activeElement:null};
 const node=()=>Object.assign(new EventTarget(),{ownerDocument:doc,dataset:{},style:{},children:[],append(child){this.children.push(child);},focus(){doc.activeElement=this;},remove(){this.removed=true;}});
 doc.createElement=()=>{const n=node(),row=node(),status=node(),summary=node();n.querySelector=tag=>tag==='div'?row:tag==='summary'?summary:status;return n;};
 const vector=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
 const camera={position:vector(320,125,450)},controls={target:vector(0,0,0),enableDamping:true,update(){}};
 let current=building,cutaway=false,buildings=[building];
 const picker=mountBuildingPerspective({container:node(),camera,controls,getBuilding:()=>current,getBuildings:()=>buildings,getCutaway:()=>cutaway,setCutaway:v=>cutaway=v,stopGuidance(){}});
 return {picker,camera,controls,doc,setCurrent:b=>current=b,setBuildings:b=>buildings=b,getCutaway:()=>cutaway,buttons:picker.element.querySelector('div').children};
}
test('native controller preserves first return, focus, cutaway and source selection',()=>{
 const f=fixture();const before=JSON.stringify(building);
 for(const [kind,i] of [['room',0],['rooftop',1],['skyline',2]]){
  expect(f.picker.choose(kind)).toBe(true);expect(f.doc.activeElement).toBe(f.buttons[i]);expect(f.getCutaway()).toBe(kind==='room');
 }
 expect(f.picker.choose('return')).toBe(true);expect(f.camera.position).toMatchObject({x:320,y:125,z:450});expect(f.controls.target).toMatchObject({x:0,y:0,z:0});
 expect(f.getCutaway()).toBe(false);expect(f.doc.activeElement).toBe(f.picker.element.querySelector('summary'));expect(f.controls.enableDamping).toBe(true);expect(JSON.stringify(building)).toBe(before);
 expect(f.picker.choose('return')).toBe(false);
});
test('selection loss disables destinations and moves focus; obstructed return keeps current camera',()=>{
 const f=fixture();f.picker.choose('room');f.setCurrent(null);f.picker.update();
 expect(f.buttons.slice(0,3).every(b=>b.disabled)).toBe(true);expect(f.doc.activeElement).toBe(f.picker.element.querySelector('summary'));
 const before={...f.camera.position};f.setBuildings([{id:'blocker',height:600,poly:[[300,430],[340,430],[340,470],[300,470]]}]);
 expect(f.picker.choose('return')).toBe(false);expect(f.camera.position).toEqual(before);
 f.picker.dispose();expect(f.picker.choose('room')).toBe(false);expect(f.picker.element.removed).toBe(true);
});
