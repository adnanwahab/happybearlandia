import {RISK_LABELS,RISK_COLORS} from './population/household-risk.js';
import {renderHouseholdInterventions} from './household-interventions-view.js';
const money=n=>Number.isFinite(n)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n):'Unknown';
const days=n=>Number.isFinite(n)?`${n.toFixed(1)} days`:'Unknown';
export function renderRiskView(root,{households=[],onFollow=()=>{},source='collected snapshots',context={}}={}){
 const doc=root.ownerDocument;root.replaceChildren();
 const add=(parent,tag,text)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el};
 add(root,'h3','Households at risk');
 add(root,'p',`Based on ${source}. This is a household sample, not a citywide count. Seven consecutive daily payments are required for estimates; 14 for a weekly trend.`);
 const counts={critical:0,watch:0,stable:0,unknown:0};for(const h of households)counts[h.financialRisk?.status||'unknown']++;
 add(root,'p',Object.entries(counts).map(([key,value])=>`${RISK_LABELS[key]}: ${value}`).join(' · '));
 const label=add(root,'label','Show '),filter=doc.createElement('select');filter.setAttribute('aria-label','Household risk filter');for(const [value,text]of [['all','All sampled households'],['risk','High pressure and low buffer'],['unknown','Insufficient history']]){const option=doc.createElement('option');option.value=value;option.textContent=text;filter.append(option)}label.append(filter);
 const wrapper=add(root,'div','');wrapper.style.overflowX='auto';const detail=add(root,'section','');detail.setAttribute('aria-live','polite');detail.dataset.riskDetail='';
 let shown=25;
 function draw(){wrapper.replaceChildren();const rank={critical:0,watch:1,stable:2,unknown:3};const rows=households.filter(h=>filter.value==='all'||(filter.value==='risk'?['critical','watch'].includes(h.financialRisk?.status):!h.financialRisk||h.financialRisk.status==='unknown')).sort((a,b)=>(rank[a.financialRisk?.status||'unknown']-rank[b.financialRisk?.status||'unknown'])||((a.financialRisk?.depletionDays??Infinity)-(b.financialRisk?.depletionDays??Infinity))||a.id.localeCompare(b.id));
  if(!rows.length){add(wrapper,'p',households.length?'No sampled households match this filter.':'No household records in this snapshot. Enable collection and save a population snapshot.');return}
  const table=add(wrapper,'table',''),head=add(table,'tr','');for(const text of ['Household','Pressure','Savings','Expense coverage','Net depletion runway','Trend','Details'])add(head,'th',text);
  for(const household of rows.slice(0,shown)){const risk=household.financialRisk||{status:'unknown'},row=add(table,'tr','');add(row,'td',household.id);const status=add(row,'td',RISK_LABELS[risk.status]);status.style.color=RISK_COLORS[risk.status];add(row,'td',money(risk.savings??household.savings));add(row,'td',risk.sufficient&&risk.meanDailySpending===0?'No recorded spending':days(risk.expenseCoverageDays));add(row,'td',risk.depletionState==='not-depleting'?'Not depleting':days(risk.depletionDays));add(row,'td',risk.trend==='unknown'||!risk.trend?'Needs 14 days':risk.trend);
   const cell=add(row,'td',''),button=add(cell,'button','Inspect household');button.type='button';button.onclick=()=>show(household);
  }
  if(rows.length>shown){const more=add(wrapper,'button',`Show more (${rows.length-shown} remaining)`);more.type='button';more.onclick=()=>{shown+=25;draw()};}
 }
 function show(household){const risk=household.financialRisk||{status:'unknown',drivers:[]};detail.replaceChildren();add(detail,'h4',household.id);add(detail,'p',`${RISK_LABELS[risk.status]} · ${risk.reason||'No payment history collected.'}`);add(detail,'p',`${risk.consecutiveDays||0} consecutive recorded days. Average daily income ${money(risk.meanDailyIncome)}; spending ${money(risk.meanDailySpending)}; balance change ${money(risk.meanDailyNet)}.`);add(detail,'p',`Expense coverage: ${days(risk.expenseCoverageDays)} if income stopped. Net depletion runway: ${risk.depletionState==='not-depleting'?'Savings are not depleting at the recorded rates':days(risk.depletionDays)} with recent income continuing.`);
  if(risk.trend!=='unknown'&&risk.trend)add(detail,'p',`Finances are ${risk.trend}: daily net cash flow changed by ${money(risk.netChangePerDay)} compared with the preceding week.`);else add(detail,'p','A trend requires two complete weeks; changes within $1/day count as steady. Shorter histories do not establish improvement or decline.');
  for(const driver of risk.drivers||[])add(detail,'p',`${driver.label} by ${money(driver.amountPerDay)}/day compared with the prior week.`);
  add(detail,'p','High pressure means exhausted savings or at most seven days of net runway. Low buffer means less than 30 days of expense coverage or at most 30 days of net runway. These are display thresholds for the synthetic model.');
  const follow=add(detail,'button','Follow the money');follow.type='button';follow.onclick=()=>onFollow(household.id);add(detail,'p','Open the recorded payment history to inspect job events, expenses and balance changes. Estimates assume recent rates continue; household taxes are not modeled.');
  const calculator=add(detail,'details','');calculator.dataset.interventionDisclosure='';add(calculator,'summary','What would help this household?');const calculatorRoot=add(calculator,'section','');renderHouseholdInterventions(calculatorRoot,{householdId:household.id,risk,onFollow,source,context});
 }
 filter.onchange=()=>{shown=25;detail.replaceChildren();draw()};draw();
}
