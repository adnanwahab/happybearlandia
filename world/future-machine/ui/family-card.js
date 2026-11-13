import {familyIdentity,familyRecord,rankFamilies} from '../data/families.js';
export {familyIdentity,familyRecord,rankFamilies} from '../data/families.js';
export function mountFamilyCard(container,{onFollow}={}){
 const doc=container.ownerDocument,node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const shell=node('section');shell.className='fm-family';shell.setAttribute('aria-label','Follow a synthetic family');
 const label=node('label','Family · biggest rent-burden difference first '),picker=node('select');picker.setAttribute('aria-label','Family');label.append(picker);
 const follow=node('button','Follow this family');follow.type='button';follow.setAttribute('aria-pressed','false');
 const content=node('div');shell.append(node('h2','One family, two futures'),label,follow,content);container.append(shell);
 let context={},history=null,id=null,following=false,rank=[];
 picker.onchange=()=>{id=picker.value;render();if(following)onFollow?.(id);};
 follow.onclick=()=>{following=!following;follow.setAttribute('aria-pressed',String(following));follow.textContent=following?'Stop following':'Follow this family';onFollow?.(following?id:null);};
 function render(){
  content.replaceChildren();const seed=history?.seed??context.provenance?.seed;
  if(!id){content.append(node('p','No recorded households available.'));return;}
  const identity=familyIdentity(seed,id),title=node('h3',identity.name),avatar=node('span');
  avatar.className='fm-family-avatar';avatar.setAttribute('role','img');avatar.setAttribute('aria-label',`Synthetic avatar for ${identity.name}`);avatar.style.background=`hsl(${identity.hue} 45% 32%)`;avatar.textContent=['◕ ‿ ◕','• ◡ •','◕ ◡ ◕'][identity.hair];title.prepend(avatar);content.append(title,node('p',`Synthetic name and avatar · ${id} · Run ${history?.experimentId??'preview'} · Seed ${seed??'unavailable'} · Model ${history?.modelVersion??context.provenance?.modelVersion??'unavailable'}`));
  const grid=node('div');grid.className='fm-family-pair';content.append(grid);
  for(const [arm,name] of [['baseline','WITHOUT PLAN'],['plan','WITH PLAN']]){
   const snapshot=context.frame?.[arm],record=familyRecord(snapshot,id),v=record.observation;
   const card=node('article');card.append(node('h4',name));const raw=node('details'),rawId=`fm-family-${arm}-record`;raw.id=rawId;
   const link=(text)=>{const a=node('a',text);a.href=`#${rawId}`;a.onclick=()=>{raw.open=true;raw.querySelector('pre').textContent=JSON.stringify({run:history?.experimentId,seed,model:history?.modelVersion,month:context.month,arm,...record},null,2);};return a;};
   card.append(link(`Month ${context.month} · ${record.household?.size??'Unavailable'} people`));
   const gauge=node('meter');gauge.min=0;gauge.max=1;gauge.low=.3;gauge.high=.5;gauge.optimum=0;gauge.value=v.burden??0;gauge.hidden=v.burden===null;gauge.setAttribute('aria-label',`${name} rent divided by income`);card.append(gauge,link(v.burden===null?'Rent burden unavailable':`${(v.burden*100).toFixed(2)}% rent burden`));
   const start=familyRecord(history?.[arm]?.find(s=>s?.month===0),id);const moved=start.unit&&record.unit?(start.unit.id===record.unit.id?'Stayed in starting home':'Moved from starting home'):'Move status unavailable';
   const home=node('p',`⌂ ${record.unit?.id??'Home unavailable'} `),badge=node('span',moved);badge.className='fm-family-home-status';home.append(badge);card.append(home);
   for(const [key,units] of [['income','USD/month income'],['rent','USD/month rent'],['savings','USD savings']])card.append(link(`${v[key]??'Unavailable'} ${units}`));
   const series=node('div');series.className='fm-family-spark';series.setAttribute('aria-label',`${name} monthly rent burden; select a point for its exact records`);
   for(const s of history?.[arm]??[]){if(!s||s.month>context.month)continue;const r=familyRecord(s,id),burden=r.observation.burden;if(burden===null){series.append(node('span','·'));continue;}
    const point=node('button');point.type='button';point.title=`Month ${s.month}: ${burden*100}% rent burden`;point.setAttribute('aria-label',point.title);point.style.height=`${Math.max(2,Math.min(1,burden)*44)}px`;point.onclick=()=>{raw.open=true;raw.querySelector('pre').textContent=JSON.stringify({run:history.experimentId,seed,model:history.modelVersion,month:s.month,arm,...r},null,2);raw.scrollIntoView({block:'nearest'});};series.append(point);
   }
   card.append(series);raw.append(node('summary','Exact household, unit and building records'),node('pre',JSON.stringify({run:history?.experimentId,seed,model:history?.modelVersion,month:context.month,arm,...record},null,2)));card.append(raw);grid.append(card);
  }
  content.append(node('p','Synthetic modeled observations. Burden = exact occupied-unit rent / positive household income. Bars show recorded months through the selected month (visual scale capped at 100%); gaps are unavailable. Ranking uses the largest absolute matched monthly burden difference across this run. No occupation or cross-model identity is inferred.'));
 }
 return {update(next){context=next;const incoming=next.familyHistory??null;if(incoming!==history){history=incoming;rank=rankFamilies(history);id=rank.some(r=>r.id===id)?id:rank[0]?.id??null;picker.replaceChildren();for(const r of rank){const option=node('option',`${familyIdentity(history?.seed,r.id).name} · synthetic · ${r.id}`);option.value=r.id;picker.append(option);}picker.value=id??'';if(following)onFollow?.(id);}picker.disabled=follow.disabled=!id;render();},dispose(){onFollow?.(null);picker.onchange=follow.onclick=null;shell.remove();}};
}
