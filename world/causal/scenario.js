import {canonicalId} from '../../shared/causality/index.js';
import {createCity} from '../city/seed.js';
import {addIntervention,scheduleShock} from '../city/engine.js';
import {VERSION} from '../city/contracts.js';
import {demoRunId} from './demo.js';
import {createWorldCausalAdapter} from './adapter.js';
/** Fixed synthetic world-only fixture; roads are district links, not observed geometry. */
export function createWorldCausalScenario(){
 let initialState=createCity({seed:2911,households:18});
 initialState.parcels.forEach(p=>p.capacity=0);
 initialState.utilities.forEach(u=>u.capacity=1000);
 initialState.districts[1].floodRisk=1;
 initialState=addIntervention(initialState,{type:'housing',districtId:'d0',amount:3,cost:1000});
 initialState=scheduleShock(initialState,{type:'flood',districtId:'d1',start:2,duration:2,severity:1});
 const context={universeId:canonicalId('universe','hbl','demo'),worldId:canonicalId('world','hbl','causal-city'),scenarioId:canonicalId('scenario','hbl','world-only-v1'),runId:demoRunId,seed:2911,modelVersion:VERSION,tick:0};
 return createWorldCausalAdapter({context,initialState});
}
