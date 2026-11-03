/** Compatibility presentation of the single authoritative visit registry. */
import {inspectVisitors,guestCandidates} from './visits.js';
export function visitorRows(model,householdId){const h=Number(householdId.slice(`${model.prefix}-h`.length)),p=model.people;return inspectVisitors(model,h).map(v=>{const i=Number(v.id.slice(`${model.prefix}-p`.length));return{...v,index:i,label:v.name,name:v.name,ageYears:p.ageYears[i],guest:true,roomId:v.atHome?'living':null,currentActivity:v.atHome?'VISITING':'TRANSIT',needs:{hunger:p.hunger[i],energy:p.energy[i],fun:p.fun[i],social:p.social[i]}};});}
export function invitationCandidates(model,householdId,options={}){return guestCandidates(model,{householdId,...options});}
