import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
import {createPinboard,spatialRecord,comparisonRows} from '../world/comparison-pinboard.js';
const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:1000});
const world=createWorld(town,{runSeed:'469',recordHistory:true});
const before=JSON.stringify(world.captureCheckpoint());
const samples=[];
for(let i=0;i<120;i++){
 const start=performance.now(),board=createPinboard();board.start();
 board.capture(spatialRecord(town,world,'building',town.buildings[0].id));
 board.capture(spatialRecord(town,world,'building',town.buildings[1].id));
 comparisonRows(...board.state().pins);
 if(i>=20)samples.push(performance.now()-start);
}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({scope:'Bun CPU: two lookups, provenance reads, detached pins and matched rows. Excludes DOM, graphics and browser input.',runtime:Bun.version,synthetic:true,seed:world.getActivitySnapshot().seed,townSeed:town.seedKey,modelVersion:world.modelVersion,minute:world.t,residents:world.people.length,buildings:town.buildings.length,warmups:20,iterations:samples.length,p50Ms:samples[49],p95Ms:samples[94],maxMs:samples.at(-1),checkpointUnchanged:JSON.stringify(world.captureCheckpoint())===before},null,2));
