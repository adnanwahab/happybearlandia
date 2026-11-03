const first=['Maya','Jordan','Avery','Sam','Riley','Alex','Morgan','Jamie','Taylor','Casey','Robin','Quinn','Rowan','Cameron','Sasha','Emery'];
const last=['Rivera','Chen','Patel','Brooks','Kim','Reed','Morgan','Park','Ellis','Bennett','Wong','Hayes','Santos','Clarke','Singh','Shah'];
/** Fictional display names remain stable across dates without changing actual resident IDs. */
export function dateDisplayPerson(person={}){if(person.name&&!/^resident[\s_-]*\d+$/i.test(person.name))return person;const id=String(person.id??person.personId??'');if(!id)return person;let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);hash>>>=0;return{...person,name:first[hash%first.length]+' '+last[(hash>>>8)%last.length],generatedDisplayName:true};}
export function dateDisplayState(dates){return dates?.active?{...dates,active:{...dates.active,people:(dates.active.people??[]).map(dateDisplayPerson)}}:dates;}
