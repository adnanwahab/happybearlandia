/** Presentation-only selection overlay. A target must resolve from the current
 * sample on every update AND activation. Coordinates use canvas client bounds. */
export function projectAffordance({THREE,camera,position,bounds,width=180,height=44,occluders=[],exclude=null}) {
  if(!position||![position.x,position.y,position.z,bounds?.width,bounds?.height].every(Number.isFinite)||bounds.width<width+16||bounds.height<height+16)return null;
  camera.updateMatrixWorld();
  const point=new THREE.Vector3(position.x,position.y,position.z),view=point.clone().applyMatrix4(camera.matrixWorldInverse),ndc=point.clone().project(camera);
  if(view.z>=0||ndc.z < -1||ndc.z>1||Math.abs(ndc.x)>1||Math.abs(ndc.y)>1)return null;
  const origin=camera.getWorldPosition(new THREE.Vector3()),distance=origin.distanceTo(point);
  const ray=new THREE.Raycaster(origin,point.clone().sub(origin).normalize(),0,distance);
  const visible=object=>{for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;};
  if(ray.intersectObjects(occluders,false).some(hit=>hit.object!==exclude&&visible(hit.object)&&!hit.object.userData?.buildingDateFaded&&!(Array.isArray(hit.object.material)?hit.object.material:[hit.object.material]).every(m=>m?.transparent&&m.opacity<.5)&&hit.distance<distance-.2))return null;
  const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
  return {x:clamp(bounds.left+(ndc.x+1)*bounds.width/2-width/2,bounds.left+8,bounds.left+bounds.width-width-8),y:clamp(bounds.top+(1-ndc.y)*bounds.height/2-height-8,bounds.top+8,bounds.top+bounds.height-height-8)};
}
export function mountAnchoredAffordance({container,canvas,THREE,camera,resolve,getOccluders=()=>[]}) {
  const doc=container.ownerDocument,button=doc.createElement('button');
  button.type='button';button.dataset.anchoredAffordance='';button.hidden=true;
  button.style.cssText='position:fixed;z-index:45;box-sizing:border-box;min-height:44px;max-width:calc(100vw - 16px);width:180px;padding:8px;border:2px solid #cee9e3;border-radius:10px;background:#183c40;color:white;font:600 13px system-ui;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;touch-action:manipulation;transition:none;animation:none';
  container.append(button);let currentKey=null;
  function hide(){if(doc.activeElement===button)canvas.focus({preventScroll:true});button.hidden=true;currentKey=null;}
  function valid(target){return target&&target.id!=null&&typeof target.key==='string'&&typeof target.inspect==='function'&&target.available!==false;}
  function update(){const target=resolve();if(!valid(target)){hide();return;}
    const bounds=canvas.getBoundingClientRect(),viewport=doc.defaultView.visualViewport;
    const left=Math.max(bounds.left,viewport?.offsetLeft??0),top=Math.max(bounds.top,viewport?.offsetTop??0);
    const right=Math.min(bounds.right,(viewport?.offsetLeft??0)+(viewport?.width??doc.defaultView.innerWidth)),bottom=Math.min(bounds.bottom,(viewport?.offsetTop??0)+(viewport?.height??doc.defaultView.innerHeight));
    const placement=projectAffordance({THREE,camera,position:target.position,bounds:{left,top,width:right-left,height:bottom-top},width:180,height:44,occluders:getOccluders(),exclude:target.object});
    if(!placement){hide();return;}if(currentKey!==target.key&&doc.activeElement===button)canvas.focus({preventScroll:true});
    currentKey=target.key;button.dataset.targetId=String(target.id);button.textContent=`Inspect ${target.label??target.id}`;button.setAttribute('aria-label',button.textContent);button.hidden=false;button.style.left=`${placement.x}px`;button.style.top=`${placement.y}px`;
  }
  button.addEventListener('click',()=>{const target=resolve();if(valid(target)&&target.key===currentKey){update();if(!button.hidden)target.inspect();}else hide();});
  return {update,destroy(){hide();button.remove();}};
}
