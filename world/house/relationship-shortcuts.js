/** Read-only UI adapters. Canonical worker admission remains the final authority. */
const id=p=>p?.id??p?.personId;
const fail=reason=>({available:false,reason});
export function relationshipShortcutAvailability({actor,target,relationship,decision}={}){
 if(!['propose','marry'].includes(decision))return fail('Choose a supported commitment event.');
 if(!actor||!target||id(actor)===id(target)||relationship?.personId!==id(target))return fail('Choose two actual partners.');
 if(!Number.isFinite(actor.ageYears)||!Number.isFinite(target.ageYears)||actor.ageYears<18||target.ageYears<18)return fail('Both partners must be adults.');
 if(actor.atHome!==true||target.atHome!==true)return fail('Both partners must be here. Invite your partner over first.');
 const gate=relationship.decisionAvailability?.find(row=>row.id===decision);
 if(gate?.available!==true)return fail(gate?.reason??'This saved simulation has not confirmed eligibility for this event.');
 const durationMinutes=Math.max(60,gate.requiredDurationMinutes??60);
 if(!Number.isInteger(durationMinutes)||durationMinutes>120||durationMinutes%5)return fail('This commitment duration cannot be represented by the saved simulation.');
 return{available:true,durationMinutes};
}
export function relationshipShortcutRequest({actor,target,relationship,decision,consentingPersonIds}={}){
 const gate=relationshipShortcutAvailability({actor,target,relationship,decision});if(!gate.available)throw Error(gate.reason);
 const ids=[id(actor),id(target)];if(!Array.isArray(consentingPersonIds)||consentingPersonIds.length!==2||new Set(consentingPersonIds).size!==2||!ids.every(value=>consentingPersonIds.includes(value)))throw Error('Both actual partners must explicitly agree.');
 return{type:'conversation',personId:ids[0],personIds:ids,relationshipDecision:decision,relationshipIntent:'romantic',consentingPersonIds:[...consentingPersonIds],durationMinutes:gate.durationMinutes,topic:'plans',conversationChoice:'chat',interrupt:true};
}
export function partnerMoveInAvailability({actor,target,relationship,home,householdMemberIds=[]}={}){
 if(!actor||!target||id(actor)===id(target)||relationship?.personId!==id(target))return fail('Choose your actual partner.');
 if(!['engaged','married'].includes(relationship.commitment?.status))return fail('Move in together requires an engaged or married relationship.');
 if(!Number.isFinite(actor.ageYears)||!Number.isFinite(target.ageYears)||actor.ageYears<18||target.ageYears<18)return fail('Both partners must be adults.');
 if(actor.atHome!==true||target.atHome!==true)return fail('Both partners must be here.');
 if(householdMemberIds.includes(id(target))||home?.roommates?.some(p=>id(p)===id(target)))return fail('Your partner already lives in this household.');
 if(!home?.visitors?.some(p=>id(p)===id(target)&&p.phase==='visiting'))return fail('Invite your partner inside first.');
 return{available:true,reason:'Review the existing roommate agreement. Both partners must agree; bed and care constraints are checked by the simulation.'};
}
