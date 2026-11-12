// Reference and experimental exact top-k selectors; never mutate model arrays.
export function candidates(people,view){return Array.from({length:people.age.length},(_,index)=>({index,score:(people.x[index]-view.x)**2+(people.z[index]-view.z)**2+(people.activity[index]===8?0:1e12)}));}
export const compare=(a,b)=>a.score-b.score||a.index-b.index;
export function fullSort(people,limit,view){return candidates(people,view).sort(compare).slice(0,limit).map(r=>r.index);}
export function insertion(people,limit,view){const best=[];for(const row of candidates(people,view)){let lo=0,hi=best.length;while(lo<hi){const mid=(lo+hi)>>>1;if(compare(best[mid],row)<0)lo=mid+1;else hi=mid;}if(lo<limit){best.splice(lo,0,row);if(best.length>limit)best.pop();}}return best.map(r=>r.index);}
export function partition(people,limit,view){const rows=candidates(people,view);let left=0,right=rows.length-1;while(left<right){const pivot=rows[(left+right)>>>1];let i=left,j=right;while(i<=j){while(compare(rows[i],pivot)<0)i++;while(compare(rows[j],pivot)>0)j--;if(i<=j){[rows[i],rows[j]]=[rows[j],rows[i]];i++;j--;}}if(limit-1<=j)right=j;else if(limit-1>=i)left=i;else break;}return rows.slice(0,limit).sort(compare).map(r=>r.index);}

/** Worker-only display sampling. This never moves or creates a model person. */
export function heap(people,limit,view){
 const n=people.age.length,count=Math.min(n,Math.max(0,Math.floor(limit)));
 if(!count)return [];
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.z))return Array.from({length:count},(_,k)=>Math.floor(k*n/count));
 // Actual traveling people are outside; prioritize those nearest the camera's
 // ground target rather than spending the render budget on hidden homes.
 // Retain only the best display candidates in a max heap. The root is
 // the worst retained row; index breaks equal-distance ties as before.
 const heap=[];
 const worse=(a,b)=>a.score>b.score||(a.score===b.score&&a.index>b.index);
 for(let index=0;index<n;index++){
  const score=(people.x[index]-view.x)**2+(people.z[index]-view.z)**2+(people.activity[index]===8?0:1e12);
  const row={index,score};
  if(heap.length<count){
   heap.push(row);let child=heap.length-1;
   while(child){const parent=(child-1)>>>1;if(!worse(heap[child],heap[parent]))break;[heap[child],heap[parent]]=[heap[parent],heap[child]];child=parent;}
  }else if(worse(heap[0],row)){
   heap[0]=row;let parent=0;
   for(;;){let child=parent*2+1;if(child>=count)break;if(child+1<count&&worse(heap[child+1],heap[child]))child++;if(!worse(heap[child],heap[parent]))break;[heap[parent],heap[child]]=[heap[child],heap[parent]];parent=child;}
  }
 }
 return heap.sort((a,b)=>a.score-b.score||a.index-b.index).map(row=>row.index);
}
