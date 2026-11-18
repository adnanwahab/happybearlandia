/** Life Story v1: a deterministic, readable account of one resident's recorded day.
 *
 * Inputs are recorded evidence only: activity-history routine intervals and
 * events, the decision trace, the current snapshot row and (when the social model
 * has already been created) relationship memories, goals and promises.
 *
 * Two layers stay separate in every beat:
 * - `facts`: values copied from those records, or derived by a stated formula
 *   (`source: 'derived'`). Nothing else.
 * - `narration`: cosmetic sentences produced from the facts by versioned
 *   templates. Narration adds no model state and is never read by a model.
 *
 * The builder is a pure function: identical input gives identical output, and the
 * facts digest ignores narration so template edits cannot change it. */
import {activityDisplayLabel,formatActivityTime} from '../activity-analysis.js';

export const LIFE_STORY_VERSION='life-story.v1';
export const LIFE_STORY_NARRATION_VERSION='life-story-narration.v1';
export const LIFE_STORY_NARRATION_NOTICE='Narration is generated from the recorded facts listed with each moment. It adds no model state and is never fed back into the simulation.';

export const NEED_LABELS=Object.freeze({hunger:'Food',energy:'Energy',fun:'Fun',social:'Social'});
const TRAVEL=new Set(['WALK','TRANSIT','TRANSIT_WAIT','TRAVEL']);
const IDLE=new Set(['IDLE']);
/** Same activity at the same kind of place, separated only by idle or sub-2-minute
 * travel bouts (a resident re-choosing what they were already doing), is one moment. */
const MERGE_GAP_MINUTES=3;
const MIN_TRAVEL_BEAT_MINUTES=2;
/** A need change smaller than this is not narrated (facts still list both values). */
const NARRATED_NEED_CHANGE=10;
/** Routine-shaping events are folded into the moments they explain. */
const FOLDED_EVENTS=new Set(['ACTIVITY_SELECTED','ACTIVITY_STARTED','ACTIVITY_ENDED','TRIP_STARTED','TRIP_COMPLETED']);
const DISTRICT_PLACES=Object.freeze({home:'home',work:'work',food:'a place to eat',shop:'a shop',school:'school',park:'the park',business:'your business'});
const SOURCE={interval:'recorded routine interval',event:'recorded event',decision:'decision trace',snapshot:'current model state',social:'social model record',derived:'derived'};
/** world/sim.js score() adds schedule bonuses for these; the text names the window. */
const OBLIGATIONS=Object.freeze({work:'shift time',study:'school time'});
/** Natural decay over a long stretch is worth telling; a gain is told only when the
 * activity's own rate restores that need. */
const NARRATED_DECAY_MINUTES=60;

const round=(value,digits=1)=>Number.isFinite(value)?Math.round(value*10**digits)/10**digits:null;
const minutesLabel=minutes=>minutes>=90?`${Math.floor(minutes/60)} h${minutes%60?` ${Math.round(minutes%60)} min`:''}`:`${Math.round(minutes)} min`;
export const clockLabel=minute=>formatActivityTime(minute);
const shortClock=minute=>{const time=formatActivityTime(minute);return time.includes(' ')?time.slice(time.lastIndexOf(' ')+1):time;};
const money=value=>Number.isFinite(value)?`$${value.toFixed(value%1?2:0)}`:null;
const fact=(label,value,source,extra={})=>({label,value,source,...extra});
const list=value=>Array.isArray(value)?value:[];

/** FNV-1a over a canonical string. A reproducibility fingerprint, not a security hash. */
export function digestFacts(value){
 const text=canonical(value);let hash=0x811c9dc5;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
 return `fnv1a32:${hash.toString(16).padStart(8,'0')}`;
}
function canonical(value){
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
 return JSON.stringify(value===undefined?null:value);
}

function personName(source){return String(source.person?.name??`Resident ${source.person?.id??''}`).trim();}

/** Legacy residents only do home activities in their own home, so a home place is
 * told as "home"; its building name stays in the facts. */
function placeOf(source,{buildingId,districtId}){
 const place=buildingId!=null?source.places?.[String(buildingId)]:null;
 if(districtId==='home'||place?.kind==='home')return{phrase:'at home',name:'home',buildingName:place?.name??null,id:buildingId!=null?String(buildingId):null,home:true};
 if(place?.name)return{phrase:`at ${place.name}`,name:place.name,buildingName:place.name,id:String(buildingId),home:false};
 const generic=DISTRICT_PLACES[districtId];
 return generic?{phrase:`at ${generic}`,name:generic,buildingName:null,id:null,home:false}:{phrase:'',name:null,buildingName:null,id:null,home:false};
}

