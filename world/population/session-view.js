import {createDecisionSession} from './session.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountSessionView({container,session:provided,getViewpoint,onFollowViewpoint,onExperimentTask}={}){
 if(!container?.ownerDocument)throw new TypeError('Session view requires a container.');
 const doc=container.ownerDocument,session=provided||createDecisionSession(),root=doc.createElement('details');root.className='living-session';root.dataset.testid='living-session';
 root.innerHTML='<summary>Decision session · local tabs</summary><div class="ls-body"><p data-scope></p><p>Shared views and notes are local to this browser origin. No account or cross-device connection.</p><button data-present>Present this tab</button><label><input type="checkbox" data-follow> Follow presenter</label><button data-share-view>Share current view</button><div data-participants></div><form data-note><label>Pin kind <select name="kind"><option>building</option><option>district</option><option>road</option><option>future</option><option>assumption</option></select></label><label>Target ID <input name="target" required maxlength="160"></label><label>Annotation <textarea name="text" required maxlength="1000"></textarea></label><button>Pin annotation</button></form><form data-question><label>Behavioral question <textarea name="text" required maxlength="1000"></textarea></label><button>Queue question</button></form><div data-questions></div><div data-annotations></div><button data-export>Export replay</button><label>Import replay <input data-import type="file" accept="application/json,.json"></label><button data-replay>Read session replay</button><ol data-replay-list></ol><p role="status"></p></div>';
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./session.css',import.meta.url).href;container.append(sheet,root);
 let destroyed=false;const status=root.querySelector('[role=status]');
 function render(state=session.getState()){
  root.querySelector('[data-scope]').textContent=`${state.scope} · ${state.events.length} retained events${state.dropped?` · ${state.dropped} older events dropped`:''}`;
  root.querySelector('[data-follow]').checked=state.following;
  root.querySelector('[data-participants]').innerHTML=`<strong>${state.presenter?`Presenter ${escape(state.presenter)}`:'No presenter selected'}</strong><ul>${state.participants.map(p=>`<li>${escape(p.actor)} · view target ${p.viewpoint.target.map(n=>n.toFixed(0)).join(', ')} · ${Math.max(0,Math.floor((Date.now()-p.at)/1000))}s ago</li>`).join('')}</ul>`;
  root.querySelector('[data-questions]').innerHTML=`<h3>Questions → proposed experiment tasks</h3>${state.questions.map(q=>`<p>${escape(q.payload.text)} <button data-task="${escape(q.id)}">Propose experiment task</button></p>`).join('')}<p>${state.tasks.length} proposed tasks · approval required before running</p>`;
  root.querySelector('[data-annotations]').innerHTML=`<h3>Pinned annotations</h3><ul>${state.annotations.map(a=>`<li>${escape(a.payload.target.kind)} ${escape(a.payload.target.id)}: ${escape(a.payload.text)}</li>`).join('')}</ul>`;
 }
 const unsubscribe=session.subscribe(({state,event,live})=>{
  render(state);
  if(live&&event?.type==='viewpoint'&&state.following&&event.actor===state.presenter&&event.actor!==state.clientId)onFollowViewpoint?.(event.payload,event);
 });
 function report(error){status.textContent=error?.message||String(error);}
 function click(event){try{
  if(event.target.closest('[data-present]')){session.present();status.textContent='This tab is presenter. Other tabs must choose Follow presenter.';}
  if(event.target.closest('[data-share-view]')){const view=getViewpoint?.();if(!view)throw new Error('Current world camera is unavailable.');session.publishViewpoint(view);}
  const taskButton=event.target.closest('[data-task]');if(taskButton){const task=session.createExperimentTask(taskButton.dataset.task);onExperimentTask?.({...task.payload,id:task.id});status.textContent='Experiment task proposed. Review and approval are still required.';}
  if(event.target.closest('[data-export]')){const url=URL.createObjectURL(new Blob([JSON.stringify(session.export(),null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download='hbl-local-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(event.target.closest('[data-replay]')){const list=root.querySelector('[data-replay-list]');list.replaceChildren();session.replay(e=>{const li=doc.createElement('li');li.textContent=`${e.type} · ${e.actor} · ${e.payload.text||e.payload.label||JSON.stringify(e.payload)}`;list.append(li);});status.textContent='Read-only replay. No edits, simulations or approvals were applied.';}
 }catch(error){report(error);}}
 function submit(event){const form=event.target;if(!form.matches('[data-note],[data-question]'))return;event.preventDefault();try{const data=new FormData(form);if(form.matches('[data-note]'))session.annotate({kind:data.get('kind'),id:data.get('target')},data.get('text'));else session.ask(data.get('text'));form.reset();status.textContent='Saved to the bounded local session log.';}catch(error){report(error);}}
 async function change(event){try{if(event.target.matches('[data-follow]'))session.setFollowing(event.target.checked);if(event.target.matches('[data-import]')){const file=event.target.files?.[0];if(!file)return;if(file.size>600*1024)throw new Error('Replay exceeds 600 KiB.');session.import(await file.text());status.textContent='Imported read-only history; no world state was changed.';event.target.value='';}}catch(error){report(error);}}
 root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('change',change);render();
 return{update(context={}){if(destroyed)return;const view=context.viewpoint;if(view)session.publishViewpoint(view);},destroy(){if(destroyed)return;destroyed=true;unsubscribe();root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('change',change);root.remove();sheet.remove();if(!provided)session.destroy();}};
}
