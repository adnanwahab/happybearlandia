/** Ground gesture UI. resolveGround owns world geometry; wishes remain drafts. */
export function mountGroundWish({canvas,container,resolveGround,onWish}) {
  const doc=container.ownerDocument,win=doc.defaultView;
  const bubble=doc.createElement('form');bubble.className='bw-ground-wish';bubble.hidden=true;
  bubble.innerHTML='<label>What should go here?<textarea aria-label="What should go here?" maxlength="4000" required placeholder="Build a 24-story, 310-unit apartment tower here"></textarea></label><button type="submit">Review wish</button><button type="button" data-cancel>Cancel</button><small>Preview first. You approve the accepted changes.</small>';
  container.append(bubble);
  let location=null,press=null,timer=null,held=false;
  const cancelPress=()=>{clearTimeout(timer);timer=null;press=null};
  const close=()=>{bubble.hidden=true;location=null;cancelPress()};
  function open(event){const ground=resolveGround(event);if(!ground)return false;location=ground;bubble.hidden=false;bubble.style.left=`${Math.max(8,Math.min(event.clientX,win.innerWidth-320))}px`;bubble.style.top=`${Math.max(8,Math.min(event.clientY,win.innerHeight-220))}px`;bubble.querySelector('textarea').focus();return true}
  const context=event=>{if(open(event)){event.preventDefault();event.stopImmediatePropagation()}};
  const down=event=>{held=false;if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;cancelPress();press={x:event.clientX,y:event.clientY,id:event.pointerId};timer=setTimeout(()=>{held=open(event);cancelPress()},600)};
  const move=event=>{if(press&&(event.pointerId!==press.id||Math.hypot(event.clientX-press.x,event.clientY-press.y)>8))cancelPress()};
  const up=event=>{cancelPress();if(held){event.preventDefault();event.stopImmediatePropagation();held=false}};
  const key=event=>{if(event.key==='Escape'&&!bubble.hidden){close();canvas.focus?.()}};
  const submit=event=>{event.preventDefault();const prompt=bubble.querySelector('textarea').value.trim();if(!location||!prompt)return;onWish({prompt,location:{...location}});close()};
  const listeners=[[canvas,'contextmenu',context],[canvas,'pointerdown',down],[canvas,'pointermove',move],[canvas,'pointerup',up],[canvas,'pointercancel',cancelPress],[win,'keydown',key],[bubble,'submit',submit],[bubble.querySelector('[data-cancel]'),'click',close]];
  for(const [node,type,handler] of listeners)node.addEventListener(type,handler,true);
  return {open,close,destroy(){cancelPress();for(const [node,type,handler] of listeners)node.removeEventListener(type,handler,true);bubble.remove()}};
}
