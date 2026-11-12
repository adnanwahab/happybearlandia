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
export function inspectNeighborhoodSelection(model,input){
  const bounds=selectionBounds(input),p=model.people,window=model.selectionActivity;
  const validWindow=window?.tick===model.tick&&window.changed instanceof Uint8Array&&window.changed.length===p.age.length&&window.changed.every(value=>value<=1)&&Number.isFinite(window.fromMinute)&&window.fromMinute<=window.toMinute&&window.toMinute===model.minute;
  let simulatedAgents=0,activeAgents=validWindow?0:null;
  for(let i=0;i<p.age.length;i++)if(p.x[i]>=bounds.minX&&p.x[i]<=bounds.maxX&&p.z[i]>=bounds.minZ&&p.z[i]<=bounds.maxZ){simulatedAgents++;if(activeAgents!==null)activeAgents+=window.changed[i];}
  return {schemaVersion:'population-selection.v1',bounds,tick:model.tick,minute:model.minute,modelVersion:model.modelVersion,seed:model.config.seed,sourceSnapshotId:model.config.snapshotId,source:'authoritative synthetic Population state; current positions, inclusive edges',window:activeAgents===null?null:{fromMinute:window.fromMinute,toMinute:window.toMinute},simulatedAgents,activeAgents,currentInteractions:null,aggregateOnlyPersons:model.weight===1?0:null,limitations:['Active means distinct residents with a change to position, activity, travel remaining or basic needs during the last committed step; excludes other state fields.','Current interactions unavailable: no complete spatial interaction ledger.','Represented weights are not separately located aggregate-only persons; weighted spatial count unavailable.']};
}