/** Activity templates. Each receives already-verified values; none invents a value. */
const ACTIVITY_TEMPLATES={
 SLEEP:v=>`${v.name} slept ${v.at}.`,
 EAT_HOME:v=>`${v.name} cooked and ate ${v.at}.`,
 EAT_OUT:v=>`${v.name} ate out ${v.at}${v.cost}.`,
 DINING:v=>`${v.name} ate out ${v.at}${v.cost}.`,
 RELAX_HOME:v=>`${v.name} unwound ${v.at} in front of the TV.`,
 HOME:v=>`${v.name} spent time ${v.at}.`,
 PLAY_PARK:v=>`${v.name} spent time outdoors ${v.at}.`,
 RECREATION:v=>`${v.name} took some time for fun ${v.at}.`,
 SOCIAL_CHAT:v=>`${v.name} stopped to chat ${v.at}.`,
 WORK:v=>`${v.name} worked a shift ${v.at}.`,
 WAIT_SHIFT:v=>`${v.name} arrived early and waited for a shift to start ${v.at}.`,
 GROCERIES:v=>`${v.name} bought groceries ${v.at}${v.cost}.`,
 SHOPPING:v=>`${v.name} went shopping ${v.at}${v.cost}.`,
 CLEAN_PARK:v=>`${v.name} helped clean up ${v.at}.`,
 STUDY:v=>`${v.name} studied ${v.at}.`,
 SCHOOL:v=>`${v.name} was at school ${v.at}.`,
 ERRAND:v=>`${v.name} ran an errand ${v.at}.`,
 HEALTHCARE:v=>`${v.name} had a healthcare visit ${v.at}.`,
 VISIT_BUSINESS:v=>`${v.name} visited your business ${v.at}${v.cost}.`,
};
const NEED_WORDS={hunger:['got hungrier','ate their fill'],energy:['grew tired','felt rested'],fun:['got bored','had fun'],social:['felt lonelier','felt more connected']};

function activitySentence(code,values){
 const template=ACTIVITY_TEMPLATES[code];
 const text=template?template(values):`${values.name}: ${activityDisplayLabel(code).toLowerCase()} ${values.at}.`;
 return text.replace(/\s+\./g,'.').replace(/\s{2,}/g,' ');
}

function needTrend(before,after){
 if(!before||!after)return[];
 return Object.keys(NEED_LABELS).filter(key=>Number.isFinite(before[key])&&Number.isFinite(after[key])).map(key=>({key,label:NEED_LABELS[key],from:round(before[key]),to:round(after[key]),change:round(after[key]-before[key])}));
}

/** Decision trace entries are exact model records: needs at decision time, the
 * chosen activity and the scored alternatives. */
function matchDecision(source,{activity,startMinute,earliestMinute}){
 const wanted=String(activity).toLowerCase();
 const trace=list(source.person?.decisionTrace);
 for(let i=trace.length-1;i>=0;i--){
  const d=trace[i];
  if(String(d?.chosen).toLowerCase()===wanted&&Number.isFinite(d.minute)&&d.minute<=startMinute+1&&d.minute>=earliestMinute-2)return d;
 }
 return null;
}

function describeWhy(source,decision){
 if(!decision)return null;
 const alternatives=list(decision.alternatives);
 const chosen=alternatives.find(a=>a.activity===decision.chosen&&a.score===decision.score)??alternatives.find(a=>a.activity===decision.chosen)??null;
 const seen=new Set([decision.chosen]),others=[];
 for(const option of alternatives){if(seen.has(option.activity))continue;seen.add(option.activity);others.push(option);if(others.length===2)break;}
 const optionPlace=option=>placeOf(source,{buildingId:option.buildingId,districtId:source.places?.[String(option.buildingId)]?.kind}).name;
 const needs=decision.needs&&typeof decision.needs==='object'?decision.needs:{};
 const lowest=Object.keys(NEED_LABELS).filter(key=>Number.isFinite(needs[key])).sort((a,b)=>needs[a]-needs[b])[0];
 // The need with the most room this activity can restore: rate × (100 − need),
 // using the model's own rate table. Scheduled obligations are named as such.
 const rates=source.actionCatalog?.[decision.chosen]?.rate??null;
 const room=key=>rates[key]*(100-needs[key]);
 const served=rates&&!OBLIGATIONS[decision.chosen]?Object.keys(NEED_LABELS).filter(key=>Number.isFinite(rates[key])&&rates[key]>0&&Number.isFinite(needs[key])&&needs[key]<99).sort((a,b)=>room(b)-room(a))[0]??null:null;
 const topScore=Math.max(...alternatives.map(a=>a.score).filter(Number.isFinite),Number.isFinite(decision.score)?decision.score:0);
 const facts=[
  fact('Decided at',clockLabel(decision.minute),SOURCE.decision,{field:'minute',raw:decision.minute}),
  fact('Chosen activity',activityDisplayLabel(decision.chosen),SOURCE.decision,{field:'chosen',raw:decision.chosen}),
  fact('Chosen score',round(decision.score,1),SOURCE.decision,{field:'score',raw:decision.score}),
  ...others.map((option,index)=>fact(`Runner-up ${index+1}`,`${activityDisplayLabel(option.activity)} · ${round(option.score,1)}${optionPlace(option)?` · ${optionPlace(option)}`:''}`,SOURCE.decision,{field:'alternatives',raw:option.score})),
  ...Object.keys(NEED_LABELS).filter(key=>Number.isFinite(needs[key])).map(key=>fact(`${NEED_LABELS[key]} when deciding`,round(needs[key]),SOURCE.decision,{field:`needs.${key}`,unit:'/100'})),
  fact('Reason codes',list(decision.reasonCodes).join(', ')||'none recorded',SOURCE.decision,{field:'reasonCodes'}),
  ...(served?[fact('Need with the most room this activity restores',NEED_LABELS[served],SOURCE.derived,{formula:'max over needs of rate × (100 − need); rate from world/sim.js ACTIONS',raw:rates[served],unit:'points/min'})]:[]),
 ];
 const runnerUp=others[0];
 const score=value=>Number.isFinite(value)?String(round(value,1)):'?';
 const narration=[
  topScore<1?'Nothing was pressing: every option scored below 1.'
   :OBLIGATIONS[decision.chosen]?`${activityDisplayLabel(decision.chosen)} is a scheduled obligation in this model, which raises its score around ${OBLIGATIONS[decision.chosen]}.`
   :served?`${activityDisplayLabel(decision.chosen)} restores ${NEED_LABELS[served].toLowerCase()}, which was ${Math.round(needs[served])}/100 when they decided.`
   :lowest?`${NEED_LABELS[lowest]} was their lowest need (${Math.round(needs[lowest])}/100) when they decided.`:null,
  `It scored ${score(decision.score)}${runnerUp?`, ahead of ${activityDisplayLabel(runnerUp.activity).toLowerCase()} (${score(runnerUp.score)})`:', the only option scored'}.`,
 ].filter(Boolean).join(' ');
 return{
  rule:'The resident model scores feasible nearby activities by need urgency, schedule obligations, travel time and personality, with seeded variation, then takes the highest score.',
  chosen:decision.chosen,score:round(decision.score,1),buildingId:chosen?.buildingId??null,
  facts,narration,
 };
}

