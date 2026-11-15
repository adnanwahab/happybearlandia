/** Authored starting fixtures only: no saved residents or production state. */
import {createCity} from '../city/seed.js';
export const MISSION_CHECKPOINTS=Object.freeze({'city-small-42.v1':42,'city-small-73.v1':73});
export function missionCheckpoint(id){
 if(!Object.hasOwn(MISSION_CHECKPOINTS,id))throw Error('Starting checkpoint unavailable; choose a supported synthetic checkpoint.');
 return createCity({seed:MISSION_CHECKPOINTS[id],households:6});
}
