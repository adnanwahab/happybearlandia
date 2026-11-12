/** Model definitions load independently of 3D startup and graphics capability. */
const host=document.getElementById('simulationModelMetadata');
if(host){
  let settled=false;
  host.setAttribute('role','status');
  const show=(text)=>{if(!settled && window.hblSimulationModel?.status!=='ready')host.textContent=text;};
  const timeout=setTimeout(()=>show('Model information is taking longer than expected. The synthetic parameter definitions remain separate from 3D startup; reload or switch to low-fidelity mode if the scene is unavailable.'),8500);
  import('./simulation-parameters.js').then(module=>{
    settled=true;clearTimeout(timeout);
    if(window.hblSimulationModel?.status==='ready')return;
    const defs=module.SIMULATION_PARAMETER_SCHEMA??{},metadata=module.SIMULATION_MODEL_METADATA??{};
    host.replaceChildren();
    const summary=document.createElement('p');
    summary.textContent=Object.keys(defs).length+' declared synthetic parameters loaded independently of the renderer. These are assumptions, not empirical city measurements.';
    host.append(summary);
    const details=document.createElement('details'),title=document.createElement('summary'),pre=document.createElement('pre');
    title.textContent='Parameter definitions and provenance';pre.textContent=JSON.stringify({schemaVersion:metadata.schemaVersion,authority:metadata.authority,parameters:defs},null,2);
    pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto';
    details.append(title,pre);host.append(details);
  }).catch(error=>{
    clearTimeout(timeout);
    show('Model definitions could not load ('+error.message+'). This is not evidence that the simulation has no modeled parameters.');
    settled=true;
  });
}
