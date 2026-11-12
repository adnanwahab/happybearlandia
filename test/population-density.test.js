import {test,expect} from 'bun:test';
import {populationDensity,densityLegend,densityColor} from '../world/population/density.js';
import {createPopulationModel,snapshotPopulation,stepPopulation} from '../world/population/model.js';
test('tile boundaries, missing and outside positions reconcile without clamping',()=>{
 const model={locations:[{x:0,z:0},{x:2,z:2}],people:{x:[-1,3,1,NaN,4],z:[-1,3,1,0,0]},weight:10,config:{seed:42},tick:3,minute:90};
 const field=populationDensity(model,2);expect(field.explicit).toEqual([1,0,0,2]);expect(field.weighted).toEqual([10,0,0,20]);expect(field.located+field.missing+field.outside).toBe(field.total);expect(field.representedTotal).toBe(50);expect(densityLegend(field,'weighted')).toContain('Weighted cohorts');expect(densityLegend(field,'explicit')).toContain('Explicit active agents');expect(densityColor(0,0)).toBe('#142d35');expect(()=>populationDensity(model,0)).toThrow();
});
test('full model totals, selected tick and deterministic replay are independent of visible sample',()=>{
 const config={population:100,representedPopulation:10000,seed:42};const world={buildings:[{id:'a',center:[-100,-100]},{id:'b',center:[100,100]}]},a=createPopulationModel(config,world),b=createPopulationModel(config,world);
 const initial=snapshotPopulation(a,{visibleLimit:0}).density;
 expect(initial.located).toBe(100);expect(initial.weighted.reduce((a,b)=>a+b,0)).toBe(10000);
 for(let tick=1;tick<=16;tick++){stepPopulation(a,{tick,minutes:30});stepPopulation(b,{tick,minutes:30});}
 const field=snapshotPopulation(a,{visibleLimit:1}).density;expect(field).toEqual(snapshotPopulation(b,{visibleLimit:50}).density);expect(field.tick).toBe(16);expect(field.located+field.outside+field.missing).toBe(a.metrics.syntheticPopulation);expect(field.representedTotal).toBe(a.metrics.representedPopulation);expect(field.explicit).not.toEqual(initial.explicit);
});
