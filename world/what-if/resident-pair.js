// Select recorded observations only. Never resolve a missing ID by index or
// borrow a person from another simulation authority.
export function selectResidentPair(result, ids) {
  return ids.map(value => {
    const id=String(value ?? '').trim();
    const resident=result?.residents?.find(row=>row.id===id);
    if(!resident)return {id,resident:null,message:'Resident unavailable in this recorded comparison. No outcome was inferred.'};
    if(resident.before?.id!==id||resident.after?.id!==id)return {id,resident:null,message:'Resident identity does not match across both arms. No comparison is available.'};
    return {id,resident};
  });
}
