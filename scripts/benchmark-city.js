import {createCity} from '../world/city/seed.js';
import {createEngine,cityMetrics} from '../world/city/engine.js';
const runs=Number(process.argv[2]||1000),months=Number(process.argv[3]||12),households=Number(process.argv[4]||30);
if(!Number.isInteger(runs)||runs<1||runs>1000)throw new Error('Use 1–1000 futures');
const engine=createEngine(),initial=createCity({households}),start=performance.now();let checksum=0;
for(let index=0;index<runs;index++){const state=structuredClone(initial);state.seed=(state.seed+index)>>>0;const result=engine.run(state,months);checksum+=cityMetrics(result.state).population;}
console.log(JSON.stringify({runs,months,initialHouseholds:households,durationMs:Math.round(performance.now()-start),populationChecksum:checksum,scope:'Engine only; excludes SQLite, workers and UI. Synthetic fixture.'}));
