/** Life Story panel: renders buildLifeStory() output and refreshes while open.
 * Hosts supply the data and the authoritative commands; this view only reads the
 * story and sends a chosen nudge back through `onNudge`. */
import {buildLifeStory,NEED_LABELS} from './life-story.js';

const STYLESHEET='/world/stories/life-story.css';
const KIND_ICONS={activity:'●',routine:'↻',travel:'→',influence:'✦',moment:'◆',social:'♥'};
const NUDGE_VERBS={play_park:'Go to the park',eat_out:'Eat out'};
const NUDGES_PER_ACTIVITY=2;

function ensureStylesheet(){
 if(typeof document==='undefined'||document.querySelector(`link[href="${STYLESHEET}"]`))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;document.head.append(link);
}
function el(tag,attrs={},...children){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){if(value===null||value===undefined||value===false)continue;if(key==='text')node.textContent=value;else if(key==='class')node.className=value;else node.setAttribute(key,value===true?'':String(value));}
 for(const child of children.flat(Infinity))if(child!==null&&child!==undefined&&child!==false&&child!=='')node.append(child.nodeType?child:document.createTextNode(String(child)));
 return node;
}
const initials=name=>String(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()??'').join('')||'?';
const valueText=f=>`${f.value}${f.unit&&!String(f.value).includes(f.unit)?` ${f.unit}`:''}`;

function factList(facts){
 return el('dl',{class:'life-story-facts-list'},facts.map(f=>[el('dt',{text:f.label}),el('dd',{},el('span',{text:valueText(f)}),el('small',{text:f.formula?`${f.source}: ${f.formula}`:f.source}))]));
}

/** Nearest options first; at most two per activity, one per place name. */
export function chooseNudges(options){
 const seen=new Set(),perAction=new Map(),chosen=[];
 for(const option of [...options].sort((a,b)=>(a.distanceMeters??0)-(b.distanceMeters??0)||String(a.buildingId).localeCompare(String(b.buildingId)))){
  const placeName=String(option.label??'').split(' · ').slice(1).join(' · ')||String(option.buildingId);
  const key=`${option.actionId}:${placeName}`,count=perAction.get(option.actionId)??0;
  if(seen.has(key)||count>=NUDGES_PER_ACTIVITY)continue;
  seen.add(key);perAction.set(option.actionId,count+1);chosen.push({...option,placeName});
 }
 return chosen;
}

