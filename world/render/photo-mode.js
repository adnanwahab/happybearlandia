// Presentation only: this module receives no simulation authority or checkpoint.
export function sceneReceipt(mode, golden) {
  return `World scene · ${mode === 'canvas2d' ? 'low-fidelity projected bounds' : 'rendered geometry'} · run ID / seed / modeled date / source unavailable${golden ? ' · golden-hour cosmetic filter' : ''}`;
}

export function mountPhotoMode({canvas,camera,controls,mode,embed=false}) {
  let saved=null,pending=false,disposed=false,generation=0;
  const urls=new Set(),timers=new Set();
  const style=document.createElement('style');
  style.textContent=`body.hbl-photo > :not(#view):not([data-photo-ui]):not(style):not(script){visibility:hidden!important}body.hbl-photo [data-photo-ui]{visibility:visible!important}[data-photo-ui]{position:fixed;z-index:1000;background:#14232f;color:white;border:1px solid #7593a8;border-radius:10px;padding:10px;font:14px system-ui}button[data-photo-ui]{right:12px;bottom:64px}[data-photo-panel]{right:12px;bottom:12px;max-width:min(460px,calc(100vw - 48px));max-height:65vh;overflow:auto}[data-photo-panel] button,[data-photo-panel] label{display:inline-block;margin:4px;min-height:44px}[data-photo-panel] button{min-width:44px}[data-photo-panel] p{margin:6px 0}`;
  const open=document.createElement('button');open.dataset.photoUi='';open.textContent='Photo';open.setAttribute('aria-label','Open photo mode');
  const panel=document.createElement('section');panel.dataset.photoUi='';panel.dataset.photoPanel='';panel.hidden=true;panel.setAttribute('aria-label','Photo mode');
  panel.innerHTML='<strong>Photo mode</strong><p>Drag to orbit · pinch/scroll to zoom. Frame with the buttons. Escape exits.</p><label><input type="checkbox" data-golden> Golden hour (cosmetic)</label><label><input type="checkbox" data-receipt> Include scene receipt</label><p data-facts></p><div><button data-pan="-1,0" aria-label="Frame left">←</button><button data-pan="1,0" aria-label="Frame right">→</button><button data-pan="0,1" aria-label="Frame up">↑</button><button data-pan="0,-1" aria-label="Frame down">↓</button><button data-zoom="0.8" aria-label="Zoom in">+</button><button data-zoom="1.25" aria-label="Zoom out">−</button></div><button data-save>Save PNG</button><button data-exit>Exit photo mode</button><p role="status"></p>';
  const golden=panel.querySelector('[data-golden]'),receipt=panel.querySelector('[data-receipt]'),status=panel.querySelector('[role=status]'),save=panel.querySelector('[data-save]');
  const facts=()=>{panel.querySelector('[data-facts]').textContent=sceneReceipt(mode,golden.checked);};facts();
  const filter=()=>{canvas.style.filter=golden.checked?'sepia(0.25) saturate(1.15) brightness(1.05)':'';facts();};golden.onchange=filter;
  function exit(){if(!saved)return;generation++;pending=false;save.disabled=false;camera.position.copy(saved.position);controls.target.copy(saved.target);controls.enableDamping=saved.damping;controls.update();canvas.style.filter=saved.filter;document.body.classList.remove('hbl-photo');panel.hidden=true;const focus=saved.focus;saved=null;if(focus?.isConnected)focus.focus();}
  function enter(){if(disposed||saved)return;saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,filter:canvas.style.filter,focus:document.activeElement};controls.enableDamping=false;golden.checked=false;receipt.checked=false;filter();document.body.classList.add('hbl-photo');panel.hidden=false;status.textContent='PNG contains scene pixels only; no page text or personal metadata is added.';save.focus();}
  open.onclick=enter;panel.querySelector('[data-exit]').onclick=exit;
  for(const button of panel.querySelectorAll('[data-pan]'))button.onclick=()=>{const [x,y]=button.dataset.pan.split(',').map(Number),distance=camera.position.distanceTo(controls.target)*.08;const shift=controls.target.clone().set(x*distance,y*distance,0).applyQuaternion(camera.quaternion);camera.position.add(shift);controls.target.add(shift);controls.update();};
  for(const button of panel.querySelectorAll('[data-zoom]'))button.onclick=()=>{camera.position.sub(controls.target).multiplyScalar(Number(button.dataset.zoom)).add(controls.target);controls.update();};
  save.onclick=()=>{if(!saved||pending)return;pending=true;save.disabled=true;status.textContent='Capturing next rendered frame…';};
  function key(event){if(!saved)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();exit();}else if(event.key==='Tab'){const items=[...panel.querySelectorAll('button,input')].filter(el=>!el.disabled),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
  const release=event=>{if(saved)event.preventDefault();};
  canvas.addEventListener('pointerup',release,true);
  addEventListener('keydown',key,true);
  if(!embed)document.body.append(style,open,panel);
  return {enter,exit,get active(){return !!saved;},afterFrame(){
    if(!pending||disposed||!saved)return;pending=false;const token=generation;
    try{
      if(!canvas.width||!canvas.height)throw Error('Scene is empty.');
      const output=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(canvas.width,canvas.height));output.width=Math.round(canvas.width*scale);output.height=Math.round(canvas.height*scale);
      const ctx=output.getContext('2d');if(!ctx)throw Error('PNG capture unavailable.');ctx.filter=canvas.style.filter||'none';ctx.drawImage(canvas,0,0,output.width,output.height);ctx.filter='none';
      if(receipt.checked){
        ctx.font='12px system-ui';const lines=[];let line='';
        for(const word of sceneReceipt(mode,golden.checked).split(' ')){if(line&&ctx.measureText(line+word).width>output.width-24){lines.push(line);line='';}line+=word+' ';}lines.push(line);
        const height=lines.length*16+20;ctx.fillStyle='#10202fe8';ctx.fillRect(0,output.height-height,output.width,height);ctx.fillStyle='white';lines.forEach((text,i)=>ctx.fillText(text,12,output.height-height+22+i*16));
      }
      output.toBlob(blob=>{if(disposed||!saved||generation!==token)return;save.disabled=false;if(!blob){status.textContent='PNG capture unavailable. Try another renderer.';return;}const url=URL.createObjectURL(blob);urls.add(url);const link=document.createElement('a');link.href=url;link.download='world-postcard.png';link.click();status.textContent='PNG saved locally.';const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);timers.delete(timer);},1000);timers.add(timer);},'image/png');
    }catch(error){save.disabled=false;status.textContent='Could not save PNG: '+error.message;}
  },destroy(){if(disposed)return;exit();disposed=true;generation++;removeEventListener('keydown',key,true);canvas.removeEventListener('pointerup',release,true);for(const url of urls)URL.revokeObjectURL(url);urls.clear();for(const timer of timers)clearTimeout(timer);timers.clear();style.remove();open.remove();panel.remove();}};
}
