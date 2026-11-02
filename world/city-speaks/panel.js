/** mountCitySpeaks(container,{getComparison,analyze?,onFocus,onPerspective,
 * onRevise,onError}) -> {update({comparison,analysis}?),selectEntity,destroy}.
 * All stories/counts are supplied records or explicitly labeled preference
 * outputs. This panel never runs a poll, invents a quest, or advances a model. */
const finite=Number.isFinite;
const items=value=>Array.isArray(value)?value:[];
const currentOf=row=>row?.current??row?.selected??row?.treatment??row?.after??row?.currentRecord??null;
const baselineOf=row=>row?.baseline??row?.before??row?.baselineRecord??null;
export function citySpeaksCouncil(council){
 const counts=council?.counts??council??{},support=counts.support,oppose=counts.oppose,unsure=counts.unsure,n=council?.panelSize??council?.size??council?.n??(finite(support)&&finite(oppose)&&finite(unsure)?support+oppose+unsure:null);
 if(![support,oppose,unsure,n].every(Number.isInteger)||n<1||n>1000||Math.min(support,oppose,unsure)<0||support+oppose+unsure!==n)return{available:false,reason:'A consistent actual panel of 1–1,000 matched members was not supplied.'};
 return{available:true,n,support,oppose,unsure,supportShare:support/n};
}
export function citySpeaksAnchor(entity,comparison={}){
 const point=value=>Array.isArray(value)&&value.length>=2&&value.slice(0,2).every(finite)?{x:value[0],z:value[1]}:value&&finite(value.x)&&finite(value.z)?{x:value.x,z:value.z}:null;
 const direct=point(entity?.anchor)??point(currentOf(entity));if(direct)return{...direct,source:entity?.anchor?.source??'supplied entity coordinates'};
 const current=currentOf(entity)||{},state=comparison.state??comparison.current?.state??comparison.treatment?.state??comparison.selected?.state??comparison.current??{},context=comparison.worldContext??{};
 const unit=items(state.units).find(unit=>String(unit.id)===String(current.unitId));
 const buildingId=current.buildingId??unit?.buildingId??(['building','buildings'].includes(entity?.kind)?entity.id:null);
 if(buildingId!==null&&buildingId!==undefined){const b=items(context.buildings).find(b=>[b.id,b.sourceId].some(id=>id!==null&&id!==undefined&&String(id)===String(buildingId)));const found=point(b?.center)??point(b);if(found)return{...found,source:'supplied building anchor'};}
 if(['district','districts','neighborhood'].includes(entity?.kind)){const d=items(context.districts).find(d=>String(d.id)===String(entity.id));const found=point(d);if(found)return{...found,source:'supplied model-district anchor; not a surveyed neighborhood boundary'};}
 return null;
}
export function citySpeaksFields(entity){
 const before=baselineOf(entity),after=currentOf(entity),allowed=['needs','resources','budget','schedule','income','savings','rent','occupation','jobId','unitId','districtId','currentActivity','activity','mode','commuteMinutes','departureMinute','tripTotal','remaining','revenue','operatingCost','commercialRent','viability','floors','capacity','travelTime','flow','serviceLevel'];
 const rows=[];for(const field of allowed){const a=before?.[field],b=after?.[field];if(a===undefined&&b===undefined)continue;if((a&&typeof a==='object'&&!Array.isArray(a))||(b&&typeof b==='object'&&!Array.isArray(b))){for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))rows.push({field:field+'.'+key,baseline:a?.[key]??null,current:b?.[key]??null});}else rows.push({field,baseline:a??null,current:b??null});}return rows;
}
export function mountCitySpeaks(container,{getComparison=()=>null,analyze,onFocus,onPerspective,onRevise,onError}={}){
 if(!container?.ownerDocument)throw Error('City Speaks requires a container');
 const doc=container.ownerDocument,root=doc.createElement('section');root.className='city-speaks';root.dataset.testid='city-speaks';
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./panel.css',import.meta.url).href;(doc.head||container).append(sheet);container.append(root);
 const el=(tag,text,parent=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const button=(text,action,parent=root)=>{const node=el('button',text,parent);node.type='button';node.addEventListener('click',()=>Promise.resolve().then(action).catch(fail));return node;};
 el('h2','The City Speaks');el('p','Synthetic model perspectives, not interviews, real polling or measured wellbeing. Explanations cite retained fields; unmodeled outcomes stay unavailable.');
 const status=el('p','Enter an actual paired future to inspect its records.');status.setAttribute('role','status');
 const actions=el('div');actions.className='city-speaks-actions';
 button('Who does this hurt?',()=>{filter='hurt';renderEntities();},actions);button('Who changes most?',()=>{filter='changed';renderEntities();},actions);button('All matched entities',()=>{filter='all';renderEntities();},actions);
 const label=el('label','Find an entity'),search=el('input',undefined,label);search.type='search';search.setAttribute('aria-label','Find a synthetic entity');
 const count=el('p'),entityList=el('div');entityList.className='city-speaks-entities';
 const council=el('section'),assumptions=el('details');el('summary','Assumptions & unavailable outcomes',assumptions);const assumptionList=el('ul',undefined,assumptions);const detail=el('section');detail.hidden=true;const revisions=el('section');
 let comparison=null,analysis=null,selected=null,entities=[],filter='all',serial=0,destroyed=false;
 function fail(error){if(destroyed)return;status.textContent='Unavailable: '+error.message;onError?.(error);}
 function score(row){return row.preferenceScore??row.impactScore??row.score??row.preference?.score;}
 function entityRows(value){return items(value.entities).length?value.entities:[...items(value.people),...items(value.households),...items(value.businesses),...items(value.buildings),...items(value.districts),...items(value.roads),...items(value.systems)];}
 function renderEntities(){
  entityList.replaceChildren();const query=search.value.trim().toLowerCase();let shown=entities.filter(row=>(String(row.id)+' '+(row.label??row.name??'')+' '+(row.kind??'entity')).toLowerCase().includes(query));
  const ranked=analysis?.rankings?.[filter==='hurt'?'hurt':'mostChanged'];if(filter!=='all'&&Array.isArray(ranked)){const order=new Map(ranked.map((row,i)=>[String(typeof row==='object'?row.id:row),i]));shown=shown.filter(row=>order.has(String(row.id))).sort((a,b)=>order.get(String(a.id))-order.get(String(b.id)));}
  else if(filter==='hurt')shown=shown.filter(row=>finite(score(row))&&score(row)<0).sort((a,b)=>score(a)-score(b));else if(filter==='changed')shown=shown.filter(row=>finite(score(row))).sort((a,b)=>Math.abs(score(b))-Math.abs(score(a)));
  count.textContent='Showing '+Math.min(100,shown.length)+' of '+shown.length+' matched '+(filter==='all'?'entities':filter==='hurt'?'negative modeled preference results':'ranked modeled preference changes')+'. These rankings are assumption-dependent, not actual emotions.';
  if(!shown.length){el('p','No matching recorded/ranked entities are available in this scope.',entityList);return;}
  for(const row of shown.slice(0,100)){const choice=button((row.label??row.name??row.id)+' · '+(row.kind??'entity')+(finite(score(row))?' · modeled score '+number(score(row)):''),()=>selectEntity(row),entityList);choice.dataset.entityId=String(row.id);}
 }
 function number(value){return finite(value)?value.toLocaleString(undefined,{maximumFractionDigits:3}):value===null||value===undefined?'Unavailable':typeof value==='object'?JSON.stringify(value):String(value);}
 function table(parent,title,headers,rows){const heading=el('h3',title,parent);if(!rows.length){el('p','Not retained or not modeled.',parent);return heading;}const table=el('table',undefined,parent),thead=el('thead',undefined,table),tr=el('tr',undefined,thead);for(const h of headers)el('th',h,tr);const body=el('tbody',undefined,table);for(const row of rows){const tr=el('tr',undefined,body);for(const value of row)el('td',number(value),tr);}return heading;}
 function renderCouncil(){
  council.replaceChildren();el('h3','Council of up to 1,000',council);const result=citySpeaksCouncil(analysis?.council);
  if(!result.available){el('p',result.reason,council);return;}
  el('p','Actual panel: '+result.n+' · Support '+result.support+' · Oppose '+result.oppose+' · Unsure '+result.unsure+' · Modeled support '+(result.supportShare*100).toFixed(1)+'%.',council);
  el('p','Votes are deterministic synthetic preference classifications under supplied rules. They are not surveys, consent, or forecasts of actual voting.',council);
  const reasonRows=value=>Array.isArray(value)?value.map(row=>[row.label??row.reason??row.code,row.count??null,(row.fields??row.sourceFields??[]).join?.(', ')??'Not supplied']):Object.entries(value||{}).map(([label,count])=>[label,count,'Not supplied']);
  table(council,'Support reasons (supplied counts)',['Reason','Members / records','Source fields'],reasonRows(analysis.council.supportReasons??analysis.council.reasons?.support));
  table(council,'Opposition reasons (supplied counts)',['Reason','Members / records','Source fields'],reasonRows(analysis.council.opposeReasons??analysis.council.reasons?.oppose));
  const nonharm=analysis?.mission?.bottomQuintileNonHarm??analysis?.bottomQuintile?.nonHarm;const pass=result.supportShare>=.8&&nonharm===true;
  el('p','Illustrative mission: 80% modeled support and no modeled harm to the baseline-income bottom quintile. Status: '+(nonharm===true||nonharm===false?pass?'met under these assumptions':'not met under these assumptions':'unavailable; bottom-quintile assessment not supplied')+'.',council);
 }
 function reasons(entity,parent){const list=el('ul',undefined,parent);for(const reason of items(entity.reasons??entity.explanations).slice(0,20)){const text=typeof reason==='string'?reason:reason.text??reason.label??reason.code??'Reason';const fields=typeof reason==='object'?reason.fields??reason.sourceFields:[];el('li',text+' · source fields: '+(Array.isArray(fields)&&fields.length?fields.join(', '):'not supplied'),list);}}
 function selectEntity(value){
  const normalized=kind=>({visibleAgents:'person',people:'person',households:'household',businesses:'business',buildings:'building',districts:'district',links:'road',link:'road',agencies:'agency',systems:'system'}[kind]??kind);selected=entities.find(row=>String(row.id)===String(typeof value==='string'?value:value?.id)&&(typeof value==='string'||!value?.kind||normalized(row.kind)===normalized(value.kind)));if(!selected){detail.hidden=false;detail.replaceChildren();el('p','No matched comparison record is retained for this selected entity.',detail);return;}detail.hidden=false;detail.replaceChildren();el('h3',selected.label??selected.name??String(selected.id),detail);el('p','Synthetic '+(selected.kind??'entity')+' · stable ID '+selected.id+'. Recorded facts below are not a generated personal testimony.',detail);
  const controls=el('div',undefined,detail),anchor=citySpeaksAnchor(selected,comparison),focus=button('Take me there',()=>onFocus?.({...anchor,entity:selected}),controls);focus.disabled=!anchor;focus.title=anchor?anchor.source:'No actual entity anchor is supplied; no location is invented.';
  button('Become this person · recorded perspective',()=>{onPerspective?.({entity:selected,baseline:baselineOf(selected),current:currentOf(selected),comparison});if(anchor)onFocus?.({...anchor,entity:selected});},controls);
  reasons(selected,detail);table(detail,'Matched needs, resources and schedule',['Exact record field','Original / baseline','Amended / selected'],citySpeaksFields(selected).map(row=>[row.field,row.baseline,row.current]));
  const trajectory=selected.trajectories??analysis?.trajectories?.[selected.id]??{},records=[];
  for(const [branch,source]of [['Original / baseline',trajectory.baseline??selected.baselineTrajectory],['Amended / selected',trajectory.current??trajectory.selected??selected.selectedTrajectory]])for(const row of items(source).slice(0,100))records.push([branch,finite(row.month)?'Month '+row.month:finite(row.minute)?'Minute '+row.minute:row.time??'Time unavailable',row.field??row.eventType??row.type??row.activity??'Record',row.value??row.reason??row.description??'Value not retained']);
  table(detail,'Retained individual trajectory only',['Branch','Recorded time','Field / event','Recorded value'],records);el('p','At most 100 supplied trajectory records per branch are displayed. Gaps are not filled, citywide averages are not substituted, and no extra errands or quests are invented.',detail);detail.scrollIntoView?.({block:'nearest'});
 }
 function renderRevisions(){
  revisions.replaceChildren();el('h3','Computational compromise',revisions);el('p','Candidate improvements require actual paired reruns. No claimed vote, budget or welfare gain is generated from proposal wording.',revisions);
  button('Evaluate compromise candidates',async()=>{if(!onRevise){status.textContent='Candidate rerun service is not connected.';return;}status.textContent='Requesting actual candidate reruns…';await onRevise({type:'search',comparison,analysis});},revisions);
  for(const candidate of items(analysis?.compromises??analysis?.candidates).slice(0,20)){const section=el('section',undefined,revisions);el('h4',candidate.label??candidate.id??'Candidate',section);if(candidate.status==='completed'){el('p',candidate.summary??'Actual rerun returned; inspect its recorded comparison.',section);el('p',finite(candidate.supportChange)?'Recorded modeled supporter count change: '+(candidate.supportChange>0?'+':'')+number(candidate.supportChange)+' members.':'Support change unavailable; a comparable matched panel was not supplied.',section);button('Inspect this actual rerun',()=>onRevise?.({type:'inspect',candidate,comparison}),section);const adopt=button('Use as revised policy branch',()=>onRevise?.({type:'adopt',candidate,comparison,analysis}),section);adopt.disabled=!onRevise;}else el('p','No completed rerun is supplied; improvements unavailable.',section);}
 }
 async function update(next){const request=++serial;try{const source=next??await getComparison();if(destroyed||request!==serial)return;comparison=source?.comparison??source;if(!comparison){analysis=null;entities=[];selected=null;entityList.replaceChildren();council.replaceChildren();detail.hidden=true;status.textContent='Enter an actual paired future first.';return;}analysis=source?.citySpeaks??comparison.citySpeaks??(analyze?await analyze(comparison):source?.analysis??comparison.analysis)??{};if(destroyed||request!==serial)return;entities=entityRows(analysis);assumptionList.replaceChildren();for(const note of [...items(analysis.assumptions),...items(analysis.limitations)])el('li',typeof note==='string'?note:note.description??note.label??JSON.stringify(note),assumptionList);status.textContent='Inspecting '+entities.length+' supplied matched entities. Missing kinds, fields and effects remain unavailable.';renderEntities();renderCouncil();renderRevisions();if(selected){const matched=entities.find(row=>row.id===selected.id&&row.kind===selected.kind);if(matched)selectEntity(matched);else{selected=null;detail.hidden=true;}}}catch(error){if(request===serial)fail(error);}}
 const searchInput=()=>renderEntities(),keys=event=>event.stopPropagation();search.addEventListener('input',searchInput);root.addEventListener('keydown',keys);
 return{update,selectEntity,getSelection:()=>selected,destroy(){if(destroyed)return;destroyed=true;serial++;search.removeEventListener('input',searchInput);root.removeEventListener('keydown',keys);root.remove();sheet.remove();}};
}
