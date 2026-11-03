/** Advertise only installed inventory and action capabilities actually exposed by the worker. */
const core={bed:['sleep','rest'],couch:['rest'],stove:['cook'],diningTable:['eat','sit','sharedDinner'],books:['read'],music:['music'],tv:['watchTV','watchMovie'],computer:['computerPlay','computerBrowse','computerStudy'],desk:['quietWorkspace'],shower:['shower'],toilet:['toilet']};
const names={sleep:'Sleep',rest:'Rest here',cook:'Cook a meal',eat:'Eat a prepared meal',sit:'Sit here',sharedDinner:'Eat together',read:'Read a book',music:'Play music',watchTV:'Watch TV',watchMovie:'Watch a movie',computerPlay:'Play computer games',computerBrowse:'Browse the web',computerStudy:'Study on computer',quietWorkspace:'Arrange workspace',shower:'Take a shower',toilet:'Use the toilet',repair:'Repair this item',callRepair:'Pay for a repair',sitAtSeat:'Sit here',nap:'Take a short nap',readAtSeat:'Read here',watchTVFromSeat:'Watch TV from here',cuddle:'Cuddle'};
const seats=new Set(['bed','couch','armchair','ottoman','gardenBench']);
function skillLevel(home,person,id){const member=home.progression?.members?.find(row=>row.personId===person?.id);return member?.skills?.find(skill=>skill.id===id)?.level??person?.skills?.find?.(skill=>skill.id===id)?.level??null;}
export function advertisedObjectActions({object,home={},person,partner,consentingPersonIds=[],consentFlow=false}={}){
 const actual=home.objects?.find(row=>row.id===object?.id);if(!actual||actual.decorative)return[];const definitions=home.actionCatalog??{},types=new Set(core[actual.type]??[]);
 for(const [type,definition]of Object.entries(definitions))if(Array.isArray(definition.objectTypes)&&(definition.objectTypes.includes('*')||definition.objectTypes.includes(actual.type)))types.add(type);
 if(actual.type==='couch'&&definitions.cuddle)types.add('cuddle');
 if(actual.garden&&definitions.garden)types.add('garden');if(home.life?.conditions?.[actual.id]?.broken){if(definitions.repair)types.add('repair');if(definitions.callRepair)types.add('callRepair');}
 const result=[];for(const type of types){const definition=definitions[type];if(!definition||definition.requiresSystemOptions===true||!Number.isFinite(definition.durationMinutes)||definition.durationMinutes<=0)continue;let supported=true,reason=null;const deny=message=>{supported=false;reason??=message;};
  if(!person?.id)deny('Choose an actual resident first');else if(person.atHome===false)deny('This resident is away from home');else if(Number.isFinite(definition.minAge)&&(!Number.isFinite(person.ageYears)||person.ageYears<definition.minAge))deny('Requires age '+definition.minAge+' or older');
  if(type==='readAtSeat'&&!home.objects.some(row=>row.type==='books'))deny('Place a bookshelf before reading here');
  if(type==='watchTVFromSeat'&&!home.objects.some(row=>row.type==='tv'&&row.roomId===actual.roomId))deny('Place a television in this room');
  if(type==='waterPlants'&&actual.type==='wateringCan'&&!home.objects.some(row=>row.garden))deny('Place a garden plant before watering');
  const requirement=definition.skillRequirement;if(requirement){const level=skillLevel(home,person,requirement.id);if(!Number.isFinite(level)||level<requirement.level)deny((requirement.label??requirement.id)+' level '+requirement.level+' required');}
  const command={type,objectId:actual.id,roomId:actual.roomId};
  if(definition.requiresPartner||type==='cuddle'){if(!person?.id||!partner?.id||person.id===partner.id||person.ageYears<18||partner.ageYears<18||partner.atHome===false)deny('Choose two adult residents who are here');else{command.personIds=[person.id,partner.id];if(!command.personIds.every(id=>consentingPersonIds.includes(id))){if(!consentFlow)deny('Both adults must explicitly consent');}else command.consentingPersonIds=[...command.personIds];}}
  result.push({id:'object:'+actual.id+':'+type,label:names[type]??definition.label??type,command,durationMinutes:definition.durationMinutes,requires:definition.requires??[],mechanism:definition.mechanism??'Uses this installed object through elapsed simulation time',supported,available:supported,reason,objectId:actual.id,...(definition.requiresPartner||type==='cuddle'?{requiresPartner:true,requiresConsent:true}:{})});
 }
 // Seat-specific actions precede generic care so the primary purpose remains easy to find.
 const order=seats.has(actual.type)?['sitAtSeat','nap','readAtSeat','watchTVFromSeat','cuddle','rest','relaxObject']:core[actual.type]??[];
 return result.sort((a,b)=>{const rank=t=>{const n=order.indexOf(t);return n<0?100:n;};return rank(a.command.type)-rank(b.command.type)||a.label.localeCompare(b.label);});
}
export function objectAffordanceSummary(context){return Object.fromEntries(advertisedObjectActions(context).filter(row=>row.supported).map(row=>[row.command.type,true]));}
