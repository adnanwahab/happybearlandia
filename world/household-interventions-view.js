import {compareHouseholdInterventions,DEFAULT_INTERVENTIONS} from './population/household-interventions.js';

const money=n=>new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Math.abs(n)<.005?0:n);
const runway=scenario=>scenario.depletionState==='not-depleting'?'Not depleting':`${scenario.depletionDays.toFixed(1)} days`;

export function renderHouseholdInterventions(root,{householdId,risk,onFollow=()=>{},source='collected snapshots',context={}}={}){
 const doc=root.ownerDocument;
 const add=(parent,tag,text)=>{const node=doc.createElement(tag);node.textContent=text;parent.append(node);return node};
 root.replaceChildren();root.dataset.householdInterventions='';
 add(root,'h4','What would help this household?');
 add(root,'p',`Adjust the example percentages to compare arithmetic scenarios using the latest seven complete payment days from ${source}. Work schedules, employment, benefits, prices and behavior are held constant.`);
 const evidence=add(root,'p',''),form=add(root,'form','');form.setAttribute('aria-label','Household intervention calculator');form.style.display='grid';form.style.gridTemplateColumns='repeat(auto-fit,minmax(190px,1fr))';form.style.gap='12px';form.onsubmit=event=>event.preventDefault();
 const fields={};
 for(const [key,label]of [['rentReductionPct','Rent reduction (%)'],['childcareSubsidyPct','Childcare subsidy (%)'],['wageIncreasePct','Wage increase (%)'],['horizonDays','Projection days']]){
  const wrap=add(form,'label',`${label} `),input=doc.createElement('input');wrap.style.display='flex';wrap.style.flexDirection='column';wrap.style.gap='6px';input.type='number';input.min=key==='horizonDays'?'1':'0';input.max=key==='horizonDays'?'365':'100';input.step='1';input.value=String(DEFAULT_INTERVENTIONS[key]);input.style.width='100%';input.style.boxSizing='border-box';input.setAttribute('aria-label',label);wrap.append(input);fields[key]=input;
 }
 const status=add(root,'p','');status.setAttribute('role','status');const results=add(root,'div','');results.style.overflowX='auto';
 const costs=add(root,'p',''),notes=add(root,'p',''),chartBox=add(root,'div','');
 const payments=add(root,'button','View supporting payments');payments.type='button';payments.onclick=()=>onFollow(householdId);
 root.append(doc.createTextNode(' '));const download=add(root,'button','Export scenario JSON');download.type='button';
 let comparison=null;
 function update(){
  results.replaceChildren();chartBox.replaceChildren();costs.textContent='';notes.textContent='';download.disabled=true;
  try{
   const values=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()===''?NaN:Number(input.value)]));comparison=compareHouseholdInterventions(risk,values);
   if(!comparison.available){status.textContent=`Estimates unavailable: ${comparison.reason}`;return}
   const {baseline,scenarios,controls}=comparison,combined=scenarios.at(-1);
   evidence.textContent=`Recorded daily averages: wages ${money(baseline.wages)}, rent ${money(baseline.rent)}, household-paid childcare ${money(baseline.childcare)}. Current savings ${money(baseline.savings)}.${comparison.evidence?` Evidence: Day ${comparison.evidence.startMinute/1440}–${comparison.evidence.endMinute/1440} (${comparison.evidence.days} complete days).`:''}`;
   const table=add(results,'table','');table.setAttribute('aria-label','Household intervention comparison');const head=add(table,'tr','');
   for(const text of ['Scenario','Daily net cash flow','Savings runway',`Savings after ${controls.horizonDays} days`,`Added household resources over ${controls.horizonDays} days`])add(head,'th',text);
   for(const scenario of scenarios){const row=add(table,'tr','');row.dataset.scenario=scenario.id;for(const value of [scenario.label,money(scenario.meanDailyNet),runway(scenario),money(scenario.projectedSavings),money(scenario.addedResources)])add(row,'td',value);}
   status.textContent=combined.canCoverExpenses?`Combined support covers recorded expenses, with ${money(combined.meanDailyNet)}/day remaining.`:`Combined support leaves a ${money(comparison.remainingDailyGap)}/day gap. Savings runway: ${runway(combined)}.`;
   costs.textContent=`Combined scenario over ${controls.horizonDays} days: government childcare subsidy ${money(combined.costs.publicSubsidy)}; added employer payroll ${money(combined.costs.employerPayrollIncrease)}; rent forgone by landlords ${money(combined.costs.landlordRentForgone)}. These amounts equal the added household resources; they are different funding sources.`;
   notes.textContent=`${baseline.wages===0?'No wages were received in the baseline week, so a percentage wage increase adds $0.00. ':''}${baseline.childcare===0?'No household-paid childcare was recorded, so the childcare subsidy adds $0.00. ':''}Amounts apply to this single synthetic household. Projections keep daily averages fixed. Household taxes, payroll taxes, administration, business viability and wider market effects are outside this calculation. Negative projected savings indicate an uncovered deficit.`;
   drawProjection(chartBox,baseline.savings,scenarios[0].projectedSavings,combined.projectedSavings,controls.horizonDays);
   download.disabled=false;
  }catch(error){comparison=null;status.textContent=error.message;}
 }
 for(const input of Object.values(fields))input.oninput=update;
 const initial=compareHouseholdInterventions(risk);
 if(!initial.available){for(const input of Object.values(fields))input.disabled=true;}
 download.onclick=()=>{if(!comparison?.available)return;const blob=new Blob([JSON.stringify({...comparison,householdId,source,context},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='household-intervention-scenario.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 update();
}

function drawProjection(root,opening,baseline,combined,days){
 const doc=root.ownerDocument,ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 190');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Linear savings projection over ${days} days: recorded baseline versus combined support`);svg.style.width='100%';svg.style.maxWidth='760px';
 const min=Math.min(0,opening,baseline,combined),max=Math.max(1,opening,baseline,combined),y=value=>150-(value-min)/Math.max(1,max-min)*120;
 const line=(a,b,color,dash)=>{const node=doc.createElementNS(ns,'line');node.setAttribute('x1','30');node.setAttribute('x2','610');node.setAttribute('y1',String(y(a)));node.setAttribute('y2',String(y(b)));node.setAttribute('stroke',color);node.setAttribute('stroke-width','3');if(dash)node.setAttribute('stroke-dasharray',dash);svg.append(node)};
 line(0,0,'#647780','3 5');line(opening,baseline,'#e9b96b','8 5');line(opening,combined,'#6de2b8');
 for(const [x,text]of [[30,'Today'],[520,`+${days} days`]]){const label=doc.createElementNS(ns,'text');label.setAttribute('x',String(x));label.setAttribute('y','180');label.setAttribute('fill','currentColor');label.textContent=text;svg.append(label)}
 root.append(svg);const caption=doc.createElement('p');caption.textContent=`Linear savings projection: amber dashed = baseline (${money(baseline)}); green = combined support (${money(combined)}). The dotted line is zero savings.`;root.append(caption);
}