/** Collapse routine intervals into moments: activity bouts and meaningful trips. */
function routineSegments(intervals){
 const rows=list(intervals).filter(row=>Number.isFinite(row?.startMinute)&&Number.isFinite(row?.endMinute)&&row.endMinute>row.startMinute).slice().sort((a,b)=>a.startMinute-b.startMinute);
 const segments=[];let travel=null;
 for(let index=0;index<rows.length;index++){
  const row=rows[index],activity=String(row.activity??'OTHER').toUpperCase();
  if(IDLE.has(activity))continue;
  if(TRAVEL.has(activity)||row.districtId==='travel'){
   travel ||= {kind:'travel',startMinute:row.startMinute,endMinute:row.endMinute,minutes:0,modes:new Set(),firstIndex:index,lastIndex:index};
   travel.endMinute=row.endMinute;travel.minutes+=row.endMinute-row.startMinute;travel.modes.add(activity);travel.lastIndex=index;continue;
  }
  const last=segments.at(-1);
  const quietGap=last?.kind==='activity'&&last.activity===activity&&last.districtId===row.districtId&&row.startMinute-last.endMinute<=MERGE_GAP_MINUTES&&(!travel||travel.minutes<MIN_TRAVEL_BEAT_MINUTES);
  if(quietGap){last.endMinute=row.endMinute;last.lastIndex=index;last.parts++;travel=null;continue;}
  if(travel&&travel.minutes>=MIN_TRAVEL_BEAT_MINUTES)segments.push({...travel,modes:[...travel.modes].sort(),toDistrict:row.districtId,toActivity:activity});
  travel=null;
  segments.push({kind:'activity',activity,districtId:row.districtId,startMinute:row.startMinute,endMinute:row.endMinute,firstIndex:index,lastIndex:index,parts:1});
 }
 if(travel&&travel.minutes>=MIN_TRAVEL_BEAT_MINUTES)segments.push({...travel,modes:[...travel.modes].sort(),toDistrict:null,toActivity:null,ongoing:true});
 return{rows,segments};
}

function eventsFor(source){
 const history=source.history??{},id=String(source.person?.id??'');
 const events=list(history.actorTimeline?.events).length?history.actorTimeline.events:list(history.recentEvents).filter(e=>String(e?.personId??e?.actorId??'')===id||list(e?.personIds).map(String).includes(id));
 return events.filter(e=>e&&Number.isFinite(e.minute)&&typeof e.type==='string').slice().sort((a,b)=>a.minute-b.minute);
}

