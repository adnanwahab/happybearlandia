import {CITY_TRADITION_TYPES} from './city-traditions.js';
const when=n=>`day ${Math.floor(n/1440)+1} at ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
export function renderCityTraditions(container,social,{onAction}){
 const doc=container.ownerDocument,add=(tag,text,parent=container)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e;};
 add('h3','Neighborhood traditions');add('p','Make a small gathering part of neighborhood life. Friends can invite someone new; only time spent together counts as attendance.');
 for(const t of social.traditions??[]){const row=add('details','');row.dataset.traditionId=t.id;const summary=add('summary',`${t.title}${t.ritual?' · Beloved neighborhood ritual':''} · ${t.enabled?(t.current?'gathering now':'scheduled'):'paused'}`,row);summary.style.cursor='pointer';add('p',`${t.hostName} hosts at ${t.place.name}. ${t.enabled?`Next gathering: ${when(t.nextMinute)}.`:'The recurring schedule is paused.'}`,row);add('p',`Regulars: ${t.members.join(', ')}. ${t.completedCount} gathering${t.completedCount===1?'':'s'} shared. ${social.personName??'This character'} attended ${t.attended} time${t.attended===1?'':'s'}${t.attended>=3?' · Regular attendee':''}.`,row);
  const button=(label,operation)=>{const e=add('button',label,row);e.type='button';e.onclick=()=>onAction(t.hostId,`tradition-${operation}-${t.kind}`);return e;};
  if(t.host)button(t.enabled?'Pause tradition':'Resume tradition',t.enabled?'pause':'resume');else if(t.joined)button('Leave tradition','leave');else if(t.enabled){const b=button('Join gathering','join');b.disabled=!social.adult||t.memberIds.length>=8;}
  for(const h of t.history)add('p',`${when(h.minute)} · ${h.text}`,row);
 }
 if(!social.adult){add('p','Children keep their family gatherings, school and care routines. Adults can organize city gatherings.');return;}
 const start=add('details','');add('summary','Start a neighborhood tradition',start);
 for(const [kind,type]of Object.entries(CITY_TRADITION_TYPES)){const row=add('div','',start);row.style.cssText='margin:12px 0';add('strong',type.title,row);const schedule=kind==='picnic'?'Fridays at 20:00':kind==='lunch'?'Weekdays at 12:00':'Every 30 game days at 20:00';add('p',schedule,row);
  const all=new Map();for(const p of [...social.relationships,...social.nearby])if(p.adult&&String(p.id)!==String(social.personId)&&(kind!=='lunch'||social.coworkerKey!=null&&social.coworkerKey>=0&&p.coworkerKey===social.coworkerKey))all.set(String(p.id),p);
  const label=add('label','Start with ',row),target=add('select','',label);target.setAttribute('aria-label',`${type.title} companion`);target.style.maxWidth='100%';for(const p of [...all.values()].slice(0,30)){const option=add('option',p.name,target);option.value=p.id;}
  const button=add('button',`Start ${type.title.toLowerCase()}`,row);button.type='button';button.disabled=!all.size||!social.traditionOptions?.[kind];button.onclick=()=>onAction(target.value,`tradition-start-${kind}`);
  if(!social.traditionOptions?.[kind])add('p',kind==='lunch'?'No dining venue is available here.':'No park is available here.',row);else if(!all.size)add('p',kind==='lunch'?'Meet another adult from the same workplace first.':'Meet another adult nearby first.',row);
 }
 add('p','Gatherings use real travel and available time. Work, care, weather or other plans can prevent attendance. Missing a tradition does not lower trust.',start);
}
