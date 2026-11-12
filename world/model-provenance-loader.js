import {withMetadataDeadline} from './onboarding/first-run-repairs.js';

// A separate HTML entry point keeps these definitions available even when a
// graphics module cannot load. Runtime configuration remains render.js-owned.
export const modelDefinitions=withMetadataDeadline(Promise.all([
 import('./simulation-parameters.js'),import('./simulation-observations.js'),
]));

if(typeof document!=='undefined'){
 const host=document.getElementById('simulationModelMetadata');
 window.hblSimulationModel={status:'loading',authority:'legacy daily parameter definitions (separate simulation authority)'};
 void modelDefinitions.then(([parameters])=>{
  if(window.hblSimulationModel?.status==='ready')return;
  window.hblSimulationModel={status:'definitions-ready',authority:parameters.SIMULATION_MODEL_METADATA.authority,configuredParameters:null};
  if(!host)return;
  host.replaceChildren();
  const summary=document.createElement('p');
  summary.textContent='Synthetic parameter definitions loaded independently of graphics. Runtime values appear when the scene is ready; these assumptions are not empirical measurements.';
  const details=document.createElement('details'),title=document.createElement('summary'),pre=document.createElement('pre');
  title.textContent='Parameter definitions and provenance';
  pre.textContent=JSON.stringify(parameters.SIMULATION_PARAMETER_SCHEMA,null,2);
  pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
  details.append(title,pre);host.append(summary,details);
 }).catch(error=>{
  if(window.hblSimulationModel?.status==='ready')return;
  window.hblSimulationModel={status:'unavailable',error:error.message};
  if(host)host.textContent=`Model metadata unavailable: ${error.message}`;
 });
}
