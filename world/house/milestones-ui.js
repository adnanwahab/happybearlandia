import { loadHouseholdMilestones, MILESTONE_CATEGORIES } from './milestones.js';

export function mountHouseMilestones(container,{experimentId,householdId,load=loadHouseholdMilestones}={}) {
  const doc=container.ownerDocument;
  function el(tag,text,parent){const n=doc.createElement(tag);if(text)n.textContent=text;parent?.append(n);return n;}
  const trigger=el('button','Family milestones',container.querySelector('.house-story-toolbar')??container);
  trigger.type='button';
  const dialog=el('dialog',null,container);dialog.setAttribute('aria-label','Family milestones');
  dialog.style.cssText='max-width:42rem;width:calc(100% - 3rem);max-height:80vh;overflow:auto;color:#172d29;background:#fffaf0;border:2px solid #526e61;border-radius:12px;padding:20px';
  const close=el('button','Close milestones',dialog);close.type='button';
  el('h2','Family milestones',dialog);
  el('p','Recorded synthetic Population history. Missing history is not filled in. Live autosaves are excluded.',dialog);
  const filters=el('div',null,dialog), categoryLabel=el('label','Milestone category ',filters), category=el('select',null,categoryLabel);
  for(const value of ['all',...MILESTONE_CATEGORIES]){const option=el('option',value==='all'?'All milestones':value.replaceAll('-',' '),category);option.value=value;}
  const tickLabel=el('label',' Exact tick ',filters),tick=el('input',null,tickLabel);tick.type='number';tick.min='0';tick.step='1';tick.placeholder='All ticks';
  const status=el('p',null,dialog);status.setAttribute('role','status');
  const list=el('ol',null,dialog);let rows=[],notice='',controller=null,destroyed=false;
  function render(){
    list.replaceChildren();const filtered=rows.filter(row=>(category.value==='all'||row.category===category.value)&&(tick.value===''||row.tick===Number(tick.value)));
    status.textContent=[notice,filtered.length?'':'No matching recorded milestones. Earlier events may be absent or no longer retained.'].filter(Boolean).join(' ');
    for(const row of filtered){
      const item=el('li',null,list);el('h3',row.title,item);el('p','Tick '+row.tick+' · minute '+row.minute+' · '+row.category,item);
      const source=el('details',null,item);el('summary','Source record · '+row.checkpointId,source);
      el('p',row.sourcePath,source);const pre=el('pre',JSON.stringify(row.source,null,2),source);pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
      const sourceLink=el('a','Open source checkpoint',source);sourceLink.href='/api/world-experiments/'+encodeURIComponent(row.checkpointId);
      if(row.seekId){const seek=el('a','Seek exact tick '+row.tick,item);seek.href='/world?'+new URLSearchParams({experiment:row.seekId});}
      else el('p','Exact snapshot unavailable at tick '+row.tick+'. The source records this event; it cannot replay that instant.',item);
    }
  }
  async function open(){
    rows=[];notice='';dialog.showModal();status.textContent='Reading immutable saved history…';list.replaceChildren();
    controller?.abort();controller=new AbortController();const request=controller;
    try{const result=await load(experimentId,householdId,{signal:request.signal});if(destroyed||request.signal.aborted)return;rows=result.rows;notice=result.notice;render();}
    catch(error){if(!destroyed&&!request.signal.aborted){notice=error.message+' No history was reconstructed.';render();}}
  }
  trigger.onclick=()=>void open();close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{controller?.abort();trigger.focus();});
  category.onchange=render;tick.oninput=render;
  return {open,destroy(){destroyed=true;controller?.abort();dialog.remove();trigger.remove();}};
}
