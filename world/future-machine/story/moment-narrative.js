/** Presentation interpretation is separate from recorded observations. */
export function narrateMoment(moment) {
  const titles = {'construction':'A city takes shape','character-decision':'A worker chooses a new job','chain':'Follow the recorded chain','goal-conflict':'When goals compete'};
  const interpretations = {
    construction:'A recorded construction milestone changes the project story.',
    'character-decision':'The City model recorded a job allocation for this worker. This is not a Population or House resident identity.',
    chain:'Earlier records are explicitly referenced by this event. Surprise is an editorial interpretation.',
    'goal-conflict':'Providing homes and services can compete with affordability and available funding. This is an authored goal tradeoff interpretation of the recorded constraint.'
  };
  return {title:titles[moment.kind],summary:interpretations[moment.kind],quest:'Inspect the source and explain what changed. This optional observation quest awards no simulation rewards.',cutscene:`Month ${moment.month} · ${moment.arm} · ${moment.record.eventType || moment.record.decisionType}`,label:'Narrative interpretation'};
}

export function renderMoments(container, moments, {onJump} = {}) {
  const doc=container.ownerDocument,root=doc.createElement('section'),listeners=[];
  root.setAttribute('aria-label','Cinematic moments');
  function text(tag,value,parent=root){const node=doc.createElement(tag);node.textContent=value;parent.append(node);return node;}
  function button(label,handler,parent){const node=text('button',label,parent);node.type='button';node.addEventListener('click',handler);listeners.push([node,handler]);return node;}
  root.style.cssText='padding:16px;min-width:0;overflow-wrap:anywhere';
  text('h2','Cinematic moments');
  text('p','City job decisions use exact decision record references because this model emits no decision event IDs. Chains require explicit earlier-event dependencies; absent dependencies are never inferred. Goal tradeoffs are authored interpretations, not recorded player goal choices.');
  text('p','Optional narrative interpretation of recorded City results. Skip or replay freely; simulation outcomes stay fixed.');
  if(!moments.length)text('p','No supported recorded moments available.');
  for(const moment of moments){
    const narrative=narrateMoment(moment),article=text('article',''),content=text('div','',article);
    text('h3',narrative.title,article);
    const status=text('p','Ready',article);status.setAttribute('role','status');
    text('p',`${narrative.label}: ${narrative.summary}`,content);
    text('p',narrative.cutscene,content);text('p',narrative.quest,content);
    const details=text('details','',content);text('summary','Recorded source',details);
    const sourceText=text('pre',JSON.stringify({arm:moment.arm,month:moment.month,source:moment.source,record:moment.record,dependencies:moment.dependencies,missingDependencies:moment.missingDependencies,rulesVersion:moment.rulesVersion,experimentId:moment.experimentId,modelVersion:moment.modelVersion,seed:moment.seed},null,2),details);sourceText.style.cssText='white-space:pre-wrap;max-height:280px;overflow:auto';
    button('Skip moment',()=>{content.hidden=true;status.textContent='Skipped — replay remains available';},article);
    button('Replay moment',()=>{content.hidden=false;status.textContent='Replaying recorded moment';onJump?.({month:moment.month,title:narrative.title,summary:narrative.summary,evidence:[{future:moment.arm,eventId:moment.source.id ?? null,source:moment.source,...moment.record}],limitations:['Narrative interpretation; no simulation commands are issued.']});},article);
    button('Inspect source',()=>{content.hidden=false;details.open=true;status.textContent='Showing recorded source';},article);
  }
  container.replaceChildren(root);
  return ()=>{for(const [node,handler] of listeners)node.removeEventListener('click',handler);root.remove();};
}
