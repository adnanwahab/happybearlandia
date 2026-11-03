import {canAttendAutonomousSocial} from './autonomy-adapter.js';
import {advanceHouseParties} from './party.js';
export function advanceConfiguredParties(model){if(!model.houseParties)return;const prior=new Set(Object.values(model.houses?.active??{}).map(row=>row.actionId));advanceHouseParties(model,{canAct:(m,i)=>canAttendAutonomousSocial(m,i)});for(const home of Object.values(model.houses?.homes??{}))for(const action of home.actions)if(!prior.has(action.id)&&!action.origin){action.origin='autonomy';action.autonomyReason='Idle invited guest at an active household party';}}
