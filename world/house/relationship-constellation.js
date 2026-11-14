// Presentation only: generated household backstory is not evidence of a saved tie.
export function relationshipConstellation(person={},minute){
 const seen=new Set();
 return (Array.isArray(person.relationships)?person.relationships:[]).filter(row=>{
  if(row.recordedTie!==true||typeof row.personId!=='string'||!row.personId||row.personId===(person.id??person.personId)||seen.has(row.personId))return false;
  seen.add(row.personId);return true;
 }).map(row=>{
  const times=[row.lastEncounterMinute,...(Array.isArray(row.memories)?row.memories:[]).map(m=>m.minute)].filter(t=>Number.isFinite(t)&&t>=0&&Number.isFinite(minute)&&t<=minute);
  const lastMinute=times.length?Math.max(...times):null;
  return {personId:row.personId,name:row.name??row.personId,label:row.label??'Recorded tie',lastMinute,recency:lastMinute===null?'Contact time not recorded':`${Math.floor(minute-lastMinute)} modeled min ago`};
 }).sort((a,b)=>(b.lastMinute??-1)-(a.lastMinute??-1)||a.personId.localeCompare(b.personId));
}
export function mountRelationshipConstellation(container,{person,minute,supportedPersonIds=[],onInspect}={}){
 const doc=container.ownerDocument,section=doc.createElement('section');section.className='house-constellation';section.setAttribute('aria-label','Relationship constellation');container.append(section);
 const add=(tag,text,parent=section)=>{const node=doc.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
 add('h4','Relationship constellation');add('p','Synthetic household · saved ties in this inspected subset. Lines show records, not strength or causation.');
 const edges=relationshipConstellation(person,minute);
 if(!edges.length){add('p','No recorded relationship ties are available. Household membership alone does not create a connection.').setAttribute('role','status');return section;}
 const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 320');svg.setAttribute('aria-hidden','true');svg.classList.add('house-constellation-map');section.append(svg);
 const shape=(tag,attrs)=>{const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.append(node);};
 edges.forEach((edge,i)=>{const angle=i/edges.length*Math.PI*2-Math.PI/2,x=160+117*Math.cos(angle),y=160+117*Math.sin(angle);shape('line',{x1:160,y1:160,x2:x,y2:y,stroke:'currentColor','stroke-width':1});shape('circle',{cx:x,cy:y,r:8,fill:'currentColor'});const text=doc.createElementNS(ns,'text');text.setAttribute('x',String(x));text.setAttribute('y',String(y+23));text.setAttribute('text-anchor','middle');text.textContent=String(i+1);svg.append(text);});
 shape('circle',{cx:160,cy:160,r:15,fill:'currentColor'});
 add('p',person?.name??'Selected resident');const list=add('ol');
 for(const edge of edges){const item=add('li',null,list),supported=supportedPersonIds.includes(edge.personId)&&typeof onInspect==='function';if(supported){const button=add('button',edge.name,item);button.type='button';button.addEventListener('click',()=>onInspect(edge.personId));}else add('strong',edge.name,item);add('span',` · ${edge.label} · ${edge.recency}`,item);if(!supported)add('small',' Profile unavailable in this house scene.',item);}
 return section;
}
