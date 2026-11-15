import {houseActivityLabel} from '../house/model.js';
import {parentCareConstraint} from './children.js';
import {employmentScheduleAt} from './employment.js';
import {recordEvent} from './contracts.js';
import {populationSocial} from '../relationships/model.js';
/** Synthetic social rule, not observed behavior: at most eight new pairs per
 * committed outer step, within 4m, three-minute chat, fifteen-minute cooldown.
 * Awake housemates/coworkers/neighbors may chat; park/dining visitors may meet.
 * Existing household actions, care, dates and mandatory destinations take priority.
 */
export const RESIDENT_ENCOUNTER_RULES='resident-encounters.v1';
const RADIUS=4,DURATION=3,COOLDOWN=15,MAX_PAIRS=8;
function eligible(model,i,minute){const p=model.people,activity=p.remaining[i]>0?p.plannedActivity[i]:p.activity[i],local=minute%1440;
 return local>=420&&local<1320&&![1,2,7].includes(activity)&&!(p.remaining[i]>0&&p.mode[i]!==1)&&!model.manualWalks?.[i]&&!model.visits?.active?.[i]&&!model.homeStays?.active?.[i]&&!model.date?.active?.[i]&&!(p.restingUntil?.[i]>minute)&&!(p.eatingUntil?.[i]>minute)&&!(model.residentEncounters?.cooldown?.[i]>minute)&&!houseActivityLabel(model,i,minute)&&!parentCareConstraint(model,i,minute)&&!employmentScheduleAt(model,i,minute)?.mandatory;
}
export function activeResidentEncounter(model,i,minute=model.minute){const encounter=model.residentEncounters?.active?.[i];return encounter&&encounter.startedMinute<=minute&&encounter.untilMinute>minute?encounter:null;}
export function prepareResidentEncounters(model){
 const p=model.people,minute=model.minute;if(model.residentRules?.encounters!==RESIDENT_ENCOUNTER_RULES)return 0;
 model.residentEncounters??={rulesVersion:RESIDENT_ENCOUNTER_RULES,active:{},cooldown:{},events:[]};const state=model.residentEncounters;
 for(const [i,row]of Object.entries(state.active))if(row.untilMinute<=minute)delete state.active[i];
 for(const [i,until]of Object.entries(state.cooldown))if(until<=minute)delete state.cooldown[i];
 if(minute%1440<420||minute%1440>=1320)return 0;
 const cells=new Map(),used=new Set();let pairs=0;const social=populationSocial(model,{allowWalking:true});
 for(let i=0;i<p.age.length&&pairs<MAX_PAIRS;i++){
  if(!eligible(model,i,minute)||state.active[i])continue;
  const cx=Math.floor(p.x[i]/RADIUS),cz=Math.floor(p.z[i]/RADIUS);let partner=-1;
  for(let x=cx-1;x<=cx+1&&partner<0;x++)for(let z=cz-1;z<=cz+1&&partner<0;z++)for(const j of cells.get(x+':'+z)||[]){
   if(used.has(j)||Math.hypot(p.x[i]-p.x[j],p.z[i]-p.z[j])>RADIUS)continue;
   const related=p.household[i]===p.household[j]||p.home[i]===p.home[j]||p.employed[i]&&p.employed[j]&&model.employment?.employer?.[i]===model.employment?.employer?.[j];
   const publicPlace=p.remaining[i]<=0&&p.remaining[j]<=0&&[5,6].includes(p.activity[i])&&[5,6].includes(p.activity[j]);if(related||publicPlace){partner=j;break;}
  }
  if(partner>=0){const j=partner,ids=[`${model.prefix}-p${j}`,`${model.prefix}-p${i}`];let result;
   try{result=social.interact(ids[0],ids[1],'talk',{includeSocial:false});}catch(error){if(/nearby|five game minutes/.test(error.message))continue;throw error;}
   const event={rulesVersion:RESIDENT_ENCOUNTER_RULES,personIds:ids,startedMinute:minute,untilMinute:minute+DURATION,text:result.text,outcome:result.event,positions:[{x:p.x[j],z:p.z[j]},{x:p.x[i],z:p.z[i]}]};
   for(const [a,b]of [[j,i],[i,j]]){state.active[a]={...event,partnerId:`${model.prefix}-p${b}`,heading:Math.atan2(p.x[b]-p.x[a],p.z[b]-p.z[a])+(p.x[b]===p.x[a]&&p.z[b]===p.z[a]?(a===j?Math.PI/2:-Math.PI/2):0)};state.cooldown[a]=minute+COOLDOWN;used.add(a);}
   state.events.push(event);recordEvent(model,'RESIDENT_CONVERSATION',{personIds:ids,minute,text:result.text,outcome:result.event,untilMinute:event.untilMinute,rulesVersion:RESIDENT_ENCOUNTER_RULES});pairs++;
  }else{const key=cx+':'+cz;if(!cells.has(key))cells.set(key,[]);const list=cells.get(key);if(list.length<16)list.push(i);}
 }
 state.events=state.events.slice(-120);return pairs;
}
