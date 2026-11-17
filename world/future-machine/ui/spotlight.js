export function mountSpotlight(container,{onVisit}={}) {
  const doc=container.ownerDocument,root=doc.createElement('section');
  root.className='fm-spotlight';root.setAttribute('aria-label','First Difference spotlight');
  const title=doc.createElement('strong');title.textContent='First Difference spotlight';
  const status=doc.createElement('p');status.setAttribute('role','status');
  const previous=doc.createElement('button'),next=doc.createElement('button');
  previous.type=next.type='button';previous.textContent='Previous difference';next.textContent='Next difference';
  let model={status:'unavailable',stops:[]},index=-1,ready=false;
  function render(){previous.disabled=!ready||index<=0;next.disabled=!ready||index>=model.stops.length-1||!model.stops.length;
    const stop=model.stops[index];
    const message=stop?`Stop ${index+1} of ${model.stops.length} · Month ${stop.month} · ${stop.entity.arm} · ${stop.entity.collection} ${stop.entity.id} · event ${stop.eventId}. Synthetic model result.`:({ready:`${model.stops.length} recorded construction milestones. Choose Next difference to begin.`,empty:'No recorded changes in this comparison.',unsupported:'Recorded changes have no supported construction event/entity link for this tour. Inspect the comparison for other differences.',unavailable:'Spotlight unavailable: paired records or comparison are missing.'}[model.status]);
    if(status.textContent!==message)status.textContent=message;
  }
  function visit(delta){if(!ready)return;const target=index+delta;if(target<0||target>=model.stops.length)return;index=target;onVisit?.(structuredClone(model.stops[index]));render();}
  previous.addEventListener('click',()=>visit(-1));next.addEventListener('click',()=>visit(1));
  root.append(title,status,previous,next);container.append(root);render();
  return {root,reset(value){model=value;index=-1;render();},update(value){ready=value;render();},dispose(){root.remove();}};
}
