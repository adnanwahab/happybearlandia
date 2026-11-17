/** Three raycasters can return hidden meshes: check the full render ancestry. */
export function isRenderedHit(hit){
 for(let node=hit?.object;node;node=node.parent)if(node.visible===false)return false;
 const material=Array.isArray(hit?.object?.material)?hit.object.material[hit.face?.materialIndex??0]:hit?.object?.material;
 return !!hit&&material?.visible!==false&&!(material?.transparent&&material.opacity===0);
}
/** CSS-pixel ranking of frontmost visible hits. The host owns ray/occlusion policy.
 * Sampling is bounded (49 rays); it approximates silhouettes, never model positions.
 */
export function rankScreenTargets({x,y,rect,hitAt,radius=24}) {
  const found=new Map();
  for(const r of radius>0?[0,radius/3,2*radius/3,radius]:[0]) {
    for(let i=0;i<(r?16:1);i++) {
      const angle=i*Math.PI/8,px=x+r*Math.cos(angle),py=y+r*Math.sin(angle);
      if(px<rect.left||py<rect.top||px>=rect.right||py>=rect.bottom)continue;
      const hit=hitAt(px,py);
      if(!hit||hit.visible===false)continue;
      const score=Math.hypot(px-x,py-y),old=found.get(hit.key);
      if(!old||score<old.score)found.set(hit.key,{...hit,score,x:px,y:py});
    }
  }
  const ranked=[...found.values()].sort((a,b)=>a.score-b.score||String(a.key).localeCompare(String(b.key)));
  return {ranked,choices:ranked.filter(hit=>hit.score<=ranked[0].score+3)};
}

/** Native dialog/buttons provide touch, Tab, Enter and Escape without animation. */
export function mountPickPreview(canvas,{rank,onPick,enabled=()=>true}) {
  const doc=canvas.ownerDocument;
  const marker=doc.createElement('div');marker.dataset.pickPreview='';marker.hidden=true;
  marker.style.cssText='position:fixed;pointer-events:none;z-index:90;border:3px solid #ffe184;border-radius:50%;width:28px;height:28px;box-sizing:border-box;background:#ffe18433';
  const dialog=doc.createElement('dialog');dialog.setAttribute('aria-label','Choose city entity');
  dialog.style.cssText='max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;background:#18242e;color:white;border:2px solid #ffe184;border-radius:12px';
  doc.body.append(marker,dialog);
  canvas.tabIndex=0;canvas.setAttribute('aria-label','City scene. Press Enter to inspect near the center; Tab through choices.');
  let last=0;
  function clear(){marker.hidden=true;}
  function preview(event){if(!enabled()||event.buttons){clear();return;}if(performance.now()-last<100)return;last=performance.now();const hit=rank(event.clientX,event.clientY).ranked[0];marker.hidden=!hit;if(hit){marker.style.left=`${hit.x-14}px`;marker.style.top=`${hit.y-14}px`;}}
  const press=event=>{if(event.button===0)preview({clientX:event.clientX,clientY:event.clientY,buttons:0});};
  function choose(x,y){clear();const result=rank(x,y);if(!result.ranked.length)return false;if(result.choices.length===1){onPick(result.choices[0]);return true;}
    dialog.replaceChildren();const title=doc.createElement('p');title.textContent='Nearby entities — choose one';dialog.append(title);
    for(const hit of result.choices){const button=doc.createElement('button');button.textContent=hit.label;button.style.cssText='display:block;min-height:44px;min-width:44px;margin:8px';button.onclick=()=>{const current=enabled()&&rank(x,y).ranked.find(value=>value.key===hit.key);dialog.close();if(current)onPick(current);};dialog.append(button);}
    const cancel=doc.createElement('button');cancel.textContent='Cancel';cancel.style.minHeight='44px';cancel.onclick=()=>dialog.close();dialog.append(cancel);dialog.showModal();return true;
  }
  const key=event=>{if(enabled()&&['Enter',' '].includes(event.key)){event.preventDefault();const r=canvas.getBoundingClientRect();choose(r.left+r.width/2,r.top+r.height/2);}};
  const restore=()=>canvas.focus({preventScroll:true});dialog.addEventListener('close',restore);dialog.addEventListener('keydown',event=>event.stopPropagation());
  canvas.addEventListener('pointermove',preview);canvas.addEventListener('pointerleave',clear);canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointercancel',clear);canvas.addEventListener('keydown',key);
  return {choose,clear,destroy(){canvas.removeEventListener('pointermove',preview);canvas.removeEventListener('pointerleave',clear);canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointercancel',clear);canvas.removeEventListener('keydown',key);dialog.remove();marker.remove();}};
}