function activityBeat(source,segment,rows,events,name){
 const before=rows[segment.firstIndex-1]?.needs??null,after=rows[segment.lastIndex+1]?.needs??null;
 const started=events.find(e=>e.type==='ACTIVITY_STARTED'&&String(e.activity).toUpperCase()===segment.activity&&e.minute>=segment.startMinute-1&&e.minute<=segment.startMinute+1)??null;
 const decision=matchDecision(source,{activity:segment.activity,startMinute:segment.startMinute,earliestMinute:segment.startMinute-30});
 const why=describeWhy(source,decision);
 const buildingId=started?.buildingId??why?.buildingId??null;
 const place=placeOf(source,{buildingId,districtId:segment.districtId});
 const minutes=segment.endMinute-segment.startMinute;
 const cost=Number.isFinite(started?.cost)?started.cost:null;
 const trend=needTrend(before,after);
 const facts=[
  fact('Activity',activityDisplayLabel(segment.activity),SOURCE.interval,{field:'activity',raw:segment.activity}),
  fact('From',clockLabel(segment.startMinute),SOURCE.interval,{field:'startMinute',raw:segment.startMinute}),
  fact('Until',clockLabel(segment.endMinute),SOURCE.interval,{field:'endMinute',raw:segment.endMinute}),
  fact('Duration',minutes,SOURCE.derived,{unit:'min',formula:'until − from'}),
  fact('Place type',segment.districtId??'unknown',SOURCE.interval,{field:'districtId'}),
  ...(place.id&&place.buildingName?[fact('Place',place.buildingName,started?SOURCE.event:SOURCE.decision,{field:'buildingId',raw:place.id})]:[]),
  ...(cost!==null?[fact('Price paid',money(cost),SOURCE.event,{field:'cost',raw:cost})]:[]),
  ...(segment.parts>1?[fact('Recorded bouts merged',segment.parts,SOURCE.derived,{formula:`same activity and place type, gaps ≤ ${MERGE_GAP_MINUTES} min`})]:[]),
  ...trend.map(t=>fact(`${t.label} before → after`,`${t.from} → ${t.to}`,SOURCE.derived,{unit:'/100',formula:'time-averaged needs of the recorded bouts just before and just after'})),
 ];
 const rates=source.actionCatalog?.[segment.activity.toLowerCase()]?.rate??null;
 const tellable=t=>Math.abs(t.change)>=NARRATED_NEED_CHANGE&&(t.change<0?minutes>=NARRATED_DECAY_MINUTES:rates?rates[t.key]>0:false);
 const shift=trend.filter(tellable).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))[0];
 const narration=[
  activitySentence(segment.activity,{name,at:place.phrase,cost:cost!==null?` (${money(cost)})`:''}),
  shift?`They ${NEED_WORDS[shift.key][shift.change>0?1:0]}: ${shift.label.toLowerCase()} ${Math.round(shift.from)} → ${Math.round(shift.to)}.`:null,
 ].filter(Boolean).join(' ');
 return{kind:'activity',activity:segment.activity,startMinute:segment.startMinute,endMinute:segment.endMinute,ongoing:segment.endMinute>=(source.history?.actorTimeline?.toMinute??-1)&&String(source.person?.activity??'').toUpperCase()===segment.activity,
  placeId:place.id,placeName:place.name,districtId:segment.districtId??null,facts,narration,why,needTrend:trend,
  sourceRefs:[{type:'routine-interval',fromMinute:segment.startMinute,toMinute:segment.endMinute},...(started?[{type:started.type,minute:started.minute}]:[]),...(decision?[{type:'decision',minute:decision.minute}]:[])]};
}

function travelBeat(source,segment,events,name){
 const completed=events.find(e=>e.type==='TRIP_COMPLETED'&&e.minute>=segment.endMinute-1&&e.minute<=segment.endMinute+1)??null;
 const startedTrip=events.find(e=>e.type==='TRIP_STARTED'&&e.minute>=segment.startMinute-1&&e.minute<=segment.startMinute+1)??null;
 const decision=segment.toActivity?matchDecision(source,{activity:segment.toActivity,startMinute:segment.startMinute,earliestMinute:segment.startMinute-2}):null;
 const destinationId=completed?.destinationId??startedTrip?.destinationId??(decision?describeWhy(source,decision)?.buildingId:null);
 const place=segment.toDistrict||destinationId!=null?placeOf(source,{buildingId:destinationId,districtId:segment.toDistrict}):{phrase:'',name:null,id:null};
 const transit=segment.modes.some(mode=>mode.startsWith('TRANSIT'));
 const commanded=startedTrip?.reason==='Explicit user command';
 const facts=[
  fact('Travel mode',segment.modes.map(activityDisplayLabel).join(', '),SOURCE.interval,{field:'activity',raw:segment.modes}),
  fact('Left at',clockLabel(segment.startMinute),SOURCE.interval,{field:'startMinute',raw:segment.startMinute}),
  fact(segment.ongoing?'Still traveling at':'Arrived at',clockLabel(segment.endMinute),SOURCE.interval,{field:'endMinute',raw:segment.endMinute}),
  fact('Travel time',segment.minutes,SOURCE.derived,{unit:'min',formula:'sum of recorded travel bouts'}),
  ...(Number.isFinite(completed?.distanceMeters)?[fact('Distance',Math.round(completed.distanceMeters),SOURCE.event,{unit:'m',field:'distanceMeters'})]:Number.isFinite(startedTrip?.distanceMeters)?[fact('Planned distance',Math.round(startedTrip.distanceMeters),SOURCE.event,{unit:'m',field:'distanceMeters'})]:[]),
  ...(place.id&&place.buildingName?[fact('Destination',place.buildingName,completed||startedTrip?SOURCE.event:SOURCE.decision,{field:'destinationId',raw:place.id})]:[]),
  ...(Number.isFinite(completed?.socialDelayMinutes)&&completed.socialDelayMinutes>0?[fact('Delayed by conversations',completed.socialDelayMinutes,SOURCE.event,{unit:'min',field:'socialDelayMinutes'})]:[]),
  ...(commanded?[fact('Trip reason',startedTrip.reason,SOURCE.event,{field:'reason'})]:[]),
 ];
 const verb=transit?'took transit':'walked';
 const narration=segment.ongoing
  ?`${name} is on the way${place.home?' home':place.name?` to ${place.name}`:''}.`
  :`${name} ${verb} ${minutesLabel(segment.minutes)}${place.home?' home':place.name?` to ${place.name}`:''}${commanded?', as you asked':''}.`;
 return{kind:'travel',startMinute:segment.startMinute,endMinute:segment.endMinute,ongoing:Boolean(segment.ongoing),placeId:place.id,placeName:place.name,facts,narration,
  sourceRefs:[{type:'routine-interval',fromMinute:segment.startMinute,toMinute:segment.endMinute},...[startedTrip,completed].filter(Boolean).map(e=>({type:e.type,minute:e.minute}))]};
}

