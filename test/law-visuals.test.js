import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {groupLawCatalog,lawComparisonRows} from '../world/laws/law-panel.js';
import {mountLawWorldLayer} from '../world/laws/world-layer.js';
test('catalog grouping preserves supplied law text and does not invent missing laws',()=>{
 const text='Offer paid leave <script> is text.';const groups=groupLawCatalog([{number:11,text,group:'Time & work'},{number:10,text:'not supplied'},{number:100,text:'Survey',group:'Civic'}]);
 expect(groups.map(g=>g.title)).toEqual(['Time & work','Civic']);expect(groups[0].laws[0].text).toBe(text);expect(groups.flatMap(g=>g.laws.map(l=>l.number))).toEqual([11,100]);
});
test('missing comparison metrics stay unavailable and mismatched comparisons withhold delta',()=>{
 expect(lawComparisonRows({metrics:[{id:'rent',baseline:5,current:4,delta:-1}],comparable:false})[0]).toMatchObject({baseline:5,current:4,delta:null});
 expect(lawComparisonRows({metrics:[{id:'health',status:'unavailable'}]})[0]).toMatchObject({baseline:null,current:null,delta:null});
});
test('law overlays preserve exact park footprint and distinguish potential from explicit recorded IDs',()=>{
 const scene=new THREE.Scene(),town={buildings:[{id:'p',kind:'park',height:0,poly:[[0,0],[10,0],[3,7]]},{id:'h',kind:'home',height:8,poly:[[20,0],[30,0],[30,10],[20,10]]}],roads:[],people:[]},before=structuredClone(town),layer=mountLawWorldLayer({THREE,scene,town});
 expect(layer.update({law:{number:81,text:'Park',supported:false}})).toMatchObject({buildings:1,mode:'potential'});const line=scene.children[0].children[0];expect(Array.from(line.geometry.attributes.position.array)).toEqual([0,.35,0,10,.35,0,10,.35,0,3,.35,7,3,.35,7,0,.35,0].map(Math.fround));expect(line.material.isLineDashedMaterial).toBe(true);
 expect(layer.update({law:{number:21},mode:'recorded'}).buildings).toBe(0);expect(layer.update({law:{number:21},mode:'recorded',comparison:{visual:{recordedBuildingIds:['h']}}}).buildings).toBe(1);
 layer.update({law:null});expect(scene.children[0].children).toHaveLength(0);expect(town).toEqual(before);layer.destroy();expect(scene.children).toHaveLength(0);
});

test('the authoritative law catalog groups exactly the supplied eleven-through-one-hundred range',async()=>{
 const {LAW_CATALOG}=await import('../world/laws/catalog.js');
 const grouped=groupLawCatalog(LAW_CATALOG);
 expect(grouped).toHaveLength(9);
 expect(grouped.flatMap(group=>group.laws).map(law=>law.number).sort((a,b)=>a-b)).toEqual(Array.from({length:90},(_,i)=>i+11));
 expect(grouped.flatMap(group=>group.laws).every(law=>law.text===LAW_CATALOG.find(row=>row.number===law.number).text)).toBe(true);
});

test('automatic recorded mode requires explicit geography and supported housing scope still matches homes',async()=>{
 const {hasRecordedLawGeography}=await import('../world/laws/law-panel.js');
 const {lawPotentialScope}=await import('../world/laws/world-layer.js');
 expect(hasRecordedLawGeography({deltas:{housingUnits:4}})).toBe(false);
 expect(hasRecordedLawGeography({visual:{recordedBuildingIds:['home']}})).toBe(true);
 expect(lawPotentialScope({number:21,mapping:{scope:['residential parcels']}}).buildingKinds).toContain('home');
 expect(lawPotentialScope({number:83,mapping:{scope:['transit agencies']}}).roads).toBe(true);
});
