// Diagnostic state only; never feeds simulation decisions or the random stream.
export const SELECTION_FIELDS=['x','z','activity','remaining','hunger','energy','fun','social'];
export function beginSelectionWindow(model){
  return {minute:model.minute,values:Object.fromEntries(SELECTION_FIELDS.map(key=>[key,model.people[key].slice()])),changed:new Uint8Array(model.people.age.length)};
}
export function recordSelectionChanges(model,before,window){
  for(let i=0;i<window.changed.length;i++)if(!window.changed[i]&&SELECTION_FIELDS.some(key=>model.people[key][i]!==before.values[key][i]))window.changed[i]=1;
}
export function selectionBounds(input){
  if(!input||!['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(input[k])&&Math.abs(input[k])<=1e6)||input.minX>input.maxX||input.minZ>input.maxZ)throw Error('Selection requires ordered finite bounds within the world.');
  return Object.fromEntries(['minX','maxX','minZ','maxZ'].map(k=>[k,input[k]]));
}
export const MAX_SELECTION_IDS=2048, MAX_LASSO_POINTS=256;
export function selectionPolygon(input){
  if(!Array.isArray(input)||input.length<3||input.length>MAX_LASSO_POINTS||!input.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=1e6&&Math.abs(p.z)<=1e6))throw Error('Lasso requires 3–256 finite ground points within the world.');
  return input.map(p=>({x:p.x,z:p.z}));
}
export function insidePolygon(x,z,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],cross=(x-a.x)*(b.z-a.z)-(z-a.z)*(b.x-a.x);
    if(Math.abs(cross)<1e-8&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)&&z>=Math.min(a.z,b.z)&&z<=Math.max(a.z,b.z))return true;
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
export function inspectNeighborhoodSelection(model,input){
  const polygon=input?.polygon?selectionPolygon(input.polygon):null;
  const bounds=polygon?{minX:Math.min(...polygon.map(p=>p.x)),maxX:Math.max(...polygon.map(p=>p.x)),minZ:Math.min(...polygon.map(p=>p.z)),maxZ:Math.max(...polygon.map(p=>p.z))}:selectionBounds(input),p=model.people,window=model.selectionActivity;
  const entityIds=[];
  const validWindow=window?.tick===model.tick&&window.changed instanceof Uint8Array&&window.changed.length===p.age.length&&window.changed.every(value=>value<=1)&&Number.isFinite(window.fromMinute)&&window.fromMinute<=window.toMinute&&window.toMinute===model.minute;
  let simulatedAgents=0,activeAgents=validWindow?0:null;
  for(let i=0;i<p.age.length;i++)if(p.x[i]>=bounds.minX&&p.x[i]<=bounds.maxX&&p.z[i]>=bounds.minZ&&p.z[i]<=bounds.maxZ&&(!polygon||insidePolygon(p.x[i],p.z[i],polygon))){simulatedAgents++;if(entityIds.length<MAX_SELECTION_IDS)entityIds.push(`${model.prefix}-p${i}`);if(activeAgents!==null)activeAgents+=window.changed[i];}
  return {schemaVersion:'population-selection.v1',bounds,entityIds,selectionStatus:simulatedAgents>MAX_SELECTION_IDS?'too-large':simulatedAgents?'complete':'empty',idLimit:MAX_SELECTION_IDS,tick:model.tick,minute:model.minute,modelVersion:model.modelVersion,seed:model.config.seed,sourceSnapshotId:model.config.snapshotId,source:'authoritative synthetic Population state; current positions, inclusive edges',window:activeAgents===null?null:{fromMinute:window.fromMinute,toMinute:window.toMinute},simulatedAgents,activeAgents,currentInteractions:null,aggregateOnlyPersons:model.weight===1?0:null,limitations:['Active means distinct residents with a change to position, activity, travel remaining or basic needs during the last committed step; excludes other state fields.','Current interactions unavailable: no complete spatial interaction ledger.','Represented weights are not separately located aggregate-only persons; weighted spatial count unavailable.']};
}
