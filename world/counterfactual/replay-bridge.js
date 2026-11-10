/** Uses verified historical replay; never treats a descriptive event as state. */
export function checkpointCloneFromReplay(service){return async(parent,tick)=>{
 const result=await service.stateAt({context:parent.context,targetTick:tick,mode:'verified-recomputation'});
 return {id:result.checkpoint.id,context:{...result.context,tick},state:structuredClone(result.state),hash:result.digest};
};}
