/** Presentation-only input; host calls update in its existing frame loop. */
export function joystickVector(dx,dy,radius=38){
 if(![dx,dy,radius].every(Number.isFinite)||radius<=0)return {x:0,y:0};
 const length=Math.hypot(dx,dy);if(length<5)return {x:0,y:0};
 const scale=Math.max(radius,length);return {x:dx/scale,y:dy/scale};
}
export function mountMobileExplorer({container,settingsContainer=container,onMove,onInspect,available=()=>true,blocked=()=>false}){
 const doc=container.ownerDocument,win=doc.defaultView,listeners=[];
 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./mobile-explorer.css',import.meta.url).href;
 const settings=doc.createElement('details');settings.id='mobile-explorer-settings';settings.setAttribute('data-map-pan-ignore','');
 settings.innerHTML='<summary>Touch explorer</summary><label><input data-enable type="checkbox"> Show thumb controls</label><label>Hand <select aria-label="Explorer hand"><option value="right">Right</option><option value="left">Left</option></select></label><label>Sensitivity <input aria-label="Explorer sensitivity" type="range" min="0.25" max="3" step="0.25" value="1"></label><p>Drag Move controls to reposition. Drag the pad to pan north/east/south/west, or use arrow keys. Inspect uses the scene center. Settings last for this page.</p>';
 const root=doc.createElement('section');root.id='mobile-explorer';root.setAttribute('aria-label','Thumb city explorer');root.setAttribute('data-map-pan-ignore','');
 root.innerHTML='<button type="button" data-drag aria-label="Move thumb controls">Move controls</button><div class="thumb-row"><div data-stick tabindex="0" role="group" aria-label="Pan city. Use arrow keys or drag."><span aria-hidden="true">✥</span></div><div class="thumb-actions"><button type="button" data-inspect>Inspect center</button><button type="button" data-zoom="1" aria-label="Zoom in">+</button><button type="button" data-zoom="-1" aria-label="Zoom out">−</button></div></div><output aria-live="polite"></output>';
 settingsContainer.append(settings);container.append(sheet,root);
 const enable=settings.querySelector('[data-enable]'),hand=settings.querySelector('select'),sensitivity=settings.querySelector('input[type="range"]'),stick=root.querySelector('[data-stick]'),knob=stick.firstElementChild,output=root.querySelector('output');
 enable.checked=win.matchMedia?.('(pointer: coarse)').matches??false;
 let vector={x:0,y:0},pointer=null,drag=null,last=null,destroyed=false;
 const clear=()=>{vector={x:0,y:0};pointer=null;drag=null;last=null;knob.style.transform='';};
 const allowed=()=>enable.checked&&available()&&!blocked()&&doc.visibilityState!=='hidden'&&doc.hasFocus();
 function clampPosition(x,y){const r=root.getBoundingClientRect();root.style.left=`${Math.max(8,Math.min(x,win.innerWidth-r.width-8))}px`;root.style.top=`${Math.max(8,Math.min(y,win.innerHeight-r.height-8))}px`;root.style.right='auto';root.style.bottom='auto';}
 function place(){root.style.left=hand.value==='left'?'max(8px, env(safe-area-inset-left))':'auto';root.style.right=hand.value==='right'?'max(8px, env(safe-area-inset-right))':'auto';root.style.top='auto';root.style.bottom='max(8px, env(safe-area-inset-bottom))';clear();}
 listen(enable,'change',()=>{clear();refresh();});listen(hand,'change',place);listen(sensitivity,'input',clear);
 listen(stick,'pointerdown',event=>{if(!allowed()||pointer!==null||event.button!==0)return;event.preventDefault();clear();pointer={id:event.pointerId,x:event.clientX,y:event.clientY};stick.setPointerCapture(event.pointerId);});
 listen(stick,'pointermove',event=>{if(pointer?.id!==event.pointerId)return;event.preventDefault();vector=joystickVector(event.clientX-pointer.x,event.clientY-pointer.y);knob.style.transform=`translate(${vector.x*30}px,${vector.y*30}px)`;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,event=>{if(event.pointerId===pointer?.id)clear();});
 const handle=root.querySelector('[data-drag]');
 listen(handle,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();clear();const r=root.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX-r.left,y:event.clientY-r.top};handle.setPointerCapture(event.pointerId);});
 listen(handle,'pointermove',event=>{if(drag?.id===event.pointerId){event.preventDefault();clampPosition(event.clientX-drag.x,event.clientY-drag.y);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(handle,type,clear);
 listen(handle,'keydown',event=>{const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];if(delta){event.preventDefault();const r=root.getBoundingClientRect();clampPosition(r.left+delta[0],r.top+delta[1]);}});
 listen(stick,'keydown',event=>{const v={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(v&&allowed()){event.preventDefault();onMove({x:v[0],y:v[1],rx:0,ry:0,zoom:0,dt:.08*Number(sensitivity.value)});}});
 listen(root.querySelector('[data-inspect]'),'click',()=>{clear();if(!allowed())return;const result=onInspect?.();output.textContent=result===false?'No inspectable entity at center.':'Inspecting scene center.';refresh();});
 for(const button of root.querySelectorAll('[data-zoom]'))listen(button,'click',()=>{clear();if(allowed())onMove({x:0,y:0,rx:0,ry:0,zoom:Number(button.dataset.zoom),dt:.18*Number(sensitivity.value)});});
 listen(win,'blur',clear);listen(doc,'visibilitychange',clear);listen(win,'resize',()=>{clear();if(root.style.top!=='auto'){const r=root.getBoundingClientRect();clampPosition(r.left,r.top);}});
 listen(win,'keydown',event=>{if(event.key==='Escape')clear();});
 function refresh(){const show=enable.checked&&!blocked(),ready=available();root.hidden=!show;stick.setAttribute('aria-disabled',String(!ready));for(const button of root.querySelectorAll('button'))button.disabled=!ready;if(!show||!ready)clear();}
 place();refresh();
 return {update(now,{enabled=true}={}){if(destroyed)return;refresh();if(!enabled||!allowed()){clear();return;}const dt=last===null?0:Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(dt&&(vector.x||vector.y))onMove({...vector,rx:0,ry:0,zoom:0,dt:dt*Number(sensitivity.value)});},destroy(){destroyed=true;clear();for(const off of listeners)off();root.remove();settings.remove();sheet.remove();}};
}
