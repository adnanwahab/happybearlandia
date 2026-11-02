/** Founder coaching reads the existing business ledger; it owns no economy. */
export function entrepreneurMilestones(state){return[
 {id:'launch',label:'Launch an approved company',complete:state?.schemaVersion==='business-state.v1'&&state.def?.approved===true},
 {id:'operate',label:'Operate three periods with cash remaining',complete:Number.isInteger(state?.period)&&state.period>=3&&Number.isFinite(state.cash)&&state.cash>0&&!state.bankrupt},
 {id:'profit',label:'Make cumulative profit positive',complete:Number.isFinite(state?.totalProfit)&&state.totalProfit>0},
];}
