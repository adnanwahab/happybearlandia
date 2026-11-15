/** UI observations only. Never mutates needs, invents rewards or completes trips. */
export function residentNeedQuests(people,runId){
 return people.flatMap(person=>Object.entries(person.needs??{}).filter(([need,value])=>['food','hunger','energy','social','fun'].includes(need)&&Number.isFinite(value)&&value<30).map(([need,value])=>({id:`${runId}:${person.id}:${need}`,runId,personId:String(person.id),name:person.name??String(person.id),need,value,goal:50,title:`${person.name??person.id}: low ${need}`,description:`${need} is ${Math.round(value)}/100 in the current observation. Help them use an available modeled activity; recovery to 50 completes this objective.`}))).slice(0,12);
}
export function describeResident(person,{buildings=[]}={}){
 if(!person)return null;
 const place=value=>{const row=buildings.find(b=>String(b.id)===String(value)||b.index===value);return row?.name??(value&&typeof value==='object'?value.name??value.id??'not recorded':value);};
 const needs=Object.entries(person.needs??{}).filter(([,n])=>Number.isFinite(n)).map(([key,n])=>`${key} ${Math.round(n)}/100`).join(' · ');
 return{state:`Current activity: ${person.doing??person.activity??'not recorded'}. ${needs||'Need observations unavailable.'}`,home:`Home: ${person.homeLocation?.name??person.home?.name??person.homeId??place(person.home)??person.householdId??'not recorded'}. Work: ${person.employment?.employerName??person.job?.name??person.jobId??place(person.job)??person.workId??place(person.work)??'not recorded'}. Identifiers refer to this simulation.`,scope:'These responses summarize recorded simulation state, rather than generated biography.'};
}
export function questProgress(quest,people,runId){
 if(quest.runId!==runId)return{state:'different-run',text:'This objective belongs to a previous run.'};
 const person=people.find(p=>String(p.id)===quest.personId),value=person?.needs?.[quest.need];
 if(!Number.isFinite(value))return{state:'unobserved',text:'This resident is not in the current observation. Progress is unknown.'};
 return{state:value>=quest.goal?'complete':'active',value,text:`${quest.need}: ${Math.round(value)}/100 · goal ${quest.goal}${value>=quest.goal?' · Complete':''}`};
}
