import { FACILITIES, destination, annotationKey } from './facilities.js';
const facility = FACILITIES.find(f => location.pathname.replace(/\/$/,'').replace(/\.html$/,'') === f.route.replace(/\/$/,''));
if (facility) {
 const host=document.createElement('aside');
 host.style.cssText='position:fixed;bottom:12px;right:12px;z-index:10000;max-width:320px;color:#eee;background:#15212bed;border:1px solid #657885;border-radius:12px;padding:10px;font:13px system-ui';
 const root=host.attachShadow({mode:'open'});
 const details=document.createElement('details');
 const summary=document.createElement('summary'); summary.textContent=facility.label; details.append(summary);
 const evidence=document.createElement('p'); evidence.textContent=facility.evidence+'. Cultural activity does not change the economy.'; details.append(evidence);
 const context=new URLSearchParams(location.search);
 const scope=document.createElement('p');scope.textContent='Facility: '+facility.id+(context.get('entityId')?' • Linked entity: '+context.get('entityId'):' • No world entity selected');details.append(scope);
 for(const f of FACILITIES){const a=document.createElement('a');a.textContent=f.label;a.href=destination(f.route,location.search);a.style.cssText='display:block;color:#aee2ff;margin:6px 0';details.append(a);}
 const back=document.createElement('a');back.textContent='Return to World';back.href=destination('/world',location.search);back.style.color='#aee2ff';details.append(back);
 const label=document.createElement('label');label.textContent=facility.experienceId==='lumen'?'Building/design annotation (interpretation)':'Character/story or collection note (fictional interpretation)';label.style.display='block';
 const note=document.createElement('textarea');note.maxLength=4000;note.style.cssText='width:95%;min-height:65px';label.append(note);details.append(label);
 const status=document.createElement('p');details.append(status);
 const key=annotationKey(facility.id,location.search);
 try{note.value=localStorage.getItem(key)||'';}catch{status.textContent='Local storage unavailable';}
 note.addEventListener('change',()=>{try{localStorage.setItem(key,note.value);status.textContent='Saved on this browser for this facility and context';}catch{status.textContent='Could not save locally';}});
 root.append(details);document.body.append(host);
}
