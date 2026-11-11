// Pure presentation adapter. Outcomes remain the last recorded monthly state.
export function constructionFrame(run, projectId, month) {
 if(!Number.isFinite(month)||month<0)throw new RangeError('Invalid month');
 const rows=[...(run?.projects?.find(p=>p.projectId===projectId)?.states||[])].sort((a,b)=>a.month-b.month);
 const from=rows.filter(s=>s.month<=month).at(-1),to=rows.find(s=>s.month>month);
 if(!from)return {recorded:null,visual:null,label:'No recorded state available'};
 const alpha=to?(month-from.month)/(to.month-from.month):0,visual={};
 for(const key of ['progress','floorsBuilt'])visual[key]=Number.isFinite(from[key])?from[key]+(Number.isFinite(to?.[key])?alpha*(to[key]-from[key]):0):null;
 return {recorded:{...from},visual,alpha,fromMonth:from.month,toMonth:to?.month??from.month,label:'Visual interpolation only; outcomes reflect the last recorded month'};
}
export function forkFrame({parent,fork,forkMonth,month,projectId}) {
 if(!Number.isFinite(forkMonth)||forkMonth<0)throw new RangeError('Invalid fork month');
 const original=constructionFrame(parent,projectId,month),prefixFixed=month<=forkMonth;
 return {original,branch:prefixFixed?original:constructionFrame(fork,projectId,month),prefixFixed};
}
