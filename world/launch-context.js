/** A single scene context menu. Picks and commands use the active World adapter. */
export function mountWorldContext(win=window){
 const doc=win.document,menu=doc.createElement('section');
 menu.className='launch-context';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','World object actions');
 Object.assign(menu.style,{position:'fixed',zIndex:300,width:'min(260px, calc(100vw - 16px))',padding:'12px',border:'1px solid #ffffff30',borderRadius:'14px',background:'#232831',color:'#f2f2ed',boxShadow:'0 12px 36px #0008'});
 doc.body.append(menu);const abort=new AbortController(),opts={signal:abort.signal};let trigger=null,rightPress=null,pendingContext=null,lastRelease=null;
 function close(){menu.hidden=true;menu.replaceChildren();}
 function text(value){const p=doc.createElement('p');p.textContent=value;menu.append(p);return p;}
 function action(label,callback){const b=doc.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;padding:8px 12px';b.addEventListener('click',async()=>{b.disabled=true;try{await callback();close();}catch(error){let status=menu.querySelector('[role=status]');if(!status){status=text('');status.setAttribute('role','status');}status.textContent=error.message||String(error);b.disabled=false;}});menu.append(b);}
 function open(event){
  if(!doc.body.classList.contains('launch-world')||!event.target.closest?.('#view canvas'))return;
  const api=win.hblWorldContext,hit=api?.pick(event);if(!hit)return;
  event.preventDefault();event.stopImmediatePropagation();close();trigger=event.target;
  const frame=win.hblWorldTileSource?.getFrame(),person=hit.kind==='person'?frame?.people?.find(p=>String(p.id)===String(hit.id)):null,building=hit.kind==='building'?frame?.buildings?.find(b=>String(b.id)===String(hit.id)):null;
  const title=doc.createElement('strong');title.textContent=person?.name??building?.name??(hit.kind==='person'?'Resident':hit.kind==='building'?'Building':'Ground');menu.append(title);
  if(hit.point&&win.hblPersonCommands?.getActor())action('Walk here',()=>win.hblPersonCommands.walkTo(hit.point));
  if(person){
   action('Talk to',()=>{win.dispatchEvent(new win.CustomEvent('hbl:resident-dialogue',{detail:{person}}));});
   action('Follow',async()=>{await win.hblWorldTileSource.selectPerson(String(person.id));const follow=frame.mode==='living'?doc.querySelector('[data-lc-follow]'):doc.getElementById('followBtn');if(!follow)throw Error('Follow is unavailable for this observation.');const following=frame.mode==='living'?follow.getAttribute('aria-pressed')==='true':follow.classList.contains('on');if(!following)follow.click();});
  }
  action('Examine',async()=>{if(person)return win.hblWorldTileSource.selectPerson(String(person.id));if(building)return win.hblWorldTileSource.selectBuilding(String(building.id));win.hblLaunchShell?.open('world');const out=doc.getElementById('launch-status');if(out)out.textContent=`Ground at ${hit.point.x.toFixed(1)}, ${hit.point.z.toFixed(1)} world metres. No lot record at this point.`;});
  if(hit.kind==='ground'&&hit.point&&api.supportsBuild!==false)action('Build here',()=>{if(!api.buildAt(event))throw Error('A build draft is unavailable at this point.');});
  action('Close',close);menu.hidden=false;
  menu.style.left=`${Math.max(8,Math.min(event.clientX,win.innerWidth-276))}px`;menu.style.top=`${Math.max(8,Math.min(event.clientY,win.innerHeight-menu.offsetHeight-8))}px`;
  menu.querySelector('button')?.focus({preventScroll:true});
 }
 function sceneEvent(event){return doc.body.classList.contains('launch-world')&&event.target.closest?.('#view canvas');}
 win.addEventListener('pointerdown',event=>{if(event.button===2&&sceneEvent(event)){rightPress={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};pendingContext=null;}},{...opts,capture:true});
 win.addEventListener('pointermove',event=>{if(rightPress?.id===event.pointerId&&Math.hypot(event.clientX-rightPress.x,event.clientY-rightPress.y)>5){rightPress.moved=true;pendingContext=null;}},{...opts,capture:true});
 win.addEventListener('pointerup',event=>{if(rightPress?.id!==event.pointerId||event.button!==2)return;event.preventDefault();const press=rightPress,request=pendingContext;rightPress=null;pendingContext=null;lastRelease={moved:press.moved,at:win.performance.now()};if(request&&!press.moved)open(request);},{...opts,capture:true});
 win.addEventListener('pointercancel',()=>{rightPress=null;pendingContext=null;},{...opts,capture:true});
 win.addEventListener('contextmenu',event=>{if(!sceneEvent(event))return;event.preventDefault();event.stopImmediatePropagation();if(rightPress){if(!rightPress.moved)pendingContext=event;return;}if(lastRelease?.moved&&win.performance.now()-lastRelease.at<250)return;open(event);},{...opts,capture:true});
 doc.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target))close();},opts);
 win.addEventListener('keydown',event=>{if(menu.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();trigger?.focus?.({preventScroll:true});}if(event.key==='Tab'){const items=[...menu.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}}},{...opts,capture:true});
 return{close,dispose(){abort.abort();menu.remove();}};
}
if(typeof window!=='undefined'){const context=mountWorldContext();window.addEventListener('pagehide',()=>context.dispose(),{once:true});}
