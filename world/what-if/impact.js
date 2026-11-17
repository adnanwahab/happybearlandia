// Pure projection of one neighborhood-what-if.v1 receipt, never a welfare score.
const units = {commute:'min', burden:'pp', access:'pp'};
const compareId = (a,b) => a < b ? -1 : a > b ? 1 : 0;
export function neighborhoodImpact(receipt, metric) {
  if(receipt?.version!=='neighborhood-what-if.v1' || !Array.isArray(receipt.residents))throw Error('Neighborhood comparison receipt required.');
  if(!Object.hasOwn(units,metric))throw Error('Unsupported neighborhood metric.');
  const groups=new Map(),seen=new Set();let unmapped=0;
  // Sorting also fixes floating-point summation order when a receipt is reordered.
  for(const resident of [...receipt.residents].sort((a,b)=>compareId(a.id,b.id))) {
    if(typeof resident.id!=='string'||seen.has(resident.id))throw Error('Unique resident IDs required.');
    seen.add(resident.id);
    const id=resident.before?.districtId ?? resident.before?.district;
    if(typeof id!=='string'||!id){unmapped++;continue;}
    if(!groups.has(id))groups.set(id,{id,label:resident.before.district||id,total:0,included:0,excluded:0,baseline:0,plan:0,delta:0});
    const row=groups.get(id);row.total++;
    const a=resident.before?.[metric],b=resident.after?.[metric];
    if(resident.before?.id!==resident.id||resident.after?.id!==resident.id||!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(b-a)){row.excluded++;continue;}
    row.included++;row.baseline+=a;row.plan+=b;row.delta+=b-a;
  }
  const rows=[],excluded=[];
  for(const row of groups.values()) {
    if(!row.included){excluded.push({...row,baseline:null,plan:null,delta:null,reason:'No matched finite measurements'});continue;}
    const scale=metric==='commute'?1:100;
    row.baseline=row.baseline/row.included*scale;row.plan=row.plan/row.included*scale;row.delta=row.delta/row.included*scale;
    if(![row.baseline,row.plan,row.delta].every(Number.isFinite))throw Error('Neighborhood aggregate overflow.');
    rows.push(row);
  }
  rows.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||compareId(a.id,b.id));
  excluded.sort((a,b)=>compareId(a.id,b.id));
  return {metric,unit:units[metric],rows,excluded,unmapped};
}
