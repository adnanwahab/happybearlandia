// Authored representative data, not output of a social/city simulation.
export function evidencePathFixture() {
  const context = {universeId:'universe:evidence:fixture',worldId:'world:evidence:fixture',scenarioId:'scenario:evidence:fixture',runId:'run:evidence:fixture-v1',seed:744,modelVersion:'evidence-fixture.v1',tick:0};
  const provenance = {id:'provenance:evidence:fixture-v1',modelVersion:context.modelVersion,sourceIds:[],kind:'assumed',source:'Authored synthetic evidence-path fixture v1; no observed sources'};
  const nodes = ['Authored input','Illustrative construction effect','Nonspatial budget decision','Illustrative downstream effect'].map((label,i)=>({id:`event:evidence:${i}`,type:label,context:{...context,tick:i},sequence:i,entityIds:[],payload:{illustrative:true},provenance}));
  const edges = nodes.slice(1).map((node,i)=>({id:`edge:evidence:${i}`,context:{...context,tick:i+1},fromId:nodes[i].id,toId:node.id,relation:'contributes',confidence:1,evidenceIds:[nodes[i].id],provenance}));
  return {data:{runId:context.runId,targetId:nodes[3].id,nodes,edges,evidence:nodes,incomplete:false},mapping:{version:1,frameId:'synthetic-evidence-stage.v1',context,anchors:[{eventId:nodes[0].id,x:0,z:0,provenance},{eventId:nodes[1].id,x:18,z:0,provenance},{eventId:nodes[3].id,x:36,z:18,provenance}]}};
}
