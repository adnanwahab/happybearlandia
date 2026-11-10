/** Bounded backwards traversal of explicitly persisted dependencies only. */
export function explainRecorded(store, runId, targetId, {maxDepth=6,maxNodes=100,maxEdges=200,includeAssociations=false}={}) {
  const target=store.getNode(runId,targetId);
  if(!target)return null;
  const nodes=new Map([[target.id,target]]),edges=new Map(),missing=new Set(),reasons=new Set(),queue=[[target.id,0]],visited=new Set();
  while(queue.length){const [id,depth]=queue.shift();if(visited.has(id))continue;visited.add(id);
    const incoming=store.listEdges(runId,{targetId:id,limit:Math.min(1000,maxEdges+1),...(includeAssociations?{}:{association:false})});
    if(incoming.nextCursor!==null&&incoming.nextCursor!==undefined)reasons.add('edge-limit');
    for(const edge of incoming.items){
      if(!includeAssociations&&edge.relation==='correlates')continue;
      if(depth>=maxDepth){reasons.add('depth-limit');continue;}
      if(edges.size>=maxEdges){reasons.add('edge-limit');break;}
      const source=store.getNode(runId,edge.fromId);
      if(!source){missing.add(edge.fromId);reasons.add('missing-dependency');continue;}
      if(!nodes.has(source.id)&&nodes.size>=maxNodes){reasons.add('node-limit');continue;}
      edges.set(edge.id,edge);nodes.set(source.id,source);queue.push([source.id,depth+1]);
    }
  }
  const evidence=new Map();
  for(const edge of edges.values())for(const id of edge.evidenceIds||[]){const record=store.getNode(runId,id);if(!record){missing.add(id);reasons.add('missing-evidence');}else if(evidence.size<maxNodes)evidence.set(id,record);else reasons.add('evidence-limit');}
  const run=store.getRun(runId);if(run.status==='running'||run.status==='failed')reasons.add('run-'+run.status);
  return {runId,targetId,nodes:[...nodes.values()],evidence:[...evidence.values()],edges:[...edges.values()],incomplete:reasons.size>0,reasons:[...reasons],missingIds:[...missing],includeAssociations,limits:{maxDepth,maxNodes,maxEdges},interpretation:'Recorded model dependencies, not proof of real-world causation.'};
}
