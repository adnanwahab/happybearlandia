import {SOCIAL_ACTIONS} from './model.js';
// Text nodes keep character names and memories safe to display.
export function renderRelationships(container,social,{onInteract,onSelect,onRefresh}={}){
 const doc=container.ownerDocument;container.replaceChildren();container.style.cssText='margin-top:16px;border-top:1px solid #8796a655;padding-top:10px';
 const add=(tag,text,parent=container)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 add('h3','Relationships');add('p','Every encounter can change a relationship. Open a name to see their shared history.');
 const list=add('div','');list.style.cssText='max-height:260px;overflow:auto';
 if(!social.relationships.length)add('p','No established ties yet. Introduce them to someone nearby.',list);
 for(const r of social.relationships){const row=add('details','',list);const summary=add('summary',`${r.name} · ${r.label}`,row);summary.style.cursor='pointer';add('p',`Friendship ${r.friendship}/100 · Romance ${r.romance}/100 · Familiarity ${r.familiarity}/100 · Tension ${r.tension}/100`,row);if(r.familiarity>=90)add('p','They know each other’s habits extremely well. Shared memories make especially good conversation starters.',row);if(onSelect){const button=add('button','Inspect character',row);button.type='button';button.onclick=()=>onSelect(r.id);}if(!r.memories.length)add('p','They have a history together. No new shared memories yet.',row);for(const memory of r.memories)add('p',`Minute ${Math.floor(memory.minute)} · ${memory.text}`,row);}
 if(onRefresh){const refresh=add('button','Refresh nearby people');refresh.type='button';refresh.onclick=()=>onRefresh();}
 add('h3','Make a social move');add('p',`Available within ${social.radius} meters. Encounters have a five-minute cooldown.`);
 const status=add('p','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 if(!social.nearby.length){add('p','Nobody nearby is available. Let time pass or follow this person to a busier place.');return;}
 const target=add('select','');target.setAttribute('aria-label','Nearby character');target.style.maxWidth='100%';if(social.nearby.length>30)add('p',`Showing the 30 closest of ${social.nearby.length} available people.`);for(const p of social.nearby.slice(0,30)){const option=add('option',`${p.name} · ${p.distance} m`,target);option.value=p.id;}
 const actions=add('div','');actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';let pending=false;
 for(const [action,label]of Object.entries(SOCIAL_ACTIONS)){if(!social.adult&&['flirt','date'].includes(action))continue;const button=add('button',label,actions);button.type='button';button.onclick=async()=>{if(pending)return;pending=true;for(const b of actions.children)b.disabled=true;try{const result=await onInteract(target.value,action);status.textContent=result.text;const oldTarget=target.value;renderRelationships(container,result.social,{onInteract,onSelect,onRefresh});const feedback=doc.createElement('p');feedback.setAttribute('role','status');feedback.textContent=result.text;container.prepend(feedback);const next=container.querySelector('select');if(next)next.value=oldTarget;}catch(error){status.textContent=error.message;}finally{pending=false;for(const b of actions.children)b.disabled=false;}};}
}
