import {createWorldRuntime} from './world-runtime.js';
import {legacyFrameFromWorldSnapshot} from './legacy-adapter.js';
export function createWorldSimulationBridge(options={}){
 const runtime=options.runtime??createWorldRuntime({...options,worldContext:options.worldContext??{buildings:options.town?.buildings??[]}});let destroyed=false;
 const frame=options=>{if(destroyed)throw new Error('Simulation bridge destroyed');return legacyFrameFromWorldSnapshot(runtime.snapshot(options));};
 return{runtime,step(minutes,options){runtime.step(minutes,options);return frame(options);},snapshot:frame,worldSnapshot:options=>runtime.snapshot(options),observe:()=>runtime.observe(),applyScenario:input=>runtime.applyScenario(input),inspectPerson:id=>runtime.inspectPerson(id),inspectHousehold:id=>runtime.inspectHousehold(id),inspectBusiness:id=>runtime.inspectBusiness(id),pause:()=>runtime.pause(),resume:()=>runtime.resume(),serialize:()=>runtime.serialize(),restore:state=>runtime.restore(state),destroy(){if(!destroyed){destroyed=true;runtime.destroy();}}};
}
