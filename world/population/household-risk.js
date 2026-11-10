/** Descriptive simulation diagnostics. Seven daily settlements for estimates;
 * two full weeks for change comparisons. No projected policy effects. */
export const RISK_WINDOW_DAYS=14;
export const RISK_COLORS={critical:'#f07178',watch:'#e9b96b',stable:'#6de2b8',unknown:'#99a6b5'};
export const RISK_LABELS={critical:'High pressure',watch:'Low buffer',stable:'Buffered',unknown:'Insufficient history'};
export function compactSettlement(record){
 const totals={};for(const entry of record.entries||[])totals[entry.category]=(totals[entry.category]||0)+entry.amount;
 const amounts=Object.values(totals),net=amounts.reduce((sum,value)=>sum+value,0);
 return{minute:record.minute,periodStartMinute:record.periodStartMinute??null,openingSavings:record.openingSavings,closingSavings:record.closingSavings,income:amounts.filter(v=>v>0).reduce((a,b)=>a+b,0),spending:-amounts.filter(v=>v<0).reduce((a,b)=>a+b,0),wages:totals.wages||0,rent:-(totals.rent||0),childcare:-(totals.childcare||0),reconciled:Number.isFinite(net)&&Math.abs(record.closingSavings-record.openingSavings-net)<.01};
}
function valid(row){return row&&['minute','periodStartMinute','openingSavings','closingSavings','income','spending','wages','rent','childcare'].every(key=>Number.isFinite(row[key]))&&row.minute-row.periodStartMinute===1440&&row.reconciled&&row.income>=0&&row.spending>=0;}
const average=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
export function cashFlowIndicators(savings,income,spending){
 if(![savings,income,spending].every(Number.isFinite)||income<0||spending<0)throw new Error('Cash flow requires finite savings and nonnegative income and spending.');
 const net=income-spending;
 return{meanDailyIncome:income,meanDailySpending:spending,meanDailyNet:net,expenseCoverageDays:spending>0?Math.max(0,savings)/spending:null,depletionDays:net< -1e-9?Math.max(0,savings)/-net:null,depletionState:net< -1e-9?'depleting':'not-depleting'};
}
export function analyzeHouseholdRisk(records=[],{savings,asOfMinute}={}){
 const sorted=[...new Map(records.map(row=>[row.minute,row.entries?compactSettlement(row):row])).values()].sort((a,b)=>a.minute-b.minute);
 const latest=sorted.at(-1),now=asOfMinute??latest?.minute??0;
 const fresh=Boolean(latest&&now>=latest.minute&&now-latest.minute<1440);
 const balance=Number.isFinite(savings)?savings:fresh&&Number.isFinite(latest?.closingSavings)?latest.closingSavings:null;
 const recent=[];
 for(let i=sorted.length-1;i>=0&&recent.length<RISK_WINDOW_DAYS;i--){const row=sorted[i],next=recent[0];if(!valid(row)||(next&&(next.minute-row.minute!==1440||Math.abs(next.openingSavings-row.closingSavings)>.01)))break;recent.unshift(row);}
 const sufficient=Boolean(fresh&&recent.length>=7);
 const result={status:balance!==null&&balance<=0?'critical':'unknown',savings:balance,consecutiveDays:recent.length,sufficient,asOfMinute:now,lastPaymentMinute:latest?.minute??null,meanDailyIncome:null,meanDailySpending:null,meanDailyNet:null,meanDailyWages:null,meanDailyRent:null,meanDailyChildcare:null,evidence:null,expenseCoverageDays:null,depletionDays:null,depletionState:'unknown',trend:'unknown',drivers:[],reason:!fresh?'No current daily payment history.':recent.length<7?'Need seven consecutive, reconciled daily payments. Partial days and legacy records without a recorded interval are excluded.':'',basis:'Recorded synthetic household payments. Estimates assume recent income and spending continue; household taxes are not modeled.'};
 if(!sufficient){if(balance!==null&&balance<=0)result.reason='Savings are exhausted. '+result.reason;return result;}
 const week=recent.slice(-7),income=average(week,'income'),spending=average(week,'spending'),net=income-spending;
 Object.assign(result,cashFlowIndicators(balance,income,spending),{meanDailyWages:average(week,'wages'),meanDailyRent:average(week,'rent'),meanDailyChildcare:average(week,'childcare'),evidence:{startMinute:week[0].periodStartMinute,endMinute:week.at(-1).minute,days:7}});
 if(balance===null)result.status='unknown';
 else if(balance<=0||(result.depletionDays!==null&&result.depletionDays<=7))result.status='critical';
 else if((result.depletionDays!==null&&result.depletionDays<=30)||(result.expenseCoverageDays!==null&&result.expenseCoverageDays<30))result.status='watch';
 else result.status='stable';
 result.reason=result.status==='critical'?(balance<=0?'Savings are exhausted.':'Savings would run out within seven days at the recorded net outflow.'):result.status==='watch'?'Savings cover less than 30 days of expenses, or net outflow would exhaust savings within 30 days.':'Savings exceed the low-buffer thresholds at the recorded payment rates.';
 if(recent.length>=14){const previous=recent.slice(-14,-7),change=net-(average(previous,'income')-average(previous,'spending'));result.trend=change>1?'improving':change< -1?'worsening':'steady';result.netChangePerDay=change;
  for(const [key,label,sign]of [['wages','Wages fell',-1],['rent','Rent rose',1],['childcare','Childcare costs rose',1]]){const delta=(average(week,key)-average(previous,key))*sign;if(delta>1)result.drivers.push({key,label,amountPerDay:delta});}
  result.drivers.sort((a,b)=>b.amountPerDay-a.amountPerDay);
 }
 return result;
}
export function modelHouseholdRisk(model,h){return analyzeHouseholdRisk(model.moneyHistory?.recent?.[h]||[],{savings:model.households.savings[h],asOfMinute:model.minute});}