/** Short repeated activities at one place (TV, chat, TV, chat…) become one routine
 * moment. Each summarized moment stays listed in the facts. */
const ROLLUP_MAX_MINUTES=30,ROLLUP_MIN_MOMENTS=4,ROLLUP_MAX_ACTIVITIES=3;
const ROLLUP_PHRASES={SOCIAL_CHAT:'chatting',RELAX_HOME:'watching TV',EAT_HOME:'eating at home',SLEEP:'sleeping',PLAY_PARK:'enjoying the park',WORK:'working',CLEAN_PARK:'cleaning the park'};
function chatPartners(source,fromMinute,toMinute){
 const names=new Set();
 for(const r of list(source.social?.relationships))for(const m of list(r.memories))if(Number.isFinite(m?.minute)&&m.minute>=fromMinute&&m.minute<=toMinute&&r.name)names.add(r.name);
 return[...names].sort();
}
function rollupRoutines(source,beats,name){
 const out=[];let run=[];
 const flush=()=>{
  const activities=[...new Set(run.map(b=>b.activity))];
  if(run.length<ROLLUP_MIN_MOMENTS||activities.length>ROLLUP_MAX_ACTIVITIES){out.push(...run);run=[];return;}
  const first=run[0],last=run.at(-1),stats=activities.map(code=>({code,count:run.filter(b=>b.activity===code).length,minutes:run.filter(b=>b.activity===code).reduce((sum,b)=>sum+(b.endMinute-b.startMinute),0)})).sort((a,b)=>b.minutes-a.minutes||a.code.localeCompare(b.code));
  const partners=activities.includes('SOCIAL_CHAT')?chatPartners(source,first.startMinute,last.endMinute):[];
  const trend=needTrend(Object.fromEntries(first.needTrend.map(t=>[t.key,t.from])),Object.fromEntries(last.needTrend.map(t=>[t.key,t.to])));
  const phrase=code=>code==='SOCIAL_CHAT'&&partners.length?`chatting with ${partners.slice(0,2).join(' and ')}`:ROLLUP_PHRASES[code]??activityDisplayLabel(code).toLowerCase();
  const at=first.placeName==='home'?'at home':first.placeName?`at ${first.placeName}`:'';
  const narration=stats.length===1?`${name} kept ${phrase(stats[0].code)} ${at} (${stats[0].count} stretches).`:`${name} spent ${minutesLabel(last.endMinute-first.startMinute)} ${at} switching between ${stats.slice(0,-1).map(s=>phrase(s.code)).join(', ')} and ${phrase(stats.at(-1).code)}.`;
  out.push({kind:'routine',activity:stats[0].code,startMinute:first.startMinute,endMinute:last.endMinute,ongoing:last.ongoing,placeId:run.find(b=>b.placeId)?.placeId??null,placeName:first.placeName,districtId:first.districtId,
   facts:[fact('From',clockLabel(first.startMinute),SOURCE.interval,{raw:first.startMinute}),fact('Until',clockLabel(last.endMinute),SOURCE.interval,{raw:last.endMinute}),
    fact('Duration',last.endMinute-first.startMinute,SOURCE.derived,{unit:'min',formula:'until − from'}),
    ...stats.map(s=>fact(activityDisplayLabel(s.code),`${s.count}× · ${s.minutes} min`,SOURCE.derived,{formula:'count and summed duration of the summarized moments'})),
    fact('Moments summarized',run.length,SOURCE.derived,{formula:`consecutive moments ≤ ${ROLLUP_MAX_MINUTES} min at one place, ≤ ${ROLLUP_MAX_ACTIVITIES} activities`}),
    ...(partners.length?[fact('Chat partners',partners.join(', '),SOURCE.social,{field:'relationships.memories'})]:[]),
    ...trend.map(t=>fact(`${t.label} before → after`,`${t.from} → ${t.to}`,SOURCE.derived,{unit:'/100',formula:'needs of the recorded bouts just before the first and just after the last moment'}))],
   narration:narration.replace(/\s{2,}/g,' ').replace(/ \(/,' ('),why:first.why??null,needTrend:trend,summarized:run.map(b=>({start:b.startMinute,end:b.endMinute,activity:b.activity})),
   sourceRefs:run.flatMap(b=>b.sourceRefs)});
  run=[];
 };
 for(const beat of beats){
  const prior=run.at(-1);
  const samePlace=prior&&prior.districtId===beat.districtId&&(prior.placeId===null||beat.placeId===null||prior.placeId===beat.placeId);
  const fits=beat.kind==='activity'&&beat.endMinute-beat.startMinute<=ROLLUP_MAX_MINUTES&&(!run.length||(samePlace&&beat.startMinute-prior.endMinute<=MERGE_GAP_MINUTES));
  if(fits){run.push(beat);continue;}
  flush();
  if(beat.kind==='activity'&&beat.endMinute-beat.startMinute<=ROLLUP_MAX_MINUTES)run.push(beat);else out.push(beat);
 }
 flush();
 return out;
}

const MOMENT_TEMPLATES={
 USER_COMMAND_ISSUED:(v,e)=>`You asked ${v.name} to ${e.action?activityDisplayLabel(e.action).toLowerCase():'walk somewhere'}${v.placeName?` at ${v.placeName}`:''}.`,
 USER_COMMAND_COMPLETED:v=>`${v.name} finished what you asked.`,
 USER_COMMAND_UNAVAILABLE:v=>`What you asked of ${v.name} was no longer available when they got there.`,
 USER_COMMAND_CANCELLED:v=>`You cancelled your request to ${v.name}.`,
 USER_COMMAND_REPLACED:v=>`Your earlier request to ${v.name} was replaced.`,
 ACTIVITY_INTERRUPTED:(v,e)=>`That interrupted ${activityDisplayLabel(e.activity).toLowerCase()}.`,
 TRIP_INTERRUPTED:v=>`${v.name} turned around mid-trip.`,
 RESIDENT_CONVERSATION_INTERRUPTED:v=>`${v.name} cut a conversation short.`,
 ACTIVITY_UNAVAILABLE:(v,e)=>`${v.name} arrived${v.placeName?` at ${v.placeName}`:''}, but ${e.activity?activityDisplayLabel(e.activity).toLowerCase():'the plan'} was no longer possible.`,
 PLAYER_WALK_REQUESTED:v=>`You sent ${v.name} on a walk.`,
 EMPLOYMENT_MATCHED:v=>`${v.name} was matched to a job.`,
 HOUSEHOLD_RELOCATED:v=>`${v.name}'s household moved.`,
};
const EVENT_FIELD_LABELS={reason:'Reason',action:'Requested activity',commandType:'Command type',destinationId:'Destination',activity:'Activity',walkMinutes:'Walk minutes',travelMinutes:'Travel minutes',plannedMinutes:'Planned minutes',districtId:'Place type',mode:'Mode',cost:'Price paid'};
const OMITTED_EVENT_FIELDS=new Set(['minute','type','personId','householdId','route','destination','personIds','count','weight']);

function momentBeat(source,event,name){
 const placeId=event.destinationId??event.buildingId??null;
 const place=placeId!=null?placeOf(source,{buildingId:placeId,districtId:source.places?.[String(placeId)]?.kind}):{name:null,id:null};
 const facts=[fact('Recorded at',clockLabel(event.minute),SOURCE.event,{field:'minute',raw:event.minute}),fact('Event type',event.type,SOURCE.event,{field:'type'})];
 for(const [key,value] of Object.entries(event)){
  if(OMITTED_EVENT_FIELDS.has(key)||value===null||value===undefined||typeof value==='object')continue;
  const shown=key==='destinationId'||key==='buildingId'?(place.name??value):key==='cost'?money(value):key==='activity'||key==='action'?activityDisplayLabel(value):value;
  facts.push(fact(EVENT_FIELD_LABELS[key]??activityDisplayLabel(key),shown,SOURCE.event,{field:key,raw:value}));
 }
 const template=MOMENT_TEMPLATES[event.type];
 const narration=template?template({name,placeName:place.name},event):`${activityDisplayLabel(event.type)} was recorded for ${name}.`;
 const influence=/^USER_COMMAND|^PLAYER_/.test(event.type)||event.reason==='Explicit user command';
 return{kind:influence?'influence':'moment',type:event.type,startMinute:event.minute,endMinute:event.minute,placeId:place.id,placeName:place.name,facts,narration,sourceRefs:[{type:event.type,minute:event.minute}]};
}

function socialBeats(source,name,fromMinute){
 const beats=[];
 for(const relationship of list(source.social?.relationships)){
  for(const memory of list(relationship.memories)){
   // Plain "caught up" conversations are routine; the routine moment names the partner.
   if(!Number.isFinite(memory?.minute)||memory.minute<fromMinute||typeof memory.text!=='string'||memory.event==='conversation')continue;
   beats.push({kind:'social',startMinute:memory.minute,endMinute:memory.minute,placeId:null,placeName:null,
    facts:[fact('Recorded at',clockLabel(memory.minute),SOURCE.social,{field:'memories.minute',raw:memory.minute}),fact('With',relationship.name??relationship.id,SOURCE.social,{field:'relationships.name'}),fact('Memory type',memory.event??'memory',SOURCE.social,{field:'memories.event'}),fact('Relationship',relationship.label??'',SOURCE.social,{field:'label'}),fact('Memory text (written by the social model)',memory.text,SOURCE.social,{field:'memories.text'})],
    narration:`A moment with ${relationship.name??'someone'}: ${memory.text}`,sourceRefs:[{type:'relationship-memory',minute:memory.minute}]});
  }
 }
 return beats;
}

function nowSection(source,name){
 const person=source.person??{},needs=person.needs&&typeof person.needs==='object'?person.needs:{};
 const keys=Object.keys(NEED_LABELS).filter(key=>Number.isFinite(needs[key]));
 const lowest=keys.slice().sort((a,b)=>needs[a]-needs[b])[0]??null;
 const household=source.household??null;
 const facts=[
  fact('Model time',clockLabel(source.minute),SOURCE.snapshot,{field:'minute',raw:source.minute}),
  fact('Doing',person.doing??activityDisplayLabel(person.activity),SOURCE.snapshot,{field:'doing'}),
  ...keys.map(key=>fact(NEED_LABELS[key],round(needs[key]),SOURCE.snapshot,{unit:'/100',field:`needs.${key}`})),
  ...(household&&Number.isFinite(household.cash)?[fact('Household cash',money(household.cash),SOURCE.snapshot,{field:'household.cash',raw:household.cash})]:[]),
  ...(household&&Number.isFinite(household.lastDailyCost)&&household.lastDailyCost>0?[fact('Last nightly housing + utilities',money(household.lastDailyCost),SOURCE.snapshot,{field:'household.lastDailyCost'})]:[]),
  ...(household&&household.lastShortfall>0?[fact('Last shortfall',money(household.lastShortfall),SOURCE.snapshot,{field:'household.lastShortfall'})]:[]),
  ...(household&&household.stressedDays>0?[fact('Days short on costs',household.stressedDays,SOURCE.snapshot,{field:'household.stressedDays'})]:[]),
 ];
 const hooks=[];
 if(lowest&&needs[lowest]<60)hooks.push({kind:'need',text:`${NEED_LABELS[lowest]} is lowest (${Math.round(needs[lowest])}/100). In this model a low need makes activities that restore it score higher, so watch for that in their next choice.`});
 const promise=list(source.social?.promises).find(p=>p?.status==='scheduled');
 if(promise){const partner=String(promise.a)===String(person.id)?promise.bName:promise.aName;hooks.push({kind:'promise',text:`A park meetup${partner?` with ${partner}`:''} is scheduled${Number.isFinite(promise.dueMinute)?` for ${clockLabel(promise.dueMinute)}`:''}. Kept or missed, it changes their trust.`});}
 const goal=list(source.social?.goals).find(g=>g&&!g.completed);
 if(goal)hooks.push({kind:'goal',text:`Personal goal: ${goal.title}.${goal.help?` ${goal.help}`:''}`});
 if(household?.lastShortfall>0)hooks.push({kind:'money',text:`Their household came up ${money(household.lastShortfall)} short on last night's housing and utilities.`});
 const sentence=`${name} is ${person.doing??activityDisplayLabel(person.activity).toLowerCase()}.`;
 return{minute:source.minute,clock:clockLabel(source.minute),doing:person.doing??null,activity:person.activity??null,needs:Object.fromEntries(keys.map(key=>[key,round(needs[key])])),lowestNeed:lowest,narration:sentence,facts,hooks};
}

/** Build the story. `limit` keeps the newest moments; dropped moments are counted. */
export function buildLifeStory(source,{limit=40}={}){
 if(!source||typeof source!=='object'||source.person?.id===undefined||source.person?.id===null)throw new Error('A life story needs a selected resident.');
 const name=personName(source);
 const events=eventsFor(source);
 const timeline=source.history?.actorTimeline??null;
 const {rows,segments}=routineSegments(timeline?.intervals);
 const beats=rollupRoutines(source,segments.map(segment=>segment.kind==='travel'?travelBeat(source,segment,events,name):activityBeat(source,segment,rows,events,name)),name);
 // Events-only sources (for example a population without routine intervals) still
 // tell recorded starts and trips, without inventing durations.
 if(!rows.length){
  for(const event of events){
   if(event.type==='ACTIVITY_STARTED'&&event.activity){const code=String(event.activity).toUpperCase(),place=placeOf(source,{buildingId:event.buildingId,districtId:event.districtId});beats.push({...momentBeat(source,event,name),kind:'activity',activity:code,narration:`${name} started ${activityDisplayLabel(code).toLowerCase()}${place.phrase?` ${place.phrase}`:''}${Number.isFinite(event.cost)?` (${money(event.cost)})`:''}.`});}
   else if(event.type==='TRIP_COMPLETED'){const minutes=Number.isFinite(event.travelMinutes)?event.travelMinutes:null;const place=placeOf(source,{buildingId:event.destinationId,districtId:event.to});beats.push({...momentBeat(source,event,name),kind:'travel',narration:`${name} completed a trip${minutes!==null?` of ${minutesLabel(minutes)}`:''}${place.name?` to ${place.name}`:''}.`});}
  }
 }
 const timelineFrom=Number.isFinite(timeline?.intervals?.[0]?.startMinute)?timeline.intervals[0].startMinute:(events[0]?.minute??source.minute);
 for(const event of events)if(!FOLDED_EVENTS.has(event.type))beats.push(momentBeat(source,event,name));
 beats.push(...socialBeats(source,name,timelineFrom??0));
 beats.sort((a,b)=>a.startMinute-b.startMinute||(a.kind==='influence'?-1:0)-(b.kind==='influence'?-1:0));
 const dropped=Math.max(0,beats.length-limit);
 // Ids stay stable as moments are added or trimmed, so a view can keep its state.
 const used=new Map();
 const kept=beats.slice(dropped).map(beat=>{const base=`${beat.startMinute}:${beat.kind}:${beat.activity??beat.type??''}`,n=(used.get(base)??0)+1;used.set(base,n);return{id:n>1?`${base}#${n}`:base,clock:shortClock(beat.startMinute),...beat};});
 const retention={droppedRoutineIntervals:timeline?.droppedIntervals??0,droppedDetailEvents:timeline?.droppedEvents??0,olderMomentsNotShown:dropped};
 const gaps=[];
 if(retention.droppedRoutineIntervals>0)gaps.push({kind:'routine-not-retained',text:`${retention.droppedRoutineIntervals} earlier routine bout${retention.droppedRoutineIntervals===1?' was':'s were'} not retained, so the story starts at ${clockLabel(timelineFrom)}.`});
 if(retention.droppedDetailEvents>0)gaps.push({kind:'detail-not-retained',text:`${retention.droppedDetailEvents} older detail event${retention.droppedDetailEvents===1?' is':'s are'} no longer retained; those moments show routine facts without place names or prices.`});
 if(!beats.length)gaps.push({kind:'empty',text:`No retained moments for ${name} yet. New moments appear as the simulation runs.`});
 const identity=source.identity??{};
 const provenance={mode:source.mode??'unknown',runId:identity.runId??null,modelVersion:identity.modelVersion??null,seed:identity.seed??null,simulationSeed:identity.simulationSeed??null,actorId:String(source.person.id),
  fromMinute:Number.isFinite(timelineFrom)?timelineFrom:null,toMinute:source.minute??null,
  sources:[timeline?.intervals?'activity-history routine intervals':null,events.length?'activity-history events':null,list(source.person.decisionTrace).length?'decision trace':null,source.social?'social model inspection':null,'current snapshot'].filter(Boolean),
  storyVersion:LIFE_STORY_VERSION,narrationVersion:LIFE_STORY_NARRATION_VERSION};
 const now=nowSection(source,name);
 const resident={id:String(source.person.id),name,age:Number.isFinite(source.person.age)?source.person.age:null,trait:source.person.trait??null,householdId:source.person.householdId??null};
 const factsDigest=digestFacts({provenance:{...provenance,storyVersion:LIFE_STORY_VERSION,narrationVersion:undefined},resident,now:now.facts.map(f=>[f.label,f.value]),beats:kept.map(beat=>({start:beat.startMinute,end:beat.endMinute,kind:beat.kind,facts:beat.facts.map(f=>[f.label,f.value,f.source]),why:beat.why?.facts.map(f=>[f.label,f.value])??null}))});
 return{schemaVersion:LIFE_STORY_VERSION,narrationNotice:LIFE_STORY_NARRATION_NOTICE,provenance,resident,now,beats:kept,gaps,retention,factsDigest,
  options:list(source.options).map(option=>({...option})),closest:closestRelationships(source)};
}

function closestRelationships(source){
 return list(source.social?.relationships).filter(r=>r&&r.name&&Number.isFinite(r.friendship)).slice().sort((a,b)=>b.friendship-a.friendship||String(a.id).localeCompare(String(b.id))).slice(0,3)
  .map(r=>({id:String(r.id),name:r.name,label:r.label??null,friendship:round(r.friendship,0),trust:round(r.trust,0),tension:round(r.tension,0)}));
}
