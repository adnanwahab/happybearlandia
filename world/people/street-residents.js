/** Read-only resident discovery, not measured foot traffic or a rendering census.
 * Legacy uses the same exterior eligibility as render.js before quality thinning.
 * Living only classifies explicit walking trips: other sampled locations do not
 * establish whether a resident is indoors. Unknown/invalid rows stay unclassified.
 */
export function chooseStreetResidents(people,{mode='legacy'}={}){
 if(!Array.isArray(people))return [];
 if(!['legacy','living'].includes(mode))return [];
 return people.filter(person=>{
  if(!person||person.id==null||!Number.isFinite(person.x)||!Number.isFinite(person.z))return false;
  if(mode==='living')return person.mode==='walk'&&Boolean(person.trip)&&Number.isFinite(person.trip.remainingMinutes)&&person.trip.remainingMinutes>0;
  const exterior=person.mode==='moving'||['play_park','clean_park'].includes(person.action);
  return exterior&&(person.travelMode!=='transit'||person.transitWaitMinutesRemaining>0);
 });
}
