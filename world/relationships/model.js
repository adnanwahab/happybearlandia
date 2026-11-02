import {recordJournalMoment} from '../journals/model.js';
// Sparse, deterministic social graph. Seeded ties are fictional backstory;
// memories are created only by actual player-directed encounters.
export const SOCIAL_RADIUS = 40;
export const SOCIAL_ACTIONS = {talk:'Talk',gossip:'Share gossip',flirt:'Flirt',date:'Ask on a date',apologize:'Clear the air',callback:'Remember together'};
const clamp=n=>Math.max(0,Math.min(100,n));
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const key=(a,b)=>JSON.stringify([String(a),String(b)].sort());
export function createSocialWorld({count,getPerson,seed=0,state={},minute=()=>0,onSocial=()=>{}}){
 state.ties??={};
 function person(id){const p=getPerson(id);if(!p)throw new Error('Unknown character');return p;}
 function initial(a,b){const family=a.householdId!=null&&a.householdId===b.householdId;const h=hash(`${seed}:${key(a.id,b.id)}`);let kind=family?'Household':a.work!=null&&a.work===b.work&&a.adult&&b.adult?'Awkward coworkers':['Best friends','Rivals','Crush','Know each other extremely well','Acquaintances'][h%5];if(kind==='Crush'&&(!a.adult||!b.adult))kind='Acquaintances';return{a:String(a.id),b:String(b.id),kind,familiarity:family?90:kind==='Know each other extremely well'?98:kind==='Best friends'?85:25,friendship:family?65:kind==='Best friends'?88:kind==='Rivals'?10:35,romance:kind==='Crush'&&a.adult&&b.adult&&!family?35:0,tension:kind==='Rivals'?75:kind==='Awkward coworkers'?40:0,memories:[],lastMinute:null};}
 function tie(a,b){return state.ties[key(a.id,b.id)]||initial(a,b);}
 function label(t,a,b){if(a.householdId!=null&&a.householdId===b.householdId)return 'Household';if(t.dating)return 'Dating';if(t.tension>=60)return 'Rivals';if(t.romance>=25&&a.adult&&b.adult)return 'Crush';if(t.friendship>=80)return 'Best friends';if(t.familiarity>=90)return 'Know each other extremely well';return t.kind==='Awkward coworkers'&&t.tension>20?t.kind:t.friendship>=55?'Friends':t.kind==='Household'?'Acquaintances':t.kind;}
 function inspect(id){const a=person(id),known=new Map(),nearby=[];
  // A small seeded circle per character plus all household members; no dense NxN graph.
  for(let i=0;i<count;i++){const b=getPerson(i);if(!b||String(a.id)===String(b.id))continue;const d=Math.hypot(a.x-b.x,a.z-b.z);if(d<=SOCIAL_RADIUS&&a.available!==false&&b.available!==false)nearby.push({...b,distance:Math.round(d)});if((a.householdId!=null&&a.householdId===b.householdId)||Math.abs(a.index-b.index)===1||Math.abs(a.index-b.index)===3)known.set(String(b.id),b);}
  for(const t of Object.values(state.ties)){if(t.a===String(a.id)||t.b===String(a.id)){const b=person(t.a===String(a.id)?t.b:t.a);known.set(String(b.id),b);}}
  return{personId:a.id,adult:a.adult,relationships:[...known.values()].map(b=>{const t=tie(a,b);return{...structuredClone(t),id:b.id,name:b.name,label:label(t,a,b),adult:b.adult};}),nearby:nearby.sort((a,b)=>a.distance-b.distance),radius:SOCIAL_RADIUS};
 }
 function interact(id,targetId,action='talk'){
  if(!Object.hasOwn(SOCIAL_ACTIONS,action))throw new Error('Unknown social action');const a=person(id),b=person(targetId);if(String(a.id)===String(b.id))throw new Error('Choose another character');
  if(a.available===false||b.available===false||Math.hypot(a.x-b.x,a.z-b.z)>SOCIAL_RADIUS)throw new Error('They are no longer nearby and available. Try someone else.');
  const t=structuredClone(tie(a,b)),now=minute();if(t.lastMinute!==null&&now-t.lastMinute<5)throw new Error('Give them five game minutes before another encounter.');
  const family=a.householdId!=null&&a.householdId===b.householdId;
  if(['flirt','date'].includes(action)&&(!a.adult||!b.adult||family))throw new Error('Romance is available between adults outside the same household.');
  if(action==='callback'&&!t.memories.length)throw new Error('They need a shared memory first.');
  const roll=hash(`${seed}:${key(a.id,b.id)}:${t.memories.length}:${now}:${action}`)%100;
  let event='conversation',text=`${a.name} and ${b.name} caught up.`,friendship=7,tension=-3;
  if(action==='talk'&&roll<18){event='misunderstanding';text=`${b.name} misunderstood ${a.name}’s joke. They can clear the air later.`;friendship=-4;tension=12;}
  if(action==='talk'&&roll>=18&&roll<32){event='embarrassment';text=`${a.name} waved at someone behind ${b.name}. Both noticed the awkward moment.`;friendship=2;tension=4;}
  if(action==='gossip'){event='gossip';const subject=inspect(a.id).relationships.find(r=>String(r.id)!==String(b.id));text=subject?`${a.name} shared an unverified rumor about ${subject.name}. ${b.name} will remember hearing it.`:`${a.name} shared an unverified neighborhood rumor with ${b.name}.`;friendship=3;tension=6;}
  if(action==='apologize'){event='reconciliation';text=`${a.name} and ${b.name} cleared up a misunderstanding.`;tension=-22;friendship=8;}
  if(action==='callback'){event='callback';text=`${a.name} brought up: “${t.memories.at(-1).text}” ${b.name} remembered too.`;friendship=10;tension=-7;}
  if(action==='flirt'||action==='date'){const accepted=t.friendship>= (action==='date'?55:30)&&t.tension<45&&roll<80;event=accepted?(action==='date'?'date':'flirt'):'embarrassment';if(accepted){t.romance=clamp(t.romance+18);if(action==='date')t.dating=true;text=action==='date'?`${b.name} accepted ${a.name}’s invitation. They are dating.`:`${b.name} smiled and flirted back.`;}else{text=`${b.name} gently declined. ${a.name} felt awkward, and respected the answer.`;tension=8;friendship=0;}}
  t.friendship=clamp(t.friendship+friendship);t.tension=clamp(t.tension+tension);t.familiarity=clamp(t.familiarity+5);t.lastMinute=now;
  // Store short concrete memories; callbacks reference an event, never recursively quote callbacks.
  const memory={minute:now,event,text:event==='callback'?`${a.name} and ${b.name} laughed about an earlier encounter.`:text};t.memories.push(memory);t.memories=t.memories.slice(-12);state.ties[key(a.id,b.id)]=t;onSocial(a,b,event,text);return{text,event,social:inspect(a.id)};
 }
 return{inspect,interact,state};
}
export function populationSocial(model){const p=model.people;return createSocialWorld({count:p.age.length,seed:model.config.seed,state:model.social??={},minute:()=>model.minute,getPerson:id=>{const i=typeof id==='number'?id:Number(String(id).replace(`${model.prefix}-p`,''));if(!Number.isInteger(i)||i<0||i>=p.age.length)return null;return{id:`${model.prefix}-p${i}`,index:i,name:`Resident ${i+1}`,adult:p.age[i]!==0,householdId:p.household[i],work:p.employed[i]?p.work[i]:null,x:p.x[i],z:p.z[i],available:p.remaining[i]<=0};},onSocial:(a,b,event,text)=>{for(const row of[a,b]){p.social[row.index]=clamp(p.social[row.index]+8);recordJournalMoment(model.journals,row.id,row.name,model.minute,`I spent time with ${row.id===a.id?b.name:a.name}. ${text}`);}}});}
export function legacySocial(world){const ids=new Map(world.people.map((p,i)=>[String(p.id??i),i]));return createSocialWorld({count:world.people.length,seed:world.seedKey??0,state:world.social??={},minute:()=>world.t,getPerson:id=>{const index=typeof id==='number'?id:ids.get(String(id))??-1;const p=world.people[index];return p?{id:String(p.id??index),index,name:p.name,adult:p.age>=18,householdId:p.householdId??p.home,work:p.job,x:p.x,z:p.z,available:p.mode!=='moving'}:null;},onSocial:(a,b,event,text)=>{for(const row of[a,b]){recordJournalMoment(world.journals,row.id,row.name,world.t,`I spent time with ${row.id===a.id?b.name:a.name}. ${text}`);const p=world.people[row.index];if(p.needs)p.needs.social=clamp(p.needs.social+8);}}});}
