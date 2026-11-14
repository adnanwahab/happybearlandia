/** Presentation-only editorial ranking; never a causal or welfare measurement. */
export const CHAPTER_RULES = 'recorded-chapters.v1';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const impact=type=>type==='PROJECT_COMPLETE'?3:['CONSTRUCTION_STARTED','TOPPED_OUT'].includes(type)?2:1;
export function buildChapters(history) {
  if(!Array.isArray(history?.baseline)||!Array.isArray(history?.plan))return {status:'unavailable',chapters:[]};
  const groups=new Map();
  for(const arm of ['baseline','plan']){
    const ids=new Set(),months=new Set();
    for(const frame of history[arm]){
      if(!frame||!Number.isInteger(frame.month)||frame.month<0||frame.month>120||months.has(frame.month))throw Error('Invalid chapter month');
      months.add(frame.month);
      for(const event of frame.events||[]){
        if(typeof event.id!=='string'||!event.id||typeof event.eventType!=='string'||!event.eventType||event.simulationTime!==frame.month)continue;
        if(ids.has(event.id))throw Error('Ambiguous chapter event identity');ids.add(event.id);
        // Only simultaneous events of the same type share a chapter. Gaps stay gaps.
        const key=JSON.stringify([frame.month,event.eventType]);
        if(!groups.has(key))groups.set(key,{month:frame.month,type:event.eventType,impact:impact(event.eventType),evidence:[]});
        groups.get(key).evidence.push({future:arm==='baseline'?'a':'b',eventId:event.id,month:frame.month,type:event.eventType,modelVersion:event.modelVersion??null,payload:structuredClone(event.payload||{}),dependencies:structuredClone(event.dependencies||[]),entity:structuredClone(event.entity??null)});
      }
    }
  }
  const chapters=[...groups.values()].sort((a,b)=>b.impact-a.impact||a.month-b.month||compare(a.type,b.type)).slice(0,24).sort((a,b)=>a.month-b.month||b.impact-a.impact||compare(a.type,b.type));
  for(const chapter of chapters){chapter.evidence.sort((a,b)=>compare(a.future,b.future)||compare(a.eventId,b.eventId));chapter.title=`${chapter.type} · Month ${chapter.month}`;chapter.summary=`${chapter.evidence.length} recorded model event(s). Editorial chapter selection; event association does not establish causation.`;chapter.limitations=['Synthetic monthly City model results; not a forecast. Causal explanation requires recorded dependencies.'];chapter.rulesVersion=CHAPTER_RULES;}
  return {status:chapters.length?'ready':'empty',chapters};
}
export function createChapters(container,{history,onJump}={}){
  const doc=container.ownerDocument,section=doc.createElement('section');section.setAttribute('aria-label','Recorded event chapters');
  const heading=doc.createElement('h3');heading.textContent='Chapters · recorded model events';section.append(heading);
  const note=doc.createElement('p');const {status,chapters}=buildChapters(history);
  note.textContent=status==='unavailable'?'Chapter history unavailable.':status==='empty'?'No recorded events in supplied history. No discoveries inferred.':'Editorial highlights: completion, construction milestones, then other event types. Up to 24 chapters; empty spans have no markers. Select a tick to seek and open WHY.';section.append(note);
  const list=doc.createElement('div');list.style.cssText='display:flex;gap:8px;overflow-x:auto;padding:4px;max-width:100%';section.append(list);
  const listeners=[];
  for(const chapter of chapters){const button=doc.createElement('button');button.type='button';button.textContent=`│ ${chapter.title} (${chapter.evidence.length})`;button.style.cssText='min-height:44px;min-width:44px;flex-shrink:0;font:inherit;color:inherit;background:#182a3c;border:1px solid #7890a3;border-radius:6px;padding:8px';const click=()=>onJump?.(chapter);button.addEventListener('click',click);listeners.push([button,click]);list.append(button);}
  const keydown=event=>{const buttons=list.querySelectorAll('button'),index=[...buttons].indexOf(event.target);if(index<0)return;let next;if(event.key==='ArrowRight')next=Math.min(index+1,buttons.length-1);if(event.key==='ArrowLeft')next=Math.max(0,index-1);if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;if(next!==undefined){event.preventDefault();buttons[next].focus();}};list.addEventListener('keydown',keydown);container.append(section);
  return {dispose(){for(const [button,click]of listeners)button.removeEventListener('click',click);list.removeEventListener('keydown',keydown);section.remove();}};
}
