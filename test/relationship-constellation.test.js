import {test,expect} from 'bun:test';
import {relationshipConstellation} from '../world/house/relationship-constellation.js';
import {createPopulationModel,serializePopulation} from '../world/population/model.js';
import {inspectHouseRelationships} from '../world/house/relationships.js';
test('rejects generated backstory, self and duplicate edges; recency uses valid modeled contact only',()=>{
 const person={id:'a',relationships:[{personId:'b',name:'Bee',recordedTie:true,lastEncounterMinute:80},{personId:'b',recordedTie:true},{personId:'c',friendship:100},{personId:'a',recordedTie:true},{personId:'d',recordedTie:true,lastEncounterMinute:101,memories:[{minute:-1},{minute:90}]}]};const before=JSON.stringify(person);
 expect(relationshipConstellation(person,100).map(r=>[r.personId,r.recency])).toEqual([['d','10 modeled min ago'],['b','20 modeled min ago']]);expect(JSON.stringify(person)).toBe(before);expect(relationshipConstellation()).toEqual([]);
 expect(relationshipConstellation({relationships:[{recordedTie:true,personId:'x'}]},100)[0].recency).toBe('Contact time not recorded');
});
test('inspection marks only canonical persisted pairs without changing model or seed',()=>{
 const m=createPopulationModel({population:8,householdSize:4,seed:42},{},{initialMinute:360}),a=m.prefix+'-p0',b=m.prefix+'-p1';
 const before=serializePopulation(m);expect(relationshipConstellation(inspectHouseRelationships(m,a),360)).toEqual([]);expect(serializePopulation(m)).toEqual(before);
 m.social??={};m.social.ties??={};m.social.ties[JSON.stringify([a,b].sort())]={a,b,friendship:65,romance:0,tension:0,familiarity:80,memories:[]};const saved=serializePopulation(m);
 expect(relationshipConstellation(inspectHouseRelationships(m,a),360).map(r=>r.personId)).toEqual([b]);expect(serializePopulation(m)).toEqual(saved);
});
import {mountRelationshipConstellation} from '../world/house/relationship-constellation.js';
test('fallback controls navigate only supported profiles and missing data announces its state',()=>{
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.classList={add:()=>{}};this.events={};}append(node){this.children.push(node);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.events[k]=fn;}}
 const doc={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)},root=new Node('main');root.ownerDocument=doc;const calls=[];
 const section=mountRelationshipConstellation(root,{person:{name:'Alex',relationships:[{personId:'b',name:'Bee',recordedTie:true},{personId:'c',name:'Casey',recordedTie:true}]},supportedPersonIds:['b'],onInspect:id=>calls.push(id)});
 const all=node=>[node,...node.children.flatMap(all)],buttons=all(section).filter(n=>n.tag==='button');expect(buttons).toHaveLength(1);expect(buttons[0].textContent).toBe('Bee');expect(buttons[0].type).toBe('button');buttons[0].events.click();expect(calls).toEqual(['b']);expect(all(section).some(n=>n.textContent===' Profile unavailable in this house scene.')).toBe(true);
 const empty=mountRelationshipConstellation(root,{});expect(all(empty).find(n=>n.attrs.role==='status').textContent).toContain('No recorded relationship ties');
});
