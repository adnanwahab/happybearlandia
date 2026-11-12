import {characterFromPerson,createContinuityStore,SOCIAL_EXPERIENCES} from './continuity.js';
import {contextFromURL,contextURL,navigationMessage} from '../universe/navigation.js';
import {getExperience} from '../universe/registry.js';
const experience=document.currentScript?.dataset.experience || document.querySelector('script[data-social-experience]')?.dataset.socialExperience;
const savedFutureView=new URLSearchParams(location.search).get('journey')==='1';
let context,store,character,initialError;
try {context=contextFromURL(location.href);store=createContinuityStore(localStorage);character=context.entityId?store.find(context):null;} catch(error) { initialError=error.message; }
const panel=document.createElement('details');panel.className='social-journey';panel.dataset.testid='social-journey';
const style=document.createElement('link');style.rel='stylesheet';style.href='/world/social/journey.css';document.head.append(style);
const title=document.createElement('summary');title.textContent='Character continuity';panel.append(title);
const content=document.createElement('div');panel.append(content);document.body.append(panel);
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
function show(){
 content.replaceChildren();
 if(!character){content.append(el('p',initialError?`Unable to open character context: ${initialError}`:'Select a Living City resident or an Inner Lives person to start a linked journey.'));return;}
 content.append(el('h3',character.name),el('p',`${character.evidence} source · ${character.source} · tick ${character.context.tick??'not recorded'}`),el('code',character.personId));
 const ids=el('dl','');for(const [key,label] of [['householdId','Household'],['homeId','Home'],['jobId','Job'],['locationId','Location']]){ids.append(el('dt',label),el('dd',character[key]??'No explicit mapping'));}content.append(ids);
 if(character.schedule)content.append(el('p',`Saved schedule: ${JSON.stringify(character.schedule)}`));
 if(character.relationships) {const detail=el('details','');detail.append(el('summary','Saved relationships'),el('pre',JSON.stringify(character.relationships,null,2)));content.append(detail);}
 if(character.narrative)content.append(el('p',`Fictional source journal: ${JSON.stringify(character.narrative)}`));
 if(character.measured)content.append(el('p',`Recorded synthetic snapshot: ${JSON.stringify(character.measured)}`));
 content.append(el('p','Carry this identity as a fictional role or conversation reference. Native casts, saves, and multiplayer room permissions stay in control.'));
 const nav=el('nav','');nav.setAttribute('aria-label','Follow this character');
 for(const id of SOCIAL_EXPERIENCES){if(id===experience)continue;const app=getExperience(id);const a=el('a',app.title);a.href=contextURL(app.route,character.context);nav.append(a);}content.append(nav);
 if(experience==='act-normal'){const button=el('button','Use name in party lobby');button.type='button';button.onclick=()=>{const input=document.querySelector('[data-name]');if(input){input.value=character.name.slice(0,32);input.dispatchEvent(new Event('input',{bubbles:true}));}};content.append(button);}
 const label=el('label','Fictional memory (private to this browser)');const input=el('textarea','');input.maxLength=2000;label.append(input);content.append(label);
 const save=el('button','Record fictional memory');save.type='button';save.onclick=()=>{try{store.record(character,{experience,text:input.value});show();}catch(error){status.textContent=error.message;}};content.append(save);
 const status=el('p','');status.setAttribute('role','status');content.append(status);
 const references=store.references(character);content.append(el('p',`${references.length} narrative references · no simulation effects`));for(const row of references.slice(-5))content.append(el('p',`${row.experience}: ${row.text}`));
}
function select(person,source,tick){if(!store||!context)return;try{character=store.save(characterFromPerson(person,{source,context,tick}));context=character.context;if(!savedFutureView){history.replaceState(null,'',contextURL(location.href,context));if(parent!==window)parent.postMessage(navigationMessage('select',context,{entityId:character.personId}),location.origin);}show();}catch(error){content.replaceChildren(el('p',error.message));}}
window.addEventListener('hbl:social-person',e=>select(e.detail.person,e.detail.source,e.detail.tick));
window.addEventListener('hbl:social-narrative',e=>{if(!character||!store)return;try{store.record(character,{experience,text:e.detail.text});show();}catch{/* Unsupported/oversize reference does not affect gameplay. */}});
show();
