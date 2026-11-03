/** Read-only physical rosters, independent of the co-residency command/model cycle. */
export function roommateHome(model,i){const row=model.roommates?.active?.[i];return row?.phase==='resident'?row.hostHH:null;}
export function roommateAtHouse(model,i,h){const row=model.roommates?.active?.[i],p=model.people;return !!row&&row.phase==='resident'&&row.hostHH===h&&!model.visits?.active?.[i]&&p.remaining[i]<=1e-9&&p.current[i]===row.hostHome.home&&Math.hypot(p.x[i]-row.hostHome.homeX,p.z[i]-row.hostHome.homeZ)<1;}
export function roommateIndices(model,h){return Object.entries(model.roommates?.active??{}).filter(([,row])=>row.phase==='resident'&&row.hostHH===h).map(([key])=>Number(key));}
export function physicalHouseMembers(model,h){const financial=Array.from({length:model.households.size[h]},(_,k)=>model.households.start[h]+k).filter(i=>roommateHome(model,i)===null);return[...financial,...roommateIndices(model,h)];}
