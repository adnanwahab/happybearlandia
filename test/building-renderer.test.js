import {describe,test,expect} from 'bun:test';
import {buildingDimensions,buildingStateAtMonth,previewBuildingWorld,findBuildableLocation} from '../world/buildings/renderer.js';
import {createBuildingProposal} from '../world/buildings/proposal.js';
import {stratifiedScenarioSample} from '../world/decision/visualizations.js';
describe('stored construction rendering',()=>{
 test('converts square feet to world meters explicitly',()=>{const dimensions=buildingDimensions(createBuildingProposal({geometry:{footprintSqFt:10000}}));expect(dimensions.width**2).toBeCloseTo(929.0304,5)});
 test('replay reads latest stored state without future leakage or interpolation',()=>{const p=createBuildingProposal({id:'p',status:'approved'}),run={projects:[{projectId:'p',states:[{month:0,status:'approved',floorsBuilt:0},{month:8,status:'foundation',floorsBuilt:0},{month:18,status:'structure',floorsBuilt:9},{month:30,status:'occupied',floorsBuilt:24}]}]};const before=JSON.stringify(run);expect(buildingStateAtMonth(run,p,17).status).toBe('foundation');expect(buildingStateAtMonth(run,p,18).floorsBuilt).toBe(9);expect(buildingStateAtMonth(run,p,0).status).toBe('approved');expect(JSON.stringify(run)).toBe(before)});
 test('missing project record remains a proposal rather than inventing construction',()=>{const p=createBuildingProposal({status:'approved'});expect(buildingStateAtMonth({projects:[]},p,120)).toMatchObject({status:'proposed',floorsBuilt:0,occupiedUnits:0})});
});
describe('scenario-stratified rendering',()=>{
 test('all interleaved scenarios survive a 2000-future plotting budget',()=>{const rows=Array.from({length:2000},(_,i)=>({id:String(i),scenarioId:['baseline','plan-a','plan-b','stress'][i%4]}));const sample=stratifiedScenarioSample(rows,1200);expect(sample).toHaveLength(1200);expect(new Set(sample.map(r=>r.scenarioId)).size).toBe(4);for(const scenario of ['baseline','plan-a','plan-b','stress'])expect(sample.filter(r=>r.scenarioId===scenario)).toHaveLength(300);expect(stratifiedScenarioSample(rows,1200)).toEqual(sample)});
 test('a small completed scenario is never dropped in proportional sampling',()=>{const rows=Array.from({length:2000},(_,i)=>({id:String(i),scenarioId:i===1999?'rare':'common'}));expect(stratifiedScenarioSample(rows,1200).some(r=>r.scenarioId==='rare')).toBe(true)});
});

describe('detached visual previews',()=>{
 test('all building and visual operations accumulate without changing approved input',()=>{const scenario={projects:[createBuildingProposal({id:'original',status:'approved'})],worldVisuals:{showCranes:true}};const before=JSON.stringify(scenario);const a=createBuildingProposal({id:'a'}),b=createBuildingProposal({id:'b'});const preview=previewBuildingWorld(scenario,{operations:[{op:'add_building',value:a},{op:'add_building',value:b},{op:'move_building',target:'a',value:{x:999}},{op:'change_world_visual',target:'skyColor',value:'#112233'},{op:'change_world_visual',target:'facadeColor',value:'#aabbcc'}]});expect(preview.projects).toHaveLength(3);expect(preview.projects.find(p=>p.id==='a').location.x).toBe(999);expect(preview.worldVisuals).toEqual({showCranes:true,skyColor:'#112233',facadeColor:'#aabbcc'});expect(JSON.stringify(scenario)).toBe(before)});
});

test('suggested parcels respect complete footprints and finite world bounds',()=>{const p=createBuildingProposal();const bounds={minX:-200,maxX:200,minZ:-200,maxZ:200};const location=findBuildableLocation(p,{bounds,buildings:[{id:'blocked',polygon:[[-50,90],[50,90],[50,190],[-50,190]]}]});expect(location).not.toBeNull();expect(location.x!==0||location.z!==140).toBe(true);expect(findBuildableLocation(p,{bounds:{minX:-1,maxX:1,minZ:-1,maxZ:1}})).toBeNull()});

import {storedMetricSnapshot,illustrativeWorldMapping} from '../world/buildings/renderer.js';
test('physical metric mapping uses stored monthly snapshots without interpolating missing observations',()=>{
 const run={monthlyTimeline:[{month:0,year:0,metrics:{housing_supply:100,vacancy_rate:4}},{month:6,year:.5,metrics:{housing_supply:120,vacancy_rate:6}}]};
 expect(storedMetricSnapshot(run,5).month).toBe(0);expect(illustrativeWorldMapping(run,6)).toMatchObject({supply:120,supplyIndex:1.2,vacancyPercent:6,recordedMonth:6});expect(storedMetricSnapshot(null,12)).toBeNull();
});

import * as THREE from 'three';
import {attachBuildingWorld} from '../world/buildings/renderer.js';
test('actual Three scene uses recorded floors and selection ghost without mutating the run',async()=>{
 class Node extends EventTarget {children=[];dataset={};hidden=false;append(child){this.children.push(child)}replaceChildren(){this.children=[]}setAttribute(key,value){this[key]=value}}
 const win=new Node(),doc={defaultView:win,createElement:()=>new Node()},canvas=new Node();canvas.ownerDocument=doc;
 const panel=new Node(),scene=new THREE.Scene(),project=createBuildingProposal({id:'hero',status:'approved'});
 const run={projects:[{projectId:'hero',states:[{month:0,status:'approved',floorsBuilt:0},{month:18,status:'structure',floorsBuilt:9,progress:.4},{month:40,status:'occupied',floorsBuilt:24,occupiedUnits:310,completedUnits:310,progress:1}]}]};
 const original=JSON.stringify(run),view=attachBuildingWorld({scene,camera:new THREE.PerspectiveCamera(),renderer:{domElement:canvas},panel,THREE});await view.ready;
 view.update({projects:[project],run,month:18,worldVisuals:{treeDensity:0}});view.selectProject('hero');
 expect(panel.children.some(node=>node.textContent==='Floors: 9 / 24')).toBe(true);
 const meshes=[];scene.traverse(node=>{if(node.isMesh)meshes.push(node)});expect(meshes.length).toBeGreaterThan(40);
 panel.children.find(node=>node.dataset.bwBefore==='hero').onclick();
 expect(panel.children.find(node=>node.dataset.bwBefore==='hero')['aria-pressed']).toBe('true');
 scene.traverse(node=>{if(node.isMesh)expect(node.material.wireframe).toBe(true)});
 view.update({month:40});expect(panel.children.some(node=>node.textContent==='Occupied units: 310')).toBe(true);
 panel.children.find(node=>node.dataset.bwBefore==='hero').onclick();scene.traverse(node=>{if(node.isMesh)expect(node.material.wireframe).toBe(false)});
 view.update({month:0});expect(panel.children.some(node=>node.textContent==='Floors: 0 / 24')).toBe(true);
 expect(JSON.stringify(run)).toBe(original);view.destroy();expect(scene.children).toHaveLength(0);
});