export function mountLifeStory(container,{loadSource,onNudge=null,subscribe=null,refreshMs=1000,onStatus=()=>{},notice=null}={}){
 if(typeof loadSource!=='function')throw new Error('Life story needs a source loader.');
 ensureStylesheet();
 const root=el('section',{class:'life-story','data-life-story':''});
 const live=el('p',{class:'life-story-sr','aria-live':'polite'});
 container.append(root,live);
 let destroyed=false,timer=null,pending=false,lastStory=null,showNarration=true,generation=0,seenBeats=null;

 function render(story,sourceNotice){
  const openIds=new Set([...root.querySelectorAll('details[open][data-id]')].map(node=>node.dataset.id));
  const focusKey=root.contains(document.activeElement)?document.activeElement.dataset?.key??null:null;
  const newIds=seenBeats?story.beats.filter(b=>!seenBeats.has(b.id)):[];
  seenBeats=new Set(story.beats.map(b=>b.id));
  const {resident,now}=story;
  const household=now.facts.find(f=>f.label==='Household cash');
  const who=el('div',{class:'life-story-who'},
   el('span',{class:'life-story-avatar','aria-hidden':'true',text:initials(resident.name)}),
   el('div',{},el('h3',{text:resident.name}),el('p',{text:[resident.age!=null?`${resident.age}`:null,resident.trait,household?`household cash ${household.value}`:null].filter(Boolean).join(' · ')})));
  const needs=el('div',{class:'life-story-needs'},Object.entries(NEED_LABELS).filter(([key])=>Number.isFinite(now.needs[key])).map(([key,label])=>{
   const value=Math.round(now.needs[key]);
   return el('div',{class:`life-story-need${key===now.lowestNeed&&value<60?' is-low':''}`},el('span',{text:label}),
    el('span',{class:'life-story-meter',role:'meter','aria-label':`${label} need`,'aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(value)},el('i',{style:`width:${Math.max(0,Math.min(100,value))}%`})),
    el('b',{text:String(value)}));
  }));
  const nowBox=el('div',{class:'life-story-now'},
   el('p',{class:'life-story-now-line'},el('span',{class:'life-story-live-dot','aria-hidden':'true'}),el('strong',{text:`Now · ${now.clock}`}),' ',el('span',{class:'life-story-narration',text:now.narration})),
   needs,
   now.hooks.length?el('ul',{class:'life-story-hooks','aria-label':'What could happen next'},now.hooks.map(h=>el('li',{'data-kind':h.kind,text:h.text}))):null,
   el('details',{class:'life-story-facts','data-id':'now'},el('summary',{text:'Model facts now'}),factList(now.facts)));
  for(const node of nowBox.querySelectorAll('details[data-id]'))if(openIds.has(node.dataset.id))node.open=true;

  const nudges=onNudge?chooseNudges(story.options):[];
  const nudgeBox=onNudge?el('div',{class:'life-story-nudge'},el('h4',{text:'Change their day'}),
   el('p',{text:nudges.length?'Send them somewhere. The model plays out the trip and its effects; you can follow them in the story.':'Nothing to offer right now: no nearby park or restaurant is available to them under the model’s rules at this hour.'}),
   nudges.length?el('div',{class:'life-story-nudge-buttons'},nudges.map(option=>{
    const button=el('button',{type:'button','data-nudge':option.actionId,'data-key':`nudge:${option.actionId}:${option.buildingId}`},el('span',{text:`${NUDGE_VERBS[option.actionId]??option.actionId} · ${option.placeName}`}),el('small',{text:[Number.isFinite(option.distanceMeters)?`${Math.round(option.distanceMeters)} m away`:null,option.cost?`$${option.cost} from household cash`:'free'].filter(Boolean).join(' · ')}));
    button.addEventListener('click',()=>void nudge(option,button));return button;
   })):null):null;

  const beats=el('ol',{class:'life-story-beats','aria-label':'Their day, newest first'},story.beats.slice().reverse().map(beat=>{
   const why=beat.why?el('details',{class:'life-story-why','data-id':`why:${beat.id}`},el('summary',{text:'Why?'}),el('p',{class:'life-story-narration',text:beat.why.narration}),factList(beat.why.facts),el('p',{class:'life-story-rule',text:`Model rule: ${beat.why.rule}`})):null;
   const facts=el('details',{class:'life-story-facts','data-id':`facts:${beat.id}`},el('summary',{text:'Model facts'}),factList(beat.facts));
   for(const node of [why,facts])if(node&&(openIds.has(node.dataset.id)||(!showNarration&&node===facts)))node.open=true;
   const isNew=newIds.some(b=>b.id===beat.id);
   return el('li',{class:`life-story-beat${isNew?' is-new':''}${beat.ongoing?' is-ongoing':''}`,'data-kind':beat.kind},
    el('time',{text:beat.clock}),el('span',{class:'life-story-icon','aria-hidden':'true',text:KIND_ICONS[beat.kind]??'·'}),
    el('div',{class:'life-story-body'},el('p',{class:'life-story-narration',text:beat.narration}),why,facts));
  }));

  const toggle=el('input',{type:'checkbox',checked:showNarration?true:null,'data-key':'narration-toggle'});
  toggle.addEventListener('change',()=>{showNarration=toggle.checked;root.classList.toggle('facts-only',!showNarration);if(lastStory)render(lastStory,sourceNotice);});
  const p=story.provenance;
  const footer=el('div',{class:'life-story-footer'},
   el('label',{class:'life-story-toggle'},toggle,' Show narration'),
   [sourceNotice,...story.gaps.map(g=>g.text)].filter(Boolean).map(text=>el('p',{class:'life-story-gap',text})),
   el('p',{class:'life-story-provenance',text:`${story.narrationNotice} Only retained simulation evidence is shown; moments that were not retained are not reconstructed.`}),
   el('p',{class:'life-story-provenance'},el('code',{text:[`run ${p.runId??'unavailable'}`,`seed ${p.seed??'unavailable'}`,`model ${p.modelVersion??'unavailable'}`,`${p.storyVersion} / ${p.narrationVersion}`,`facts ${story.factsDigest}`].join(' · ')})));

  root.classList.toggle('facts-only',!showNarration);
  root.replaceChildren(who,nowBox,nudgeBox??'',el('h4',{class:'life-story-day',text:story.beats.length?'Their day, newest first':'Their day'}),story.beats.length?beats:el('p',{class:'life-story-gap',text:'Moments appear here as the simulation runs. Use the speed controls to move time along.'}),footer);
  for(const details of root.querySelectorAll('details[data-id]'))details.querySelector('summary')?.setAttribute('data-key',`summary:${details.dataset.id}`);
  if(focusKey)root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});
  if(newIds.length)live.textContent=`New: ${newIds.map(b=>b.narration).join(' ')}`;
 }

 function renderError(message){
  const retry=el('button',{type:'button',text:'Try again'});retry.addEventListener('click',()=>void refresh());
  root.replaceChildren(el('p',{class:'life-story-gap',role:'alert',text:message}),retry);
 }

 async function refresh(){
  if(destroyed)return;
  const mine=++generation;
  try{
   const loaded=await loadSource();
   if(destroyed||mine!==generation)return;
   if(!loaded?.source){renderError(loaded?.message??'Select a resident to see their life story.');return;}
   lastStory=buildLifeStory(loaded.source);
   render(lastStory,loaded.notice??notice);
  }catch(error){if(!destroyed&&mine===generation)renderError(error?.message||String(error));}
 }

 async function nudge(option,button){
  button.disabled=true;
  try{const result=await onNudge(option);onStatus(result?.message??`${lastStory?.resident.name??'They'} ${option.actionId==='eat_out'?'set off to eat at':'set off for'} ${option.placeName}. Watch the story for what happens.`);}
  catch(error){onStatus(error?.message||String(error));}
  finally{button.disabled=false;await refresh();}
 }

 function schedule(){
  if(destroyed||pending)return;pending=true;
  timer=setTimeout(()=>{pending=false;timer=null;void refresh();},refreshMs);
 }
 const unsubscribe=typeof subscribe==='function'?subscribe(schedule):null;
 void refresh();
 return{
  refresh,
  getStory:()=>lastStory,
  destroy(){destroyed=true;clearTimeout(timer);try{unsubscribe?.();}catch{}root.remove();live.remove();},
 };
}
