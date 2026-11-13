/** A streamed resident/resource-episode incidence graph, not invented pair events.
 * A resource is (district, car-road or transit, 15-minute interval). Union-find
 * measures resident connectivity without materializing quadratic cliques.
 * Presence is sampled at interval end, matching the model's demand accounting.
 */
export function createTransportObserver(population){
 const parent=Int32Array.from({length:population},(_,i)=>i),size=new Uint32Array(population).fill(1);
 let edges=0,resources=0,workTrips=0,workMinutes=0,intervals=0,hash=2166136261;
 const samples=[];
 function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 function union(a,b){a=find(a);b=find(b);if(a===b)return;if(size[a]<size[b])[a,b]=[b,a];parent[b]=a;size[a]+=size[b];}
 function mix(value){for(const c of String(value))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}
 return {
  departure(model,i,plan,best){if(plan.activity===1){workTrips++;workMinutes+=best.minutes;}},
  interval(model,start,end){
   intervals++;const first=new Map(),p=model.people;
   for(let i=0;i<population;i++)if(p.remaining[i]>0&&(p.mode[i]===3||p.mode[i]>=4)){
    const resource=`${p.to[i]}:${p.mode[i]===3?'road':'transit'}`;
    edges++;mix(`${start}/${end}/${resource}/${i};`);
    if(first.has(resource))union(i,first.get(resource));else{first.set(resource,i);resources++;}
    if(samples.length<16)samples.push({personId:`${model.prefix}-p${i}`,districtId:model.districts[p.to[i]].id,resource:resource.split(':')[1],startMinute:start,endMinute:end});
   }
  },
  result(){let largest=population?1:0;for(let i=0;i<population;i++)if(parent[i]===i)largest=Math.max(largest,size[i]);
   return {commute:{meanMinutes:workTrips?workMinutes/workTrips:null,departures:workTrips,unit:'planned minutes per work-bound departure'},
    graph:{schemaVersion:'transport-resource-incidence.v1',residentNodes:population,resourceEpisodeNodes:resources,incidences:edges,
     meanDegree:population+resources?2*edges/(population+resources):null,
     giantComponentResidentShare:population?largest/population:null,crossShardShare:null,
     crossShardStatus:'unavailable: one authoritative runtime; no actual shards',intervals,
     incidenceDigest:hash.toString(16).padStart(8,'0'),digestAlgorithm:'fnv1a32-order-check; not a cryptographic commitment',samples,
     interpretation:'Undirected bipartite resident/resource-episode graph; co-use is a dependency opportunity, not a verified pairwise interaction. Includes isolated residents. End-interval sampling omits trips completed within the interval.'}};
  }
 };
}
