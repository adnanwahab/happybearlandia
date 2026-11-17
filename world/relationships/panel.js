import {renderSocialNetwork} from './network-ui.js';
import {renderCityTraditions} from './city-traditions-ui.js';
import {SOCIAL_ACTIONS} from './model.js';
const time=minute=>`day ${Math.floor(minute/1440)+1} at ${String(Math.floor(minute%1440/60)).padStart(2,'0')}:${String(Math.floor(minute%60)).padStart(2,'0')}`;
// Text nodes keep names, goals and memories safe to display.
export function renderRelationships(container,social,{onInteract,onSelect,onRefresh}={}){
 const doc=container.ownerDocument;container.replaceChildren();container.style.cssText='margin-top:16px;border-top:1px solid #8796a655;padding-top:10px';
 const add=(tag,text,parent=container)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 const status=add('p','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');let pending=false;
 async function act(target,action){if(pending)return;pending=true;const buttons=[...container.querySelectorAll('button')];for(const b of buttons)b.disabled=true;try{const result=await onInteract(target,action);renderRelationships(container,result.social,{onInteract,onSelect,onRefresh});container.querySelector('[role="status"]').textContent=result.text;}catch(error){status.textContent=error.message;}finally{pending=false;for(const b of buttons)b.disabled=false;}}
 if(social.network)renderSocialNetwork(add('section',''),social.network,{onSelect});
 add('h3','Personal goals');
 for(const goal of social.goals??[]){const row=add('div','');add('p',`${goal.completed?'✓ Completed: ':''}${goal.title}`,row);if(!goal.completed){add('small',goal.help,row);if(social.adult){const button=add('button','Arrange park meetup',row);button.type='button';button.disabled=!social.meetingAvailable;button.onclick=()=>act(goal.targetId,'promise');}}}
 if(!social.goals?.length)add('p','Meet someone nearby to start a shared story.');
 if(!social.meetingAvailable)add('p','No park meeting spot is available in this neighborhood.');
 add('h3','Promises');
 if(!social.promises?.length)add('p','No promises yet. Arrange a meetup to make time for someone.');
 for(const p of social.promises??[]){const row=add('div','');add('p',`${p.aName} + ${p.bName} · ${p.place.name} · ${time(p.dueMinute)} · ${p.status}`,row);if(p.status==='scheduled'){add('small','They head out one hour beforehand. Both must arrive and stay together for ten minutes. Work, care, weather and travel can interfere.',row);const button=add('button','Cancel promise',row);button.type='button';button.onclick=()=>act(String(social.personId)===p.a?p.b:p.a,'cancelPromise');}}
 const traditions=add('section','');renderCityTraditions(traditions,social,{onAction:act});
 add('h3','Relationships');add('p','Every encounter can change a relationship. Open a name to see their shared history.');
 const list=add('div','');list.style.cssText='max-height:260px;overflow:auto';
 if(!social.relationships.length)add('p','No established ties yet. Introduce them to someone nearby.',list);
 for(const r of social.relationships){const row=add('details','',list);const summary=add('summary',`${r.name} · ${r.label}`,row);summary.style.cursor='pointer';add('p',`Friendship ${r.friendship}/100 · Trust ${r.trust??50}/100 · Romance ${r.romance}/100 · Familiarity ${r.familiarity}/100 · Tension ${r.tension}/100`,row);if(r.familiarity>=90)add('p','They know each other’s habits extremely well. Shared memories make especially good conversation starters.',row);if(onSelect){const button=add('button','Inspect character',row);button.type='button';button.onclick=()=>onSelect(r.id);}if(!r.memories.length)add('p','They have a history together. No new shared memories yet.',row);for(const memory of r.memories)add('p',`Minute ${Math.floor(memory.minute)} · ${memory.text}`,row);}
 if(onRefresh){const refresh=add('button','Refresh nearby people');refresh.type='button';refresh.onclick=()=>onRefresh();}
 add('h3','Make a social move');add('p',`Available within ${social.radius} meters. Conversations have a five-minute cooldown.`);
 if(!social.nearby.length){add('p','Nobody nearby is available. Let time pass or follow this person to a busier place.');return;}
 const target=add('select','');target.setAttribute('aria-label','Nearby character');target.style.maxWidth='100%';if(social.nearby.length>30)add('p',`Showing the 30 closest of ${social.nearby.length} available people.`);for(const p of social.nearby.slice(0,30)){const option=add('option',`${p.name} · ${p.distance} m`,target);option.value=p.id;}
 const actions=add('div','');actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
 for(const [action,label]of Object.entries(SOCIAL_ACTIONS)){if(!social.adult&&['flirt','date','promise'].includes(action))continue;const button=add('button',label,actions);button.type='button';button.disabled=action==='promise'&&!social.meetingAvailable;button.onclick=()=>act(target.value,action);}
}
