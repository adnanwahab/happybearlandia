/** Read-only projection of committed Population travel; no routing or clock. */
export function currentTrip(model,i){
 const p=model.people;
 if(!(p.remaining[i]>0))return null;
 return {schemaVersion:'population-current-trip.v1',departureMinute:p.departureMinute[i],durationMinutes:p.tripTotal[i],remainingMinutes:p.remaining[i],plannedActivity:p.plannedActivity[i],from:{x:p.fromX[i],z:p.fromZ[i]},to:{x:p.toX[i],z:p.toZ[i]},geometry:'straight-line model approximation'};
}
export function tripHeading(row){const t=row.trip;return t?Math.atan2(t.to.x-t.from.x,t.to.z-t.from.z):0;}
export function tripVehicle(row){return row.trip&&['car','bus','rail'].includes(row.mode)?row.mode:null;}
const purposes={0:'home',1:'work',2:'school',3:'shopping',4:'an errand',5:'a meal',6:'recreation',7:'healthcare'};
export function tripHoverText(row){if(!row)return '';const t=row.trip;return `${row.name||row.id} · ${t?`heading to ${purposes[t.plannedActivity]||'destination'} · ${Math.round(t.durationMinutes)} min planned trip · ${row.mode}`:(row.currentActivity||'activity unavailable').toLowerCase()}${tripVehicle(row)&&row.mode!=='car'?' · passenger marker':''}`;}
