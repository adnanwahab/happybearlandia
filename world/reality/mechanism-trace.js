/** Read-only audit of declared mechanisms and executed paired measurements.
 * An implemented chain is not proof that every intermediate stage activated. */
export const LAW_LEVERS=Object.freeze(['time','money','eligibility','capacity','prices','rules','accessibility','risk']);
const classifications={
 'housing-entitlements':['rules','capacity'],'permit-throughput':['capacity'],
 'parking-cost-proxy':['prices'],'housing-construction':['money','capacity'],
 'drainage-resilience':['money','capacity','risk'],'transit-construction':['money','capacity','accessibility'],
 'free-transit':['prices','accessibility'],'population-housing-capacity':['capacity'],
 'childcare-affordability':['prices','capacity','eligibility'],'teen-school-start':['time'],
 'summer-camps':['time','prices','capacity'],'population-transit-service':['capacity','accessibility']
};
const read=(object,key)=>Object.hasOwn(object??{},key)?object[key]:key.split('.').reduce((v,k)=>v?.[k],object);
export function buildMechanismTrace(program,replay=null,{metricUnits={}}={}){
 if(!program||!Array.isArray(program.mechanisms)||program.mechanisms.length>32)throw new Error('A bounded compiled mechanism program is required');
 const before=replay?.baseline?.metrics,after=replay?.treatment?.metrics;
 const paired=!!before&&!!after&&replay.status!=='error'&&replay.engine===program.engine;
 return{schemaVersion:'mechanism-trace.v1',programId:program.id,runId:paired?replay.runId:null,measured:paired,
 limitations:['Implementation references describe model wiring, not independently observed real-world causality.','Aggregate changes do not establish that an individual link caused them; intermediate activation requires its own recorded evidence.','Zero change is a valid result. Missing outputs are unavailable, never replaced with zero.'],
 chains:program.mechanisms.map(m=>({id:m.id,label:m.label,levers:classifications[m.id]??m.levers?.filter(v=>LAW_LEVERS.includes(v))??[],parameters:[...(m.parameters??[])],
 assumptions:(program.assumptions??[]).filter(a=>(m.assumptionIds??[]).includes(a.id)).map(a=>({id:a.id,value:replay?.assumptions?.[a.id]??a.value,unit:a.unit,source:a.source})),
 stages:(m.chain??[]).map(s=>({id:s.id,label:s.label,implementation:s.implementation,condition:s.condition,status:'declared-implementation'})),
 outcomes:(m.metrics??[]).map(id=>{const a=read(before,id),b=read(after,id),available=paired&&Number.isFinite(a)&&Number.isFinite(b);return{id,unit:metricUnits[id]??null,status:available?(b===a?'unchanged':'changed'):'unavailable',baseline:available?a:null,treatment:available?b:null,delta:available?b-a:null};}),limitations:[...(m.limitations??[])]}))};
}
export function renderMechanismTrace(container,report){
 const doc=container.ownerDocument;container.replaceChildren();const node=(tag,text,parent=container)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 node('h3','Law → mechanism → recorded outcome');node('p',report.measured?'Measurements below come from the entered paired run. Intermediate steps describe registered model behavior.':'Compile-time wiring only. Run and enter a future to see recorded measurements.');
 for(const chain of report.chains){const section=node('details','');node('summary',chain.label+' · '+(chain.levers.join(', ')||'lever classification unavailable'),section);node('p','Inputs: '+chain.parameters.join(', '),section);
  for(const a of chain.assumptions)node('p',`${a.id}: ${a.value} ${a.unit??''} · ${a.source??'source unavailable'}`,section);
  const list=node('ol','',section);for(const step of chain.stages)node('li',step.label+' → '+(step.implementation?.file??'implementation unavailable')+' · '+(step.implementation?.symbol??'')+(step.condition?' · '+step.condition:''),list);
  const table=node('table','',section),head=node('tr','',table);for(const label of ['Outcome','Baseline','Policy','Change'])node('th',label,head);
  for(const output of chain.outcomes){const row=node('tr','',table);for(const value of [output.id+(output.unit?' · '+output.unit:''),output.baseline??'Unavailable',output.treatment??'Unavailable',output.delta??'Unavailable'])node('td',String(value),row);}
  for(const limit of chain.limitations)node('small',limit+' ',section);
 }for(const limit of report.limitations)node('small',limit+' ');
}
