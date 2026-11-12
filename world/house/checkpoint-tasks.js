import {readPopulationCheckpoint} from '../population/checkpoint.js';
import {compatiblePopulationContinuation} from '../population/population-growth.js';
import {validateHouseEntry} from './bridge.js';
import {deriveHouseSite} from './site.js';

// Return only the metadata needed by the view; the complete population stays off the UI thread.
export function runHouseCheckpointTask({kind,save,householdId,originalCheckpoint}){
 const decoded=readPopulationCheckpoint(save.checkpoint);
 const entry=validateHouseEntry(save,householdId,{checkpointState:decoded});
 if(kind==='autosave'){
  const original=readPopulationCheckpoint(originalCheckpoint).model,current=decoded.model;
  if(current.minute<original.minute||!compatiblePopulationContinuation(original,current))throw Error('Automatically saved progress belongs to a different city or an earlier clock');
 }
 if(!['prepare','autosave'].includes(kind))throw Error('Unknown household checkpoint task');
 return{entry,site:deriveHouseSite(save,{householdId,buildingId:save.view?.houseMode?.buildingId,checkpointState:decoded}),config:decoded.model.config,runtime:decoded.runtime};
}
