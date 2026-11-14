import {selectMoments} from './game-director.js';
import {narrateMoment} from './moment-narrative.js';

export const DOCUMENTARY_VERSION='future-documentary.v1';
/** A bounded editorial recipe over manifest-recomputed records, never a simulation. */
export function buildDocumentary(history,diffs=[]){
  const paired=(history.baseline||[]).filter(a=>(history.plan||[]).some(b=>b.month===a.month)).map(a=>a.month).sort((a,b)=>a-b);
  const quiet=diffs.length>0 && diffs.every(d=>d.available && !(d.entities||[]).length);
  const moments=quiet?[]:selectMoments(history,{limit:4});
  const sources=paired.length?[{month:paired[0]},...moments,{month:paired.at(-1)}]:[];
  const cards=sources.map((source,index)=>{
    const month=source.month;
    const checkpoints=Object.fromEntries(['baseline','plan'].map(arm=>{
      const snapshot=history[arm]?.find(row=>row.month===month);
      return [arm,snapshot?{month,buildings:snapshot.state?.buildings?.map(row=>row.id)??null}:null];
    }));
    return {startSeconds:index*60/sources.length,endSeconds:(index+1)*60/sources.length,month,
      interpretation:quiet?'A quiet comparison: no recorded A/B entity differences in the available paired history.':source.record?narrateMoment(source).summary:'Pause to inspect this modeled checkpoint. No causal conclusion is implied.',
      moment:source.record?source:null,checkpoints};
  });
  return structuredClone({schemaVersion:DOCUMENTARY_VERSION,durationSeconds:cards.length?60:0,quiet,cards,
    recipe:history.recipe??null,experimentId:history.experimentId??null,seed:history.seed??null,modelVersion:history.modelVersion??null,initialHash:history.initialHash??null,provenance:history.provenance??null,
    limitations:['Manifest recomputation, not independently verified recorded-checkpoint replay.','Synthetic City results; thumbnails are cosmetic inventory diagrams, not geographic views.','Narration is editorial interpretation; this storyboard does not render a video.']});
}

export function renderDocumentary(container,documentary,{onJump,onExport}={}){
  const doc=container.ownerDocument,root=doc.createElement('section'),listeners=[];
  root.setAttribute('aria-label','One-minute Future Documentary');
  root.style.cssText='padding:16px;overflow-wrap:anywhere;min-width:0';
  function text(tag,value,parent=root){const node=doc.createElement(tag);node.textContent=value;parent.append(node);return node;}
  function button(label,callback,parent=root){const node=text('button',label,parent);node.type='button';node.addEventListener('click',callback);listeners.push([node,callback]);}
  text('h2','One-minute Future Documentary');
  text('p',`${documentary.durationSeconds}-second storyboard · run ${documentary.experimentId??'unavailable'} · seed ${documentary.seed??'unavailable'} · model ${documentary.modelVersion??'unavailable'}`);
  text('p',documentary.limitations.join(' '));
  if(!documentary.cards.length)text('p','No paired checkpoints available. Documentary unavailable.');
  else if(onExport)button('Export documentary recipe',()=>onExport(documentary));
  for(const card of documentary.cards){
    const article=text('article','');
    text('h3',`${card.startSeconds.toFixed(0)}–${card.endSeconds.toFixed(0)} seconds · Month ${card.month}`,article);
    text('p',`Narrative interpretation: ${card.interpretation}`,article);
    for(const arm of ['baseline','plan']){
      const checkpoint=card.checkpoints[arm],ids=checkpoint?.buildings;
      // Fixed 240×64 schematic, capped at 48 glyphs. No image, GPU, timer or network resources.
      const thumbnail=text('div','',article);thumbnail.setAttribute('role','img');
      thumbnail.setAttribute('aria-label',`${arm} checkpoint Month ${card.month}: ${ids===null||!ids?'building inventory unavailable':`${ids.length} recorded building IDs`}. Cosmetic inventory thumbnail.`);
      thumbnail.style.cssText='width:240px;max-width:100%;min-height:64px;background:#192c40;color:#8cdbcf;padding:8px;box-sizing:border-box';
      text('span',ids?`${arm}: ${'▥ '.repeat(Math.min(48,ids.length))}${ids.length>48?'…':''} (${ids.length})`:`${arm}: unavailable`,thumbnail);
    }
    const details=text('details','',article);text('summary','Inspect timestamp, affected IDs and source',details);
    const pre=text('pre',JSON.stringify({seed:documentary.seed,month:card.month,moment:card.moment,checkpoints:card.checkpoints},null,2),details);
    pre.style.cssText='white-space:pre-wrap;max-height:240px;overflow:auto';
    button(`Open documentary Month ${card.month}`,()=>onJump?.({month:card.month,title:'Documentary checkpoint',summary:card.interpretation,evidence:card.moment?[card.moment]:[]}),article);
  }
  container.replaceChildren(root);
  return ()=>{for(const [node,callback]of listeners)node.removeEventListener('click',callback);root.remove();};
}
