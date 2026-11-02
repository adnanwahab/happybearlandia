/** Worker-only display sampling. This never moves or creates a model person. */
export function selectVisibleIndices(people,limit,view){
 const n=people.age.length,count=Math.min(n,Math.max(0,Math.floor(limit)));
 if(!count)return [];
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.z))return Array.from({length:count},(_,k)=>Math.floor(k*n/count));
 // Actual traveling people are outside; prioritize those nearest the camera's
 // ground target rather than spending the render budget on hidden homes.
 const candidates=Array.from({length:n},(_,index)=>({index,score:(people.x[index]-view.x)**2+(people.z[index]-view.z)**2+(people.activity[index]===8?0:1e12)}));
 candidates.sort((a,b)=>a.score-b.score||a.index-b.index);
 return candidates.slice(0,count).map(row=>row.index);
}
