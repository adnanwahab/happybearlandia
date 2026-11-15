/** Lightweight directory gallery; previews never start simulations or load WebGL. */
export function mountShowcase(root,{fetcher=globalThis.fetch}={}){
 const doc=root.ownerDocument,status=root.querySelector('[data-showcase-status]'),cards=root.querySelector('[data-showcase-cards]'),form=root.querySelector('form');
 const id=form.elements.shareId,key=form.elements.ownerKey,consent=form.elements.consent,feedback=root.querySelector('[data-owner-status]');
 const fragment=new URLSearchParams(doc.defaultView.location.hash.slice(1)).get('showcase-owner');
 if(fragment){const parts=fragment.split(':');if(parts.length===2){id.value=parts[0];key.value=parts[1];}doc.defaultView.history.replaceState(null,'',doc.defaultView.location.pathname+doc.defaultView.location.search);form.closest('details').open=true;}
 let loadVersion=0;
 async function load(){
  const version=++loadVersion;
  cards.replaceChildren();status.textContent='Loading selected journeys…';
  try{const response=await fetcher('/api/reality-showcase',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.cards))throw new Error();if(version!==loadVersion)return;
   for(const card of data.cards){if(!/^[A-Za-z0-9_-]{8,16}$/.test(card.id)||card.url!==`/r/${card.id}`)continue;
    const article=doc.createElement('article');
    for(const [tag,text]of [['h3',card.title],['p',card.summary],['p',`${card.preview.engine} · ${card.preview.horizon} ${card.preview.unit} · selected seed ${card.preview.seed}`],['p',card.notice]]){const node=doc.createElement(tag);node.textContent=text;article.append(node);}
    const link=doc.createElement('a');link.href=card.url;link.textContent='Open source experiment: '+card.title;article.append(link);cards.append(article);
   }
   status.textContent=cards.children.length?'Manually selected, with submitter consent. Sources can expire or be withdrawn.':'No journeys are on display yet. Only consented, reviewed source experiments appear here.';
  }catch{if(version!==loadVersion)return;status.textContent='The journey showcase is unavailable. You can still explore the workspaces below.';}
 }
 root.querySelector('[data-showcase-retry]').addEventListener('click',load);
 form.addEventListener('submit',async event=>{event.preventDefault();const enabled=event.submitter?.value==='submit';if(enabled&&!consent.checked){feedback.textContent='Confirm ownership and public showcase consent first.';consent.focus();return;}
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);feedback.textContent='Saving your choice…';
  try{const response=await fetcher(`/api/reality-shares/${encodeURIComponent(id.value.trim())}/showcase`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.value.trim()},body:JSON.stringify({consent:enabled})});const value=await response.json();if(!response.ok)throw new Error(value.error??'Could not save your choice.');feedback.textContent=enabled?'Consent saved. Editorial review is still required; this does not publish your experiment. Keep your owner key to withdraw.':'Withdrawn from the showcase. The original shared experiment is unchanged.';if(!enabled)consent.checked=false;await load();
  }catch(error){feedback.textContent=error.message??'Showcase controls are unavailable. Please retry.';}finally{buttons.forEach(button=>button.disabled=false);}
 });
 void load();
}
