// City gatherings share the simulation clock and travel system. Attendance is
// evidence from co-presence, never inferred from an invitation or elapsed dates.
export const CITY_TRADITION_TYPES=Object.freeze({picnic:{title:'Friday park picnic',minute:1200,intervalDays:7,weekday:4,activity:6},lunch:{title:'Coworker lunch club',minute:720,intervalDays:1,weekdays:true,activity:5},potluck:{title:'Monthly park potluck',minute:1200,intervalDays:30,activity:6}});
const DAY=1440,copy=v=>structuredClone(v),id=p=>String(p.id);
export function nextTraditionMinute(kind,after,weekdayOffset=0){const c=CITY_TRADITION_TYPES[kind];let day=Math.floor(after/DAY),due=day*DAY+c.minute;if(due<=after)day++;for(let n=0;n<8;n++,day++){if(c.weekday!==undefined&&(day+weekdayOffset)%7!==c.weekday||c.weekdays&&(day+weekdayOffset)%7>=5)continue;return day*DAY+c.minute;}throw Error('No recurrence date available');}
function bump(s){s.traditionRevision=(s.traditionRevision??0)+1;}
function indexMember(s,t,personId){s.traditionByPerson??={};const ids=s.traditionByPerson[personId]??=[];if(!ids.includes(t.id))ids.push(t.id);}
function unindexMember(s,t,personId){if(s.traditionByPerson?.[personId])s.traditionByPerson[personId]=s.traditionByPerson[personId].filter(id=>id!==t.id);}
export function startCityTradition({state,a,b,kind,now,place,weekdayOffset=0}){
 if(!Object.hasOwn(CITY_TRADITION_TYPES,kind))throw Error('Choose a listed neighborhood tradition');
 if(!a.adult||!b.adult)throw Error('City gathering organizers must be adults. Family traditions are available at home.');
 if(!place)throw Error(kind==='lunch'?'No dining venue is available for a lunch club.':'No park is available for this gathering.');
 if(kind==='lunch'&&(a.coworkerKey==null||typeof a.coworkerKey==='number'&&a.coworkerKey<0||a.coworkerKey!==b.coworkerKey))throw Error('Start a lunch club with someone from the same workplace.');
 const rows=state.cityTraditions??[];if(rows.length>=32)throw Error('The neighborhood already has plenty of traditions. Join an existing gathering instead.');
 if(rows.some(t=>t.hostId===id(a)&&t.kind===kind))throw Error('This person already hosts that tradition. Join or resume the existing one.');
 for(const p of[a,b])if((state.traditionByPerson?.[id(p)]??[]).length>=2)throw Error('One of them already has two neighborhood traditions.');
 const c=CITY_TRADITION_TYPES[kind],t={id:`city-tradition-${(state.traditionSequence??0)+1}`,kind,title:c.title,hostId:id(a),hostName:a.name,memberIds:[id(a),id(b)],memberNames:{[id(a)]:a.name,[id(b)]:b.name},place:copy(place),enabled:true,createdMinute:now,weekdayOffset,nextMinute:nextTraditionMinute(kind,now+60,weekdayOffset),occurrenceCount:0,completedCount:0,attendance:{},pairCounts:{},history:[],current:null};
 state.cityTraditions??=[];state.traditionSequence=(state.traditionSequence??0)+1;state.cityTraditions.push(t);for(const p of[a,b])indexMember(state,t,id(p));bump(state);return t;
}
export function changeCityTradition({state,person,hostId,operation,kind,now}){
 const t=state.cityTraditions?.find(t=>t.hostId===String(hostId)&&t.kind===kind);if(!t)throw Error('That tradition is no longer available');const who=id(person);
 if(operation==='join'){
  if(!person.adult)throw Error('City gatherings are for adults; children keep their school and family routines.');
  if(!t.enabled)throw Error('This gathering is paused');if(t.memberIds.includes(who))throw Error('Already a member of this tradition');if(t.memberIds.length>=8||(state.traditionByPerson?.[who]??[]).length>=2)throw Error('There is no room for another regular gathering');
  t.memberIds.push(who);t.memberNames[who]=person.name;indexMember(state,t,who);if(t.current&&!t.current.invitedIds.includes(who))t.current.invitedIds.push(who);
 }else if(operation==='leave'){
  if(who===t.hostId)throw Error('Hosts can pause their gathering instead');if(!t.memberIds.includes(who))throw Error('Not a member of this tradition');t.memberIds=t.memberIds.filter(id=>id!==who);unindexMember(state,t,who);if(t.current)t.current.invitedIds=t.current.invitedIds.filter(id=>id!==who);
 }else if(operation==='pause'||operation==='resume'){
  if(who!==t.hostId)throw Error('Only the host can change this schedule');
  if(operation==='pause'){t.enabled=false;for(const id of t.memberIds)unindexMember(state,t,id);if(t.current){for(const id of t.current.invitedIds)if(state.traditionGuestByPerson?.[id]===t.id)delete state.traditionGuestByPerson[id];t.history.push({minute:now,status:'cancelled',attendeeIds:[...t.current.attendeeIds],text:`${t.title} was paused by the host.`});t.history=t.history.slice(-24);t.current=null;}}
  else{if(t.enabled)throw Error('Already scheduled');for(const id of t.memberIds)if((state.traditionByPerson?.[id]??[]).length>=2)throw Error('A member already has two other traditions');t.enabled=true;t.nextMinute=nextTraditionMinute(t.kind,now+60,t.weekdayOffset);for(const id of t.memberIds)indexMember(state,t,id);}
 }else throw Error('Unknown tradition change');bump(state);return t;
}
export function inspectCityTraditions(state,person){return(state.cityTraditions??[]).map(t=>({id:t.id,kind:t.kind,title:t.title,hostId:t.hostId,hostName:t.hostName,memberIds:[...t.memberIds],members:t.memberIds.map(id=>t.memberNames[id]??id),place:copy(t.place),enabled:t.enabled,nextMinute:t.current?.scheduledMinute??t.nextMinute,current:Boolean(t.current),joined:t.memberIds.includes(id(person)),host:t.hostId===id(person),attended:t.attendance[id(person)]??0,completedCount:t.completedCount,ritual:t.completedCount>=3,history:copy(t.history.slice(-3))})).sort((a,b)=>Number(b.joined)-Number(a.joined)).slice(0,16);}
export function prepareCityTraditions({state,minute,getGuests=()=>[]}){
 for(const t of state.cityTraditions??[]){if(!t.enabled||t.current||minute<t.nextMinute-60)continue;
  const due=t.nextMinute,c=CITY_TRADITION_TYPES[t.kind];t.nextMinute=t.kind==='potluck'?due+c.intervalDays*DAY:nextTraditionMinute(t.kind,due,t.weekdayOffset);
  if(minute>due+60){t.history.push({minute,status:'missed',attendeeIds:[],text:`${t.title} passed without a recorded gathering.`});t.history=t.history.slice(-24);if(t.nextMinute<=minute)t.nextMinute=t.kind==='potluck'?due+(Math.floor((minute-due)/(30*DAY))+1)*30*DAY:nextTraditionMinute(t.kind,minute+60,t.weekdayOffset);bump(state);continue;}
  const guest=getGuests(t).find(p=>p.adult&&!t.memberIds.includes(id(p)));const invitedIds=[...t.memberIds];if(guest&&invitedIds.length<8){invitedIds.push(id(guest));state.traditionGuestByPerson??={};state.traditionGuestByPerson[id(guest)]=t.id;}
  t.occurrenceCount++;t.current={id:`${t.id}:${due}`,scheduledMinute:due,startMinute:due-60,endMinute:due+60,invitedIds,attendeeIds:[],pairs:{},dispatched:[]};bump(state);
 }
}
export function advanceCityTraditions({state,minute,getPerson,onPair=()=>{},onFinish=()=>{}}){
 for(const t of state.cityTraditions??[]){const e=t.current;if(!e)continue;
  if(minute>=e.scheduledMinute&&minute<=e.endMinute){const there=e.invitedIds.map(getPerson).filter(p=>p&&(e.observedIntervals?e.observedIntervals[id(p)]?.length:p.available!==false&&(p.activity===undefined||p.activity===CITY_TRADITION_TYPES[t.kind].activity)&&Math.hypot(p.x-t.place.x,p.z-t.place.z)<=12));
   const together=new Set();for(let i=0;i<there.length;i++)for(let j=i+1;j<there.length;j++){const a=there[i],b=there[j],key=JSON.stringify([id(a),id(b)].sort());together.add(key);const pair=e.pairs[key]??={since:minute,done:false};const shared=e.observedIntervals?sharedMinutes(e.observedIntervals[id(a)],e.observedIntervals[id(b)]):minute-pair.since;if(pair.done||shared<10)continue;pair.done=true;
    const repeat=(t.pairCounts[key]??0)>0;for(const p of[a,b])if(!e.attendeeIds.includes(id(p))){e.attendeeIds.push(id(p));t.attendance[id(p)]=(t.attendance[id(p)]??0)+1;}t.pairCounts[key]=(t.pairCounts[key]??0)+1;onPair(t,a,b,{repeat,newcomer:!t.memberIds.includes(id(a))||!t.memberIds.includes(id(b))});bump(state);
   }
   for(const [key,pair]of Object.entries(e.pairs))if(!pair.done&&!together.has(key))delete e.pairs[key];
  }
  if(minute>=e.endMinute){const attended=e.attendeeIds.length>=2;if(attended)t.completedCount++;const text=attended?`${e.attendeeIds.map(id=>getPerson(id)?.name??id).join(', ')} shared ${t.title.toLowerCase()}.`:`${t.title} could not get a group together this time. Nobody lost trust for being busy.`;
   t.history.push({minute,scheduledMinute:e.scheduledMinute,status:attended?'gathered':'missed',attendeeIds:[...e.attendeeIds],text});t.history=t.history.slice(-24);
   for(const id of e.attendeeIds)if(!t.memberIds.includes(id)&&t.attendance[id]>=2&&t.memberIds.length<8&&(state.traditionByPerson?.[id]??[]).length<2){t.memberIds.push(id);t.memberNames[id]=getPerson(id)?.name??id;indexMember(state,t,id);}
   for(const id of e.invitedIds)if(state.traditionGuestByPerson?.[id]===t.id)delete state.traditionGuestByPerson[id];onFinish(t,e,text);t.current=null;bump(state);
  }
 }
}
export function activeCityTradition(state,personId,minute){for(const traditionId of state?.traditionByPerson?.[String(personId)]??[]){const t=state.cityTraditions?.find(t=>t.id===traditionId),e=t?.current;if(t?.enabled&&e&&e.invitedIds.includes(String(personId))&&minute>=e.startMinute&&minute<e.endMinute)return t;}
 // Guests are rare and bounded; index their current invitation separately.
 const id=state?.traditionGuestByPerson?.[String(personId)];if(id){const t=state.cityTraditions?.find(t=>t.id===id);if(t?.enabled&&t.current?.invitedIds.includes(String(personId))&&minute>=t.current.startMinute&&minute<t.current.endMinute)return t;}return null;}
