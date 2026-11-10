// Promise plans use existing travel/schedule code. Positions are never changed here.
export const MEETING_MINUTES=10;
export function personalGoals(a,relations,state){
 const targets=relations.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))),friend=(a.adult?targets.find(r=>r.adult&&r.kind!=='Rivals'):null)??targets.find(r=>r.kind!=='Rivals')??targets[0];if(!friend)return[];
 const goals=[{id:`memory:${friend.id}`,targetId:friend.id,title:`Make a new shared memory with ${friend.name}`,help:'Talk together or keep a park meetup.',completed:friend.memories.some(m=>!['promise-made','promise-cancelled','promise-missed'].includes(m.event))},
 {id:`promise:${friend.id}`,targetId:friend.id,title:`Make time for ${friend.name}`,help:'Arrange a park meetup and help both characters keep it.',completed:(state.promises??[]).some(p=>p.status==='kept'&&[p.a,p.b].includes(String(a.id))&&[p.a,p.b].includes(String(friend.id)))}];
 const rival=targets.find(r=>r.kind==='Rivals')??targets.find(r=>state.goalAchievements?.[String(a.id)]?.[`repair:${r.id}`])??targets.find(r=>r.tension>=45);if(rival)goals.push({id:`repair:${rival.id}`,targetId:rival.id,title:`Clear the air with ${rival.name}`,help:'Clear the air during a conversation, or reconnect at the park.',completed:rival.tension<35&&rival.memories.some(m=>['reconciliation','promise-kept','tradition-gathering'].includes(m.event))});
 const crush=a.adult?targets.find(r=>r.adult&&r.kind==='Crush'&&r.label!=='Household'):null;if(crush)goals.push({id:`romance:${crush.id}`,targetId:crush.id,title:`Get to know ${crush.name} romantically`,help:'Build friendship first, then see whether they welcome flirting or a date.',completed:crush.memories.some(m=>['flirt','date'].includes(m.event))});
 if(!a.adult||!friend.adult)goals.splice(1,1);
 return goals.map(g=>({...g,completed:g.completed||Boolean(state.goalAchievements?.[String(a.id)]?.[g.id])}));
}
export function arrangePromise({state,a,b,now,place,canMeet=()=>true}){
 if(!place)throw new Error('There is no park meeting spot in this neighborhood.');
 state.promises??=[];
 if(state.promises.filter(p=>p.status==='scheduled').length>=128)throw new Error('Too many meetups are already scheduled. Let some finish first.');
 if(state.promises.some(p=>p.status==='scheduled'&&[p.a,p.b].some(id=>id===String(a.id)||id===String(b.id))))throw new Error('One of them already has a promise to keep.');
 let dueMinute=null;
 for(let day=Math.floor(now/1440);day<Math.floor(now/1440)+7;day++){const due=day*1440+1200;if(due<now+90)continue;if(canMeet(a,due-60,due+45)&&canMeet(b,due-60,due+45)){dueMinute=due;break;}}
 if(dueMinute===null)throw new Error('Their schedules do not share a free evening this week.');
 const p={id:`promise-${(state.promiseSequence??0)+1}`,a:String(a.id),b:String(b.id),aName:a.name,bName:b.name,place:structuredClone(place),createdMinute:now,dueMinute,startMinute:dueMinute-60,endMinute:dueMinute+45,status:'scheduled',togetherSince:null};
 if(state.promises.some(q=>[q.a,q.b].includes(p.a)&&[q.a,q.b].includes(p.b)&&Math.floor(q.dueMinute/1440)===Math.floor(dueMinute/1440)))throw new Error('They have already made a promise to each other for that day.');
 state.promiseSequence=(state.promiseSequence??0)+1;state.promiseByPerson??={};state.promiseByPerson[p.a]=p.id;state.promiseByPerson[p.b]=p.id;state.promises.push(p);if(state.promises.length>512){const i=state.promises.findIndex(p=>p.status!=='scheduled');if(i>=0)state.promises.splice(i,1);}
 state.promiseRevision=(state.promiseRevision??0)+1;return p;
}
export function activePromise(state,id,minute){const promiseId=state?.promiseByPerson?.[String(id)];if(!promiseId)return null;const p=state.promises?.find(p=>p.id===promiseId);return p?.status==='scheduled'&&minute>=p.startMinute&&minute<p.endMinute?p:null;}
function clearActive(state,p){if(state.promiseByPerson?.[p.a]===p.id)delete state.promiseByPerson[p.a];if(state.promiseByPerson?.[p.b]===p.id)delete state.promiseByPerson[p.b];}

export function advancePromises({state,minute,getPerson,onOutcome}){
 for(const p of state?.promises??[]){if(p.status!=='scheduled'||minute<p.startMinute)continue;const a=getPerson(p.a),b=getPerson(p.b),there=x=>x&&x.available!==false&&Math.hypot(x.x-p.place.x,x.z-p.place.z)<=12;
  if(minute<=p.endMinute&&there(a)&&there(b)){p.togetherSince??=Math.max(minute,p.dueMinute);if(minute-p.togetherSince>=MEETING_MINUTES){p.status='kept';clearActive(state,p);p.resolvedMinute=minute;state.promiseRevision=(state.promiseRevision??0)+1;onOutcome(p,'kept');continue;}}else p.togetherSince=null;
  if(minute>=p.endMinute){p.status='missed';clearActive(state,p);p.resolvedMinute=minute;state.promiseRevision=(state.promiseRevision??0)+1;onOutcome(p,'missed');}
 }
}
export function cancelPromise(state,id,target,minute){const p=state.promises?.find(p=>p.status==='scheduled'&&[p.a,p.b].includes(String(id))&&[p.a,p.b].includes(String(target)));if(!p)throw new Error('There is no upcoming promise between these characters.');p.status='cancelled';clearActive(state,p);p.resolvedMinute=minute;state.promiseRevision=(state.promiseRevision??0)+1;return p;}
export function populationPromisePlan(model,i,minute){
 const p=activePromise(model.social,`${model.prefix}-p${i}`,minute);if(!p)return null;
 if((model.weatherEffects?.parkComfort??1)<=.1||(model.weatherEffects?.serviceAvailability??1)<=0)return null;
 return{activity:6,until:p.endMinute,mandatory:false,destination:{district:p.place.district,x:p.place.x,z:p.place.z,location:p.place.location},reason:'Keeping a promised park meetup'};
}
export function driveLegacyPromiseRoutines(world){
 for(const p of world.social?.promises??[]){if(p.status!=='scheduled'||world.t<p.startMinute||world.t>=p.endMinute)continue;p.dispatched??=[];
  for(const id of[p.a,p.b]){const person=world.people.find(row=>String(row.id)===id);if(!person)continue;
   if(person.mode==='doing'&&person.action==='play_park'&&person.target===p.place.building){person.until=Math.max(person.until,p.endMinute);continue;}
   if(p.dispatched.includes(id)||person.userCommand||person.needs?.energy<8||person.needs?.hunger<8)continue;
   const building=world.buildings[p.place.building];if(!building)continue;
   try{world.commandPerson(id,{type:'activity',actionId:'play_park',buildingId:building.id});person.userCommand.promiseId=p.id;p.dispatched.push(id);}catch{/* Unavailable routes/services cause a missed promise, never a teleport. */}
  }
 }
}
