import {commitmentForTie,relationshipDecisionAvailability} from './relationships.js';
import {physicalHouseMembers} from './roommate-roster.js';
const copy=v=>structuredClone(v),check=(ok,message)=>{if(!ok)throw Error(message);};
export function changeRelationship(model,home,input){
 check(Object.keys(input).every(k=>['type','personId','targetId','commandId','consentingPersonIds'].includes(k)),'Unsupported relationship fields');
 check(['end','reunite'].includes(input.type),'Choose a relationship action');
 check(typeof input.commandId==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(input.commandId),'Use a stable relationship request ID');
 const ids=[input.personId,input.targetId],prefix=model.prefix+'-p',indices=ids.map(id=>typeof id==='string'?Number(id.slice(prefix.length)):NaN);
 check(indices.every((i,n)=>Number.isInteger(i)&&i>=0&&i<model.people.age.length&&ids[n]===prefix+i)&&ids[0]!==ids[1],'Choose two actual different Sims');
 const h=Number(home.householdId.slice((model.prefix+'-h').length));check(physicalHouseMembers(model,h).includes(indices[0]),'Control a resident of this household');
 const key=JSON.stringify([...ids].sort()),saved=model.social?.ties?.[key];check(saved,'Choose an existing relationship');
 const prior=(saved.commitmentMilestones??[]).find(row=>row.actionId===input.commandId);if(prior){check(prior.event===(input.type==='end'?'relationship-ended':'relationship-restarted')&&prior.personIds[0]===ids[0],'Do not reuse a relationship request ID');return{accepted:true,status:prior.status};}
 const status=commitmentForTie(saved).status;
 if(input.type==='end')check(['dating','engaged','married','separated'].includes(status),'These Sims are not in a relationship');
 else{check(['none','divorced'].includes(status)&&saved.previouslyDated,'Choose former partners');const consent=input.consentingPersonIds;check(Array.isArray(consent)&&consent.length===2&&new Set(consent).size===2&&ids.every(id=>consent.includes(id)),'Both Sims must agree to get back together');const gate=relationshipDecisionAvailability(model,...ids,'askOnDate',{mutualConsent:true});check(gate.available,gate.reason);}
 const tie=copy(saved),next=input.type==='reunite'?'dating':['married','separated'].includes(status)?'divorced':'none',event=input.type==='end'?'relationship-ended':'relationship-restarted',name=(id,i)=>model.houseProfiles?.people?.[id]?.name??'Resident '+(i+1),names=ids.map((id,n)=>name(id,indices[n]));
 const text=input.type==='end'?names[0]+' ended the relationship with '+names[1]+'.':names.join(' and ')+' agreed to get back together.';
 tie.commitment={...commitmentForTie(tie),schemaVersion:'house-commitment.v1',status:next,lastChangedMinute:model.minute,lastActionId:input.commandId};delete tie.commitment.source;if(next==='dating')tie.commitment.datingSinceMinute=model.minute;if(next==='divorced')tie.commitment.divorcedSinceMinute=model.minute;
 tie.dating=next==='dating';tie.previouslyDated=true;if(input.type==='end')tie.romance=0;
 tie.memories=[...(tie.memories??[]),{sourceCommandId:input.commandId,minute:model.minute,event,text,source:'Explicit player relationship decision',mutualConsent:input.type==='reunite'}].slice(-12);
 tie.commitmentMilestones=[...(tie.commitmentMilestones??[]),{actionId:input.commandId,event,minute:model.minute,personIds:ids,text,status:next}].slice(-32);
 model.social.ties[key]=tie;return{accepted:true,status:next,message:text};
}
export const createRelationshipControlSystem=()=>({id:'relationship-control',command:changeRelationship,inspect:()=>({}),validate:()=>true});
