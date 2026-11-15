/** Mapped sidewalks, in world metres. Synthetic access/crossing assumptions:
 * 9m carriageway + 2m sidewalks, matching the road renderer. Junction crossings
 * connect sidewalk ends; a 2% seeded mid-block crossing is allowed per trip.
 * Disconnected/missing maps retain a labelled straight-line fallback.
 */
export const PEDESTRIAN_RULES_VERSION='sidewalks.v1';
const OFFSET=6, TRIM=6.5, CELL=128;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function buildPedestrianNetwork(roads=[]){
 const segments=[];
 for(const road of roads)for(let i=1;i<(road.pts?.length||0);i++){
  const a=road.pts[i-1],b=road.pts[i];if(!Array.isArray(a)||!Array.isArray(b)||![...a,...b].every(Number.isFinite))continue;
  const length=distance(a,b);if(length>.1)segments.push({a:[...a],b:[...b],length,cuts:[0,1]});
 }
 const cells=new Map(),pairs=new Set();
 segments.forEach((s,i)=>{for(let x=Math.floor(Math.min(s.a[0],s.b[0])/CELL);x<=Math.floor(Math.max(s.a[0],s.b[0])/CELL);x++)for(let z=Math.floor(Math.min(s.a[1],s.b[1])/CELL);z<=Math.floor(Math.max(s.a[1],s.b[1])/CELL);z++){const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}});
 for(const ids of cells.values())for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const ai=Math.min(ids[i],ids[j]),bi=Math.max(ids[i],ids[j]),key=ai+':'+bi;if(pairs.has(key))continue;pairs.add(key);
  const a=segments[ai],b=segments[bi],u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]],den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-8)continue;
  const d=[b.a[0]-a.a[0],b.a[1]-a.a[1]],t=(d[0]*v[1]-d[1]*v[0])/den,q=(d[0]*u[1]-d[1]*u[0])/den;
  if(t>=0&&t<=1&&q>=0&&q<=1){a.cuts.push(t);b.cuts.push(q);}
 }
 const nodes=[],edges=[],lanes=[],junctions=new Map();
 const node=point=>{nodes.push(point);edges.push([]);return nodes.length-1;};
 const join=(a,b,crossing=false)=>{const length=distance(nodes[a],nodes[b]);edges[a].push({to:b,length,crossing});edges[b].push({to:a,length,crossing});};
 const junction=(center,id)=>{const key=center.map(v=>v.toFixed(2)).join(':');if(!junctions.has(key))junctions.set(key,{center,ids:[]});junctions.get(key).ids.push(id);};
 for(const s of segments){const cuts=[...new Set(s.cuts.map(v=>Math.round(v*1e9)/1e9))].sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){const a=mix(s.a,s.b,cuts[i-1]),b=mix(s.a,s.b,cuts[i]),length=distance(a,b);if(length<.1)continue;
   const block=lanes.length/2,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,trim=Math.min(TRIM,length*.2);
   for(const side of[-1,1]){const from=[a[0]+ux*trim-uz*OFFSET*side,a[1]+uz*trim+ux*OFFSET*side],to=[b[0]-ux*trim-uz*OFFSET*side,b[1]-uz*trim+ux*OFFSET*side],start=node(from),end=node(to);join(start,end);lanes.push({start,end,a:from,b:to,block,side});junction(a,start);junction(b,end);}
  }
 }
 // Connect adjacent sidewalk ends around each junction. Short corner links
 // turn the corner; longer links cross a carriageway at its junction boundary.
 for(const {center,ids}of junctions.values()){
  ids.sort((a,b)=>Math.atan2(nodes[a][1]-center[1],nodes[a][0]-center[0])-Math.atan2(nodes[b][1]-center[1],nodes[b][0]-center[0])||a-b);
  for(let i=0;i<ids.length;i++)if(ids.length>1){const a=ids[i],b=ids[(i+1)%ids.length];if(i===1&&ids.length===2)continue;join(a,b,distance(nodes[a],nodes[b])>OFFSET);}
 }
 return{rulesVersion:PEDESTRIAN_RULES_VERSION,nodes,edges,lanes};
}
function project(point,lane){const dx=lane.b[0]-lane.a[0],dz=lane.b[1]-lane.a[1],t=Math.max(0,Math.min(1,((point[0]-lane.a[0])*dx+(point[1]-lane.a[1])*dz)/(dx*dx+dz*dz)));const at=mix(lane.a,lane.b,t);return{at,t,distance:distance(at,point),lane};}
// Derived lookup only: the mapped geometry and exhaustive-scan tie order are
// unchanged. AABB pruning avoids allocating a projection for every lane.
const nearestLookups=new WeakMap();
function laneTree(rows){
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const {lane} of rows){minX=Math.min(minX,lane.a[0],lane.b[0]);maxX=Math.max(maxX,lane.a[0],lane.b[0]);minZ=Math.min(minZ,lane.a[1],lane.b[1]);maxZ=Math.max(maxZ,lane.a[1],lane.b[1]);}
 const node={minX,minZ,maxX,maxZ};if(rows.length<=8){node.rows=rows;return node;}
 const axis=maxX-minX>=maxZ-minZ?0:1;rows.sort((a,b)=>(a.lane.a[axis]+a.lane.b[axis])-(b.lane.a[axis]+b.lane.b[axis])||a.index-b.index);const mid=rows.length>>1;node.left=laneTree(rows.slice(0,mid));node.right=laneTree(rows.slice(mid));return node;
}
function nearest(network,point){
 let lookup=nearestLookups.get(network);if(!lookup){lookup={tree:laneTree(network.lanes.map((lane,index)=>({lane,index}))),points:new Map()};nearestLookups.set(network,lookup);}
 const key=point[0]+':'+point[1];if(lookup.points.has(key))return lookup.points.get(key);
 let bestDistance=Infinity,bestIndex=Infinity,bestLane;
 const bound=node=>Math.hypot(Math.max(node.minX-point[0],0,point[0]-node.maxX),Math.max(node.minZ-point[1],0,point[1]-node.maxZ));
 function visit(node){if(bound(node)>bestDistance+1e-9)return;if(node.rows){for(const {lane,index} of node.rows){const dx=lane.b[0]-lane.a[0],dz=lane.b[1]-lane.a[1],t=Math.max(0,Math.min(1,((point[0]-lane.a[0])*dx+(point[1]-lane.a[1])*dz)/(dx*dx+dz*dz))),x=lane.a[0]+dx*t,z=lane.a[1]+dz*t,d=Math.hypot(x-point[0],z-point[1]);if(d<bestDistance||d===bestDistance&&index<bestIndex){bestDistance=d;bestIndex=index;bestLane=lane;}}return;}
  if(bound(node.left)<=bound(node.right)){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
 }
 visit(lookup.tree);const result=project(point,bestLane);lookup.points.set(key,result);if(lookup.points.size>4096)lookup.points.delete(lookup.points.keys().next().value);return result;
}
// Resume an exact source search across candidate destinations rather than
// discarding the frontier after each target. Heap comparisons and relaxation
// arithmetic match the target-limited search. Cache includes cost/predecessor
// arrays AND retained frontier capacity, bounded by 32 MiB and 2048 origins.
const shortestLookups=new WeakMap();
function shortest(network,start,end){
 let lookup=shortestLookups.get(network);if(!lookup){lookup={trees:new Map(),bytes:0};shortestLookups.set(network,lookup);}
 const key=[start.lane.start,start.lane.end,...start.at].join(':');let tree=lookup.trees.get(key),fresh=!tree;
 if(fresh){const n=network.nodes.length;tree={cost:new Float64Array(n).fill(Infinity),previous:new Int32Array(n).fill(-1),values:new Float64Array(64),ids:new Int32Array(64),size:0,bytes:0};}
 const {cost,previous}=tree;
 function push(value,id){if(tree.size===tree.values.length){const values=new Float64Array(tree.size*2),ids=new Int32Array(tree.size*2);values.set(tree.values);ids.set(tree.ids);tree.values=values;tree.ids=ids;}let i=tree.size++;while(i){const p=(i-1)>>1;if(tree.values[p]<=value)break;tree.values[i]=tree.values[p];tree.ids[i]=tree.ids[p];i=p;}tree.values[i]=value;tree.ids[i]=id;}
 if(fresh)for(const id of[start.lane.start,start.lane.end]){cost[id]=distance(start.at,network.nodes[id]);push(cost[id],id);}
 let targetCost=end?Math.min(cost[end.lane.start]+distance(end.at,network.nodes[end.lane.start]),cost[end.lane.end]+distance(end.at,network.nodes[end.lane.end])):Infinity;
 while(tree.size&&tree.values[0]<targetCost){const value=tree.values[0],id=tree.ids[0];tree.size--;const lastValue=tree.values[tree.size],lastId=tree.ids[tree.size];if(tree.size){let i=0;while(i*2+1<tree.size){let c=i*2+1;if(c+1<tree.size&&tree.values[c+1]<tree.values[c])c++;if(tree.values[c]>=lastValue)break;tree.values[i]=tree.values[c];tree.ids[i]=tree.ids[c];i=c;}tree.values[i]=lastValue;tree.ids[i]=lastId;}
  if(value!==cost[id])continue;if(end&&(id===end.lane.start||id===end.lane.end))targetCost=Math.min(targetCost,value+distance(end.at,network.nodes[id]));for(const edge of network.edges[id]){const next=value+edge.length;if(next+1e-9<cost[edge.to]){cost[edge.to]=next;previous[edge.to]=id;push(next,edge.to);}}
 }
 const bytes=cost.byteLength+previous.byteLength+tree.values.byteLength+tree.ids.byteLength+key.length*2+160;if(bytes<=32*1024*1024){lookup.bytes+=bytes-tree.bytes;tree.bytes=bytes;lookup.trees.set(key,tree);while(lookup.bytes>32*1024*1024||lookup.trees.size>2048){const oldest=lookup.trees.keys().next().value;lookup.bytes-=lookup.trees.get(oldest).bytes;lookup.trees.delete(oldest);}}else if(lookup.trees.has(key)){lookup.bytes-=tree.bytes;lookup.trees.delete(key);}
 if(!end)return null;
 let endId=end.lane.start;if(cost[end.lane.end]+distance(end.at,network.nodes[end.lane.end])<cost[endId]+distance(end.at,network.nodes[endId]))endId=end.lane.end;
 if(!Number.isFinite(cost[endId]))return null;const ids=[];for(let id=endId;id!==-1;id=previous[id])ids.push(id);ids.reverse();return ids.map(id=>network.nodes[id]);
}
const routeCaches=new WeakMap();
export function pedestrianRoute(network,from,to,{jaywalk=false}={}){
 const fallback=reason=>({rulesVersion:PEDESTRIAN_RULES_VERSION,kind:'straight-line fallback',reason,points:[[...from],[...to]],distanceMetres:distance(from,to)});
 if(!network?.lanes?.length)return fallback('No mapped sidewalk network');
 let cache=routeCaches.get(network);if(!cache){cache=new Map();cache.retainedBytes=0;routeCaches.set(network,cache);}const key=[...from,...to,Number(jaywalk)].join(':');if(cache.has(key))return cache.get(key);
 const a=nearest(network,from),b=nearest(network,to);let middle;
 if(a.lane===b.lane)middle=[];else middle=shortest(network,a,b);
 if(middle===null)return fallback('Mapped sidewalks are disconnected');
 // A rare crossing connects opposite sidewalks of the same block directly.
 if(jaywalk&&a.lane.block===b.lane.block&&distance(a.at,b.at)<40)middle=[];
 const points=[[...from],a.at,...middle,b.at,[...to]].filter((p,i,all)=>!i||distance(p,all[i-1])>1e-6),distanceMetres=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
 const route={rulesVersion:PEDESTRIAN_RULES_VERSION,kind:'mapped-sidewalk',jaywalk:jaywalk&&middle.length===0&&a.lane!==b.lane,points,distanceMetres};const bytes=256+key.length*2+points.length*64;if(bytes<=4*1024*1024){cache.set(key,route);cache.retainedBytes+=bytes;while(cache.size>4096||cache.retainedBytes>4*1024*1024){const oldest=cache.keys().next().value,entry=cache.get(oldest);cache.retainedBytes-=256+oldest.length*2+entry.points.length*64;cache.delete(oldest);}}return route;
}
export function pointOnPedestrianRoute(route,progress){
 const points=route?.points;if(!points?.length)return null;let remaining=Math.max(0,Math.min(1,progress))*route.distanceMetres;
 for(let i=1;i<points.length;i++){const length=distance(points[i-1],points[i]);if(remaining<=length||i===points.length-1){const point=mix(points[i-1],points[i],length?Math.min(1,remaining/length):0);return{x:point[0],z:point[1],heading:Math.atan2(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])};}remaining-=length;}
 return{x:points[0][0],z:points[0][1],heading:0};
}

/** Warm derived routing only. Never advances a model or consumes its RNG. */
export function warmPedestrianSource(network,from){if(!network?.lanes?.length)return;shortest(network,nearest(network,from),null);}
export function pedestrianCacheStats(network){const sources=shortestLookups.get(network),routes=routeCaches.get(network);return{sourceTrees:sources?.trees.size??0,sourceBytes:sources?.bytes??0,sourceBudgetBytes:32*1024*1024,routeEntries:routes?.size??0,routeEstimatedBytes:routes?.retainedBytes??0,routeBudgetBytes:4*1024*1024,projectionEntries:nearestLookups.get(network)?.points.size??0};}
