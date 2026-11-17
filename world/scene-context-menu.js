// Presentation adapter: callers own identity, picking and authoritative actions.
export function mountSceneContextMenu({canvas, resolve, readSelection, container=document.body, holdMs=550}) {
  const doc=container.ownerDocument, win=doc.defaultView;
  const menu=doc.createElement('section'), trigger=doc.createElement('button');
  menu.className='scene-context-menu'; menu.hidden=true; menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Scene object actions');
  trigger.textContent='Object actions'; trigger.className='scene-context-trigger'; trigger.type='button'; trigger.setAttribute('aria-haspopup','dialog');
  container.append(menu,trigger);
  let timer, start, consumed=false, opener, current;
  const listeners=[];
  const on=(el,type,fn,options)=>{el.addEventListener(type,fn,options);listeners.push(()=>el.removeEventListener(type,fn,options));};
  const cancel=()=>{win.clearTimeout(timer);start=null;};
  function close(restore=true){menu.hidden=true;current=null;if(restore)opener?.focus();}
  function draw(radial){
    menu.replaceChildren(); menu.dataset.layout=radial?'radial':'list';
    const title=doc.createElement('strong');title.textContent=current.label;menu.append(title);
    const actions=doc.createElement('div');actions.className='scene-context-actions';menu.append(actions);
    current.actions.forEach((action,i)=>{
      const button=doc.createElement('button');button.type='button';button.textContent=action.label;
      button.style.setProperty('--angle',`${i*360/current.actions.length}deg`);
      if(action.reason){button.setAttribute('aria-disabled','true');const reason=doc.createElement('small');reason.textContent=action.reason;button.append(reason);}
      button.onclick=()=>{if(action.reason)return;const latest=readSelection();if(latest?.key!==current.key){close();return;}close();action.run();};actions.append(button);
    });
    const toggle=doc.createElement('button');toggle.type='button';toggle.textContent=radial?'Use conventional menu':'Use pie menu';toggle.onclick=()=>{draw(!radial);menu.querySelector('button')?.focus();};menu.append(toggle);
    const dismiss=doc.createElement('button');dismiss.type='button';dismiss.textContent='Close actions';dismiss.onclick=()=>close();menu.append(dismiss);
  }
  async function open(event){
    const selection=event?await resolve(event):readSelection();if(!selection){trigger.textContent='Select an object first';return;}
    trigger.textContent='Object actions';
    current=selection;opener=doc.activeElement===doc.body?canvas:doc.activeElement;
    draw(selection.actions.length<=6&&!win.matchMedia('(prefers-reduced-motion: reduce), (max-width: 480px)').matches);
    menu.hidden=false;
    const bounds=menu.getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(event?.clientX??24,win.innerWidth-bounds.width-8))+'px';
    menu.style.top=Math.max(8,Math.min(event?.clientY??80,win.innerHeight-bounds.height-8))+'px';
    menu.querySelector('button')?.focus();
  }
  on(trigger,'click',()=>void open());
  on(canvas,'pointerdown',e=>{cancel();consumed=false;if(e.button!==0||e.isPrimary===false)return;start={id:e.pointerId,x:e.clientX,y:e.clientY};timer=win.setTimeout(()=>{consumed=true;void open(e);},holdMs);},true);
  on(canvas,'pointermove',e=>{if(start&&(e.pointerId!==start.id||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8))cancel();},true);
  on(canvas,'pointerup',e=>{cancel();if(consumed){e.preventDefault();e.stopImmediatePropagation();}},true);
  on(canvas,'click',e=>{if(consumed){e.preventDefault();e.stopImmediatePropagation();consumed=false;}},true);
  on(canvas,'pointercancel',()=>{cancel();consumed=false;},true);on(canvas,'pointerleave',cancel,true);on(win,'blur',cancel);
  on(canvas,'contextmenu',e=>{e.preventDefault();e.stopImmediatePropagation();cancel();if(!consumed)void open(e);},true);
  on(menu,'keydown',e=>{
    e.stopPropagation();const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(doc.activeElement);
    if(e.key==='Escape'){e.preventDefault();close();}
    else if(['Tab','ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(e.key)){
      e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.shiftKey||['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();
    }
  });
  on(canvas,'keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopImmediatePropagation();void open();}},true);
  on(doc,'pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==trigger)close(false);},true);
  on(win,'resize',()=>close(false));
  return {destroy(){cancel();listeners.forEach(fn=>fn());menu.remove();trigger.remove();}};
}
