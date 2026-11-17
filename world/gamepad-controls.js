/** Presentation-only standard Gamepad adapter. Poll from the host frame loop. */
export function axis(value,deadzone=.18){return Number.isFinite(value)&&Math.abs(value)>deadzone?Math.sign(value)*Math.min(1,(Math.abs(value)-deadzone)/(1-deadzone)):0;}
export function createGamepadInput({read,onMove=()=>{},onAction=()=>{}}){
 let last=null,held=new Set(),padIndex=null,armed=false;
 return {reset(){last=null;held.clear();padIndex=null;armed=false;},update(now,{enabled=true,deadzone=.18,bindings={accept:0,back:1,inspect:2,menu:3,tour:9}}={}){
  let pads;try{pads=read?.()??[];}catch{pads=[];}
  const pad=Array.from(pads).find(p=>p?.connected&&p.mapping==='standard');
  if(!enabled||!pad){this.reset();return false;}
  const down=new Set(pad.buttons.flatMap((b,i)=>b?.pressed?[i]:[]));
  const values=pad.axes.slice(0,4).map(v=>axis(v,deadzone));
  if(padIndex!==pad.index){this.reset();padIndex=pad.index;held=down;}
  // Require neutral after connection, focus loss or controller replacement.
  if(!armed){armed=!down.size&&values.every(v=>v===0)&&![6,7].some(i=>(pad.buttons[i]?.value??0)>.1);last=now;held=down;return true;}
  const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  onMove({x:values[0]??0,y:values[1]??0,rx:values[2]??0,ry:values[3]??0,zoom:(pad.buttons[7]?.value??0)-(pad.buttons[6]?.value??0),dt});
  for(const [action,index] of Object.entries({...bindings,up:12,down:13,left:14,right:15}))if(down.has(index)&&!held.has(index))onAction(action);
  held=down;return true;
 }};
}
export function mountGamepadControls({container,canvas,onMove,onInspect,onMenu,onTour}){
 const doc=container.ownerDocument,win=doc.defaultView,root=doc.createElement('details');root.id='gamepad-controls';root.setAttribute('data-map-pan-ignore','');
 root.innerHTML='<summary>Controller</summary><label><input type="checkbox" data-enabled> Enable controller</label><p role="status" data-status>Controller off. Keyboard and touch remain available.</p><p>Standard pad: left stick pan · right stick orbit · triggers zoom · D-pad focus · A activate · B cancel · X inspect center · Y actions · Start tour. Release controls after connecting or returning to the window.</p><label>Deadzone <input data-deadzone type="range" min="0.05" max="0.5" step="0.01" value="0.18"></label><fieldset><legend>Button mapping (standard indices)</legend></fieldset>';
 const field=root.querySelector('fieldset'),bindings={accept:0,back:1,inspect:2,menu:3,tour:9};
 for(const action of Object.keys(bindings)){const label=doc.createElement('label');label.textContent=action+' ';const select=doc.createElement('select');select.setAttribute('aria-label',action+' button');for(let i=0;i<12;i++){const option=doc.createElement('option');option.value=i;option.textContent=String(i);select.append(option);}select.value=bindings[action];select.onchange=()=>{bindings[action]=Number(select.value);input.reset();};label.append(select);field.append(label);}
 container.append(root);const enabled=root.querySelector('[data-enabled]'),status=root.querySelector('[data-status]');let focused=doc.hasFocus(),destroyed=false;
 const visibleControls=()=>{const dialog=[...doc.querySelectorAll('[role="dialog"],dialog[open]')].find(e=>e.getClientRects().length);return [...(dialog??doc).querySelectorAll('button,input,select,summary,a[href],[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length&&!e.closest('[inert]'));};
 function action(name){
  const active=doc.activeElement;
  if(['up','down','left','right'].includes(name)){const list=visibleControls();if(!list.length)return;const i=list.indexOf(active),step=['up','left'].includes(name)?-1:1;list[(i+step+list.length)%list.length].focus();return;}
  if(name==='accept'){if(active?.matches('select')){active.selectedIndex=(active.selectedIndex+1)%active.options.length;active.dispatchEvent(new win.Event('change',{bubbles:true}));}else active?.click?.();}
  if(name==='back'){doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));active?.blur?.();canvas.focus();}
  if(name==='inspect')onInspect?.();if(name==='menu')onMenu?.();if(name==='tour')onTour?.();
 }
 const input=createGamepadInput({read:()=>win.navigator.getGamepads?.(),onAction:action,onMove:value=>{if(doc.activeElement?.matches('input,select,textarea')||doc.querySelector('[role="dialog"]:not([hidden])'))return;onMove?.(value);}});
 const reset=()=>input.reset(),blur=()=>{focused=false;reset();},focus=()=>{focused=true;reset();};
 win.addEventListener('blur',blur);win.addEventListener('focus',focus);win.addEventListener('gamepaddisconnected',reset);doc.addEventListener('visibilitychange',reset);enabled.onchange=reset;
 return {update(now){if(destroyed)return;const available=typeof win.navigator.getGamepads==='function';const connected=input.update(now,{enabled:enabled.checked&&focused&&doc.visibilityState!=='hidden',deadzone:Number(root.querySelector('[data-deadzone]').value),bindings});const text=!available?'Gamepad API unavailable. Use keyboard or touch.':!enabled.checked?'Controller off. Keyboard and touch remain available.':connected?'Standard controller connected.':'No standard controller detected. Use keyboard or touch.';if(status.textContent!==text)status.textContent=text;},destroy(){destroyed=true;reset();win.removeEventListener('blur',blur);win.removeEventListener('focus',focus);win.removeEventListener('gamepaddisconnected',reset);doc.removeEventListener('visibilitychange',reset);root.remove();}};
}
