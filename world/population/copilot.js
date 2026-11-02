/** Deterministic record-grounded templates, not AI roleplay. No provider calls. */
const records=entity=>entity?.decisionTrace||entity?.decisions||entity?.decisionHistory||entity?.trace||entity?.traces||entity?.events||[];
const list=value=>Array.isArray(value)?value:[];
export function explainPopulationEntity(entity,{kind='person',question='Why did this happen?'}={}){
 if(!entity)return{available:false,label:'Structured template · no AI',text:'Select an actual synthetic person or household to inspect its recorded decisions.',records:[]};
 const rows=list(records(entity)).slice(-8);
 if(!rows.length)return{available:false,label:'Structured template · no AI',text:`Synthetic ${kind} ${entity.id||''}: no retained decision records are available for this question. No personality or reason has been invented.`,records:[]};
 const keywords=/mov|rent|housing/i.test(question)?/mov|rent|housing|search|burden/i:/work|job|employ/i.test(question)?/work|job|employ|layoff/i:/travel|drive|rail|bus|commut|mode/i.test(question)?/travel|trip|mode|commut|transit/i:null;
 const matches=keywords?rows.filter(row=>keywords.test(JSON.stringify(row))):rows;
 const selected=matches.length?matches:rows;
 return{available:true,label:'Structured template · recorded synthetic decisions, no AI',text:`Synthetic ${kind} ${entity.id||''}: ${matches.length||!keywords?'matching retained decisions':'no matching retained decision; showing recent records'}. The table below reports stored reason codes, chosen alternatives and score data. These model decisions do not describe a real person.`,records:selected};
}
export function explainPopulationAggregate(snapshot,{scope='workforce',districtId}={}){
 if(!snapshot)return{available:false,label:'Structured template · no AI',text:'Wait for an actual behavior snapshot.',records:[]};
 const districts=Array.isArray(snapshot.districts)?snapshot.districts:Object.entries(snapshot.districts||{}).map(([id,value])=>({id,...value}));
 if(scope==='district'){
  const district=districts.find(row=>String(row.id??row.districtId)===String(districtId));
  return district?{available:true,label:'Structured template · district snapshot, no AI',text:`District ${district.name||district.label||district.id}: current recorded aggregate values are shown below. Counts alone do not establish why households moved; inspect retained move events for reasons.`,records:[district,...list(snapshot.events).filter(event=>String(event.districtId??event.toDistrict??event.fromDistrict)===String(districtId)).slice(-6)]}:{available:false,label:'Structured template · no AI',text:'Select a district present in the current snapshot.',records:[]};
 }
 const metrics=snapshot.metrics||snapshot.aggregates||{};
 return{available:true,label:'Structured template · workforce snapshot, no AI',text:'These are actual synthetic workforce/mobility aggregates and retained decision events. A mode share is an outcome, not by itself a causal explanation. Inspect mode-choice utility traces for individual reasons.',records:[metrics,...list(snapshot.events).filter(event=>/mode|trip|work|job|layoff|employ/i.test(String(event.eventType??event.decisionType??event.type))).slice(-6)]};
}
