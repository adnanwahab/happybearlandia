/** Presentation-only bounded sample. Source order and IDs are retained. */
export function spatialTargets(town,{available=true,limit=24}={}) {
  if(!available||!town)return [];
  const cap=Math.max(0,Math.min(48,Math.floor(limit)||0));
  const residents=[],buildings=[];
  for(let i=0;i<(town.people?.length??0)&&residents.length<cap;i++) {
    const p=town.people[i];
    if(p.id!=null&&Number.isFinite(p.x)&&Number.isFinite(p.z))residents.push({id:String(p.id),kind:'resident',name:p.name||String(p.id),index:i,position:{x:p.x,y:0,z:p.z}});
  }
  for(let i=0;i<(town.buildings?.length??0)&&buildings.length<cap;i++) {
    const b=town.buildings[i];
    if(b.id!=null&&Number.isFinite(b.center?.[0])&&Number.isFinite(b.center?.[1]))buildings.push({id:String(b.id),kind:'building',name:b.name||String(b.id),index:i,position:{x:b.center[0],y:0,z:b.center[1]}});
  }
  const rows=[];
  for(let i=0;rows.length<cap&&(i<residents.length||i<buildings.length);i++)for(const row of [residents[i],buildings[i]])if(row&&rows.length<cap)rows.push(row);
  return rows;
}
export function nextTargetIndex(index,key,length) {
  if(!length)return -1;
  if(key==='Home')return 0;
  if(key==='End')return length-1;
  const direction=['ArrowLeft','ArrowUp'].includes(key)?-1:1;
  return Math.max(0,Math.min(length-1,index+direction));
}

/** Native buttons form the semantic list and preserve Tab/Shift+Tab escape. */
export function mountSpatialTargets({document,container,getTargets,onFocus,onClear,onInspect,onExit=()=>{}}) {
  const root=document.createElement('details');root.id='world-spatial-targets';
  root.style.cssText='position:fixed;left:12px;top:90px;z-index:30;background:#152422;color:#fff;padding:10px;border:2px solid #ffe283;border-radius:8px;max-width:min(320px,calc(100vw - 48px));max-height:55vh;overflow:auto';
  const summary=document.createElement('summary');summary.textContent='Explore scene targets';root.append(summary);
  const help=document.createElement('p');help.textContent='Representative scene targets. Tab or arrow keys to explore; Enter to inspect; Escape to exit. Synthetic residents; buildings retain their source labels.';root.append(help);
  const list=document.createElement('ul');list.setAttribute('aria-label','Representative scene entities');root.append(list);
  const status=document.createElement('p');status.setAttribute('role','status');root.append(status);
  let rows=[],buttons=[];
  function refresh(){
    onClear();rows=getTargets();buttons=[];list.replaceChildren();
    status.textContent=rows.length?`${rows.length} representative targets; this is a bounded sample, not a complete inventory.`:'Scene targets unavailable in this mode or no spatial entities loaded.';
    for(const row of rows){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${row.name} · ${row.kind}`;button.dataset.entityId=row.id;button.dataset.kind=row.kind;button.style.cssText='min-height:44px;margin:3px;';
      button.addEventListener('focus',()=>{button.style.outline='3px solid #ffe283';if(onFocus(row)===false)status.textContent='This scene target is no longer available.';});
      button.addEventListener('blur',()=>{button.style.outline='';onClear();});
      button.addEventListener('click',()=>{if(onFocus(row)!==false)onInspect(row,button);});
      li.append(button);list.append(li);buttons.push(button);
    }
  }
  root.addEventListener('toggle',()=>{if(root.open)refresh();else onClear();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onExit();onClear();root.open=false;summary.focus();return;}
    const index=buttons.indexOf(document.activeElement);
    if(index>=0&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();buttons[nextTargetIndex(index,event.key,buttons.length)].focus();}
  });
  container.append(root);
  return {refresh,dispose(){onClear();root.remove();}};
}