export function populationTraditionPlan(model,i,minute,{mealBreak=false}={}){const t=activeCityTradition(model.social,`${model.prefix}-p${i}`,minute);if(!t||mealBreak&&t.kind!=='lunch')return null;if(model.people.energy[i]<15)return null;if(t.kind==='lunch'&&model.households.income[model.people.household[i]]/365*.2<2)return null;const activity=CITY_TRADITION_TYPES[t.kind].activity;if((model.weatherEffects?.serviceAvailability??1)<=0||activity===6&&(model.weatherEffects?.parkComfort??1)<=.1)return null;return{activity,until:t.current.endMinute,mandatory:false,destination:{district:t.place.district,x:t.place.x,z:t.place.z,location:t.place.location},reason:`Attending ${t.title}`};}
export function driveLegacyTraditionRoutines(world){
 for(const t of world.social?.cityTraditions??[]){const e=t.current;if(!t.enabled||!e||world.t<e.startMinute||world.t>=e.endMinute)continue;
  for(const id of e.invitedIds){const p=world.people.find(p=>String(p.id)===id);if(!p)continue;const action=t.kind==='lunch'?'eat_out':'play_park';if(p.mode==='doing'&&p.action===action&&p.target===t.place.building&&p.userCommand?.traditionId===t.id){p.until=Math.max(p.until,e.endMinute);continue;}
   if(e.dispatched.includes(id)||p.userCommand||p.needs?.energy<12||p.needs?.hunger<8)continue;const m=world.t%DAY;if(p.job!=null&&m>=p.shiftStart&&m<p.shiftStart+p.shiftLen&&!(t.kind==='lunch'&&m>=720&&m<780))continue;
   const b=world.buildings[t.place.building];if(!b)continue;try{world.commandPerson(id,{type:'activity',actionId:action,buildingId:b.id});p.userCommand.traditionId=t.id;e.dispatched.push(id);}catch{/* Existing stock, affordability, weather and route constraints remain authoritative. */}
  }
 }
}

function sharedMinutes(a=[],b=[]){let i=0,j=0,total=0;while(i<a.length&&j<b.length){total+=Math.max(0,Math.min(a[i][1],b[j][1])-Math.max(a[i][0],b[j][0]));if(a[i][1]<b[j][1])i++;else j++;}return total;}
export function recordCityTraditionInterval(model,i,activity,start,duration){
 if(!model.social?.cityTraditions?.length||![5,6].includes(activity))return;const personId=`${model.prefix}-p${i}`,t=activeCityTradition(model.social,personId,start),e=t?.current;if(!e||!e.observedIntervals||activity!==CITY_TRADITION_TYPES[t.kind].activity||Math.hypot(model.people.x[i]-t.place.x,model.people.z[i]-t.place.z)>12)return;
 const from=Math.max(start,e.scheduledMinute),to=Math.min(start+duration,e.endMinute);if(to<=from)return;const intervals=e.observedIntervals[personId]??=[],last=intervals.at(-1);if(last&&Math.abs(last[1]-from)<1e-8)last[1]=to;else intervals.push([from,to]);if(intervals.length>32)intervals.shift();
}
