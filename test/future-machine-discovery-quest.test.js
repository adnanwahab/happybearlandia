import {test,expect} from 'bun:test';
import {createDiscoveryQuest} from '../world/future-machine/ui/discovery-quest.js';
const entity={collection:'buildings',id:'recorded-building'};
const diffs=[{month:0,available:true,entities:[]},{month:1,available:false,entities:[entity]},{month:2,available:true,entities:[entity]}];
test('explicit run, recorded month and exact entity are required in order',()=>{
 const q=createDiscoveryQuest();q.reset(diffs,{userRun:true});q.inspect(2,entity);expect(q.state.completed).toEqual([true,false,false]);
 q.visit(1);expect(q.state.completed[1]).toBe(false);q.visit(2);q.inspect(3,entity);q.inspect(2,{...entity,id:'other'});expect(q.state.completed).toEqual([true,true,false]);q.inspect(2,entity);expect(q.state.completed).toEqual([true,true,true]);
});
test('automatic loads, empty comparisons and new runs never inherit completion',()=>{
 const q=createDiscoveryQuest();q.reset(diffs);q.visit(2);q.inspect(2,entity);expect(q.state.completed).toEqual([false,false,false]);
 q.reset(diffs,{userRun:true});q.visit(2);q.inspect(2,entity);q.reset([],{userRun:true});expect(q.state).toEqual({stop:null,completed:[true,false,false]});
 const before=structuredClone(diffs);q.reset(diffs,{userRun:true});q.state.stop.entity.id='tampered';expect(q.state.stop.entity).toEqual(entity);expect(diffs).toEqual(before);
});
