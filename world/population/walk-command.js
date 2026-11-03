import {modeAlternatives,eventEffects} from './behavior.js';
import {childModePermission,parentCareConstraint} from './children.js';
import {recordEvent,recordTrace,MODES} from './contracts.js';
export const MAX_WALK_COMMANDS=256;
const reject=message=>{throw new Error(message);};
export function validateWalkDestination(destination){
 if(destination?.home===true&&Object.keys(destination).length===1)return{home:true};
 if(!destination||typeof destination!=='object'||Array.isArray(destination)||Object.keys(destination).some(k=>!['x','z','locationId','districtId'].includes(k)))reject('Walk destination must specify bounded x/z or an actual locationId');
 if(destination.locationId!==undefined){if(typeof destination.locationId!=='string'||!destination.locationId||destination.locationId.length>160||destination.x!==undefined||destination.z!==undefined)reject('Use an actual locationId without coordinates');}
 else if(![destination.x,destination.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1000000))reject('Walk coordinates must be finite and within the world bounds');
 if(destination.districtId!==undefined&&(typeof destination.districtId!=='string'||!destination.districtId||destination.districtId.length>160))reject('Walk districtId must be an actual bounded district ID');
 return structuredClone(destination);
}
/** The command admits a normal walking trip at this committed minute; it never
 * steps residents or writes position/needs/money to simulate a trip's outcome. */
export function applyWalkCommand(model,id,input){
 const destination=validateWalkDestination(input),p=model.people,prefix=`${model.prefix}-p`,index=typeof id==='number'?id:typeof id==='string'&&id.startsWith(prefix)?Number(id.slice(prefix.length)):NaN;
 if(!Number.isInteger(index)||index<0||index>=p.age.length||typeof id==='string'&&id!==`${prefix}${index}`)reject('Unknown population person for walk command');
 if(model.visits?.active?.[index])reject('Use Send home for a resident with an active visit');
 if(destination.home){
  if(Object.keys(model.manualWalks??{}).length>=32&&!model.manualWalks?.[index])reject('At most 32 resident movement requests may be active');
  if(p.remaining[index]<=1e-9&&p.current[index]===p.home[index]&&Math.hypot(p.x[index]-p.homeX[index],p.z[index]-p.homeZ[index])<1)reject('This resident is already home');
  const minute=model.minute,personId=`${prefix}${index}`,command={tick:model.tick,minute,id:personId,destination};
  model.manualWalks??={};model.manualWalks[index]={home:true,commandMinute:minute,until:minute+1440,personId,destination:{district:p.home[index],x:p.homeX[index],z:p.homeZ[index],location:p.homeLocation[index]}};p.planUntil[index]=0;
  recordEvent(model,'RETURN_HOME_REQUESTED',{personId,reason:'Return to actual home using ordinary feasible travel; current trips finish first'});return{accepted:true,command,personId,minute,queued:p.remaining[index]>1e-9,pausedClockUnchanged:true};
 }
 if(model.houses?.active?.[index])reject('This resident has an active household action');
 if(p.remaining[index]>1e-9)reject('This resident is already traveling; wait for the current trip to finish');
 const permission=childModePermission(model,index,'walk');if(!permission.available)reject(permission.reason);
 if(parentCareConstraint(model,index,model.minute))reject('CHILDCARE_UNAVAILABLE: this guardian must supervise children');
 if(Object.keys(model.manualWalks??{}).length>=32&&!model.manualWalks?.[index])reject('At most 32 resident walk commands may be active');
 let location=4294967295,x=destination.x,z=destination.z,district;
 if(destination.locationId!==undefined){location=model.locations.findIndex(row=>String(row.id)===destination.locationId);if(location<0)reject('Unknown actual walk destination location');const row=model.locations[location];x=row.x;z=row.z;district=model.districts.findIndex(d=>d.anchorLocations.includes(location));}
 if(destination.districtId!==undefined){const explicit=model.districts.findIndex(row=>row.id===destination.districtId);if(explicit<0||district!==undefined&&district!==explicit)reject('Unknown or inconsistent walk destination district');district=explicit;}
 if(district===undefined){let distance=Infinity;for(let i=0;i<model.districts.length;i++){const row=model.districts[i],d=Math.hypot(x-row.x,z-row.z);if(d<distance){distance=d;district=i;}}}
 if(!Number.isInteger(district)||district<0||district>=model.districts.length||![x,z].every(Number.isFinite))reject('Walk destination has no valid model anchor');
 if(Math.hypot(x-p.x[index],z-p.z[index])<1)reject('This resident is already at the destination');
 const walk=modeAlternatives(model,index,district,eventEffects(model,model.minute),[x,z]).find(row=>row.id==='walk');if(!walk?.available||!Number.isFinite(walk.minutes)||walk.minutes<=0)reject(walk?.rejectedReason??'Destination exceeds the modeled walking distance limit');
 const minute=model.minute,personId=`${prefix}${index}`,command={tick:model.tick,minute,id:personId,destination},arrivalMinute=minute+walk.minutes;
 // Reuse the same fields and ledger increments as an ordinary committed trip.
 p.mode[index]=MODES.indexOf('walk');p.from[index]=p.current[index];p.to[index]=district;p.fromX[index]=p.x[index];p.fromZ[index]=p.z[index];p.toX[index]=x;p.toZ[index]=z;p.toLocation[index]=location;
 p.remaining[index]=p.tripTotal[index]=walk.minutes;p.departureMinute[index]=minute;p.commute[index]=walk.minutes;p.activity[index]=8;p.plannedActivity[index]=9;p.plannedUntil[index]=arrivalMinute+5;p.planUntil[index]=0;p.restingUntil[index]=0;p.eatingUntil[index]=0;
 model.manualWalks??={};model.manualWalks[index]={commandMinute:minute,arrivalMinute,until:arrivalMinute+5,destination:{district,x,z,location},personId};
 model.totals.trips++;model.totals.plannedTravelMinutes+=walk.minutes;model.totals.tripCountsByMode.walk=(model.totals.tripCountsByMode.walk??0)+1;
 recordEvent(model,'PLAYER_WALK_REQUESTED',{personId,destination:{x,z,locationId:location===4294967295?null:String(model.locations[location].id)},route:walk.route,plannedMinutes:walk.minutes});
 recordEvent(model,'TRIP_STARTED',{personId,from:model.districts[p.current[index]].id,to:model.districts[district].id,mode:'walk',plannedMinutes:walk.minutes,activity:'OTHER',reason:'Player requested walk'});
 recordTrace(model,'person',index,{tick:model.tick,minute,type:'PLAYER_WALK_REQUESTED',chosen:'walk',reasonCodes:['PLAYER_DIRECTED_FEASIBLE_WALK'],reason:'Actual walk permission and modeled route validated; elapsed travel is committed by the ordinary population clock.',destination:{x,z},route:walk.route,plannedMinutes:walk.minutes});
 return{accepted:true,command,personId,minute,arrivalMinute,plannedMinutes:walk.minutes,destination:{x,z,locationId:location===4294967295?null:String(model.locations[location].id),districtId:model.districts[district].id},route:walk.route,pausedClockUnchanged:true};
}
