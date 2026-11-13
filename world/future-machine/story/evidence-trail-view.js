import {buildEvidenceTrail} from './evidence-trail.js';
/** Accessible view of exact monthly records; no new causal relationships. */
export function renderEvidenceTrail(container,history,selection,{onJump,onReturn}={}) {
 const trail=buildEvidenceTrail(history,selection),doc=container.ownerDocument;
 const shell=doc.createElement('section');shell.setAttribute('aria-label','Visual WHY evidence trail');
 shell.style.cssText='padding:14px;margin-top:12px;border:1px solid #486071;border-radius:10px;overflow-wrap:anywhere';
 const title=doc.createElement('h3');title.textContent='Recorded evidence trail';shell.append(title);
 const viewing=doc.createElement('p'),back=doc.createElement('button');back.type='button';back.textContent='Return';back.onclick=()=>onReturn?.();shell.append(viewing,back);
 const buttons=[];let currentNode=null;
 const note=doc.createElement('p');note.textContent='Exact City relationships. Select a recorded step to visit its month. Independent causal certainty is unavailable.';shell.append(note);
 for(const arm of ['baseline','plan']){
  const heading=doc.createElement('h4');heading.textContent=arm==='plan'?'WITH PLAN':'WITHOUT PLAN';shell.append(heading);
  const list=doc.createElement('ol');list.style.paddingLeft='20px';
  const nodes=trail.nodes.filter(n=>n.arm===arm).sort((a,b)=>(a.month??Infinity)-(b.month??Infinity));
  for(const node of nodes){const item=doc.createElement('li');item.style.marginBottom='10px';
   const caption=`${node.type} · ${node.status==='unavailable'?'Unavailable':`Month ${node.month}`}${node.eventId?` · event ${node.eventId}`:''}${node.type==='housing-units'&&node.record?` · ${node.record.count} homes`:''}`;
   if(node.status==='recorded'&&node.month!==null){const button=doc.createElement('button');button.type='button';button.textContent=caption;button.style.cssText='min-height:44px;max-width:100%;white-space:normal;text-align:left;color:#eff7ff;background:#203f50;border:1px solid #8bb1c5;border-radius:6px;padding:8px';button.dataset.nodeId=node.id;buttons.push(button);button.onclick=()=>onJump?.({nodeId:node.id,month:node.month,entity:node.type==='completion'?{collection:selection.collection,id:selection.id}:node.entity,title:caption,summary:caption});item.append(button);}else item.textContent=caption;
   if(node.unavailableReason){const reason=doc.createElement('p');reason.textContent=node.unavailableReason;item.append(reason);}
   const record=doc.createElement('details'),summary=doc.createElement('summary'),raw=doc.createElement('pre');summary.textContent='Exact supporting record';raw.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px';raw.textContent=JSON.stringify(node.record,null,2);record.append(summary,raw);item.append(record);list.append(item);
  }shell.append(list);
 }
 const edges=doc.createElement('details'),label=doc.createElement('summary');label.textContent='Recorded links and unavailable dependencies';edges.append(label);
 for(const edge of trail.edges){const row=doc.createElement('p');row.textContent=`${edge.relationship} · ${edge.status}${edge.unavailableReason?`: ${edge.unavailableReason}`:''}`;edges.append(row);}shell.append(edges);container.append(shell);
 const dispose=()=>shell.remove();
 dispose.update=(month,nodeId=null,unlocated=false)=>{
  currentNode=nodeId;
  viewing.textContent=`Viewing Month ${month} · trail recorded through Month ${selection.month}${unlocated?' · No unambiguous scene mapping for this entity; camera unchanged.':''}`;
  back.hidden=month===selection.month;
  for(const button of buttons){const active=button.dataset.nodeId===currentNode;if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.style.outline=active?'3px solid #ffd166':'';}
 };
 dispose.update(selection.month);
 return dispose;
}
