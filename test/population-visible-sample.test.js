import {test,expect} from 'bun:test';
import {selectVisibleIndices} from '../world/population/visible-sample.js';
test('bounded worker display samples prioritize actual travelers nearest the view',()=>{
 const people={age:new Uint8Array(5),x:Float32Array.from([0,100,200,300,400]),z:new Float32Array(5),activity:Uint8Array.from([0,8,8,8,0])};
 const before=structuredClone(people);
 expect(selectVisibleIndices(people,2,{x:290,z:0})).toEqual([3,2]);
 expect(selectVisibleIndices(people,2,{x:90,z:0})).toEqual([1,2]);
 expect(selectVisibleIndices(people,2)).toEqual([0,2]);
 expect(selectVisibleIndices(people,0,{x:0,z:0})).toEqual([]);
 expect(people).toEqual(before);
});

test('street access destinations preserve map centers and become actual model locations',async()=>{
 const {deriveLivingContext}=await import('../world/population/world-view.js');
 const {createPopulationModel}=await import('../world/population/model.js');
 const town={buildings:[{id:'home',center:[20,20],height:12}],roads:[{pts:[[-100,0],[100,0]]}]},original=structuredClone(town);
 const context=deriveLivingContext(town);expect(context.buildings[0].center).toEqual([20,20]);expect(context.buildings[0].accessPoint).toEqual([20,6]);expect(town).toEqual(original);
 const model=createPopulationModel({population:80},context);expect(model.locations[0]).toEqual({id:'home',x:20,z:6});expect(context.provenance.positions).toContain('not surveyed');
});
