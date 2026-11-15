import {legacySocial} from './relationships/model.js';
export const LEGACY_ENCOUNTER_RULES='legacy-resident-encounters.v1';
/** Same three-minute/four-metre social gameplay assumption as Population,
 * adapted to Legacy IDs and minute clock. No identities are shared across models.
 * Keyed outcomes use the existing relationship authority, never the world RNG.
 */
export function advanceLegacyResidentEncounters(world){
 if(world.residentRules?.encounters!==LEGACY_ENCOUNTER_RULES)return 0;
 const minute=world.t,local=minute%1440;
 for(const p of world.people)if(p.socialEncounter?.untilMinute<=minute){p.doing=p.socialEncounter.previousDoing??p.doing;delete p.socialEncounter;}
 if(local<420||local>=1320||minute%5)return 0;
 const cells=new Map(),used=new Set(),social=legacySocial(world,{allowWalking:true});let pairs=0;
 const eligible=p=>!p.socialEncounter&&!(p.socialCooldown>minute)&&!p.userCommand&&!p.evacuation&&!['sleep','work','study','wait_shift'].includes(p.action)&&!(p.mode==='moving'&&p.travelMode==='transit');
 for(const p of world.people){if(pairs>=8)break;if(!eligible(p))continue;const cx=Math.floor(p.x/4),cz=Math.floor(p.z/4);let partner;
  for(let x=cx-1;x<=cx+1&&!partner;x++)for(let z=cz-1;z<=cz+1&&!partner;z++)for(const other of cells.get(x+':'+z)||[]){
   const related=p.home===other.home||p.job!=null&&p.job===other.job||Math.hypot(...world.buildings[p.home].center.map((value,i)=>value-world.buildings[other.home].center[i]))<120;
   const gathering=['play_park','eat_out'].includes(p.action)&&['play_park','eat_out'].includes(other.action);
   if(!used.has(other)&&Math.hypot(p.x-other.x,p.z-other.z)<=4&&(related||gathering)){partner=other;break;}
  }
  if(partner){let result;try{result=social.interact(p.id,partner.id,'talk',{includeSocial:false});}catch(error){if(/nearby|five game minutes/.test(error.message))continue;throw error;}
   const event={rulesVersion:LEGACY_ENCOUNTER_RULES,personIds:[String(p.id),String(partner.id)],startedMinute:minute,untilMinute:minute+3,text:result.text,outcome:result.event};
   for(const [a,b]of [[p,partner],[partner,p]]){a.socialEncounter={...event,partnerId:String(b.id),previousDoing:a.doing,heading:Math.atan2(b.x-a.x,b.z-a.z)+(a.x===b.x&&a.z===b.z?(a===p?Math.PI/2:-Math.PI/2):0)};a.doing=`chatting with ${b.name}`;a.socialCooldown=minute+15;used.add(a);}
   world.social.residentEncounters??=[];world.social.residentEncounters.push(event);world.social.residentEncounters=world.social.residentEncounters.slice(-120);world.log(result.text,'conversation');pairs++;
  }else{const key=cx+':'+cz;if(!cells.has(key))cells.set(key,[]);const list=cells.get(key);if(list.length<16)list.push(p);}
 }
 return pairs;
}
