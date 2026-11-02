/** Bind culture to accepted model minutes, never RAF or elapsed wall time. */
export function createLivingCultureClock({createSimulation,context,onUpdate=()=>{}}){
 if(typeof createSimulation!=='function')throw new TypeError('A culture simulation factory is required');
 let simulation=null,runKey=null,lastMinute=null,savedParameters=undefined,destroyed=false;
 function reset(){if(simulation?.snapshot?.().parameters)savedParameters=simulation.snapshot().parameters;simulation?.destroy?.();simulation=null;runKey=null;lastMinute=null;}
 return {
  accept(frame,{active=true}={}){
   if(destroyed||!active)return simulation;
   if(!frame){reset();onUpdate(null);return null;}
   const minute=frame.clock?.minute??frame.minute??frame.time?.minute;
   if(!Number.isFinite(minute)||minute<0)return simulation;
   const nextKey=JSON.stringify([frame.runtime?.id??null,frame.runtime?.revision??frame.generation??0,frame.config?.seed??42,frame.metrics?.syntheticPopulation??frame.config?.population??frame.population??0]);
   if(!simulation||runKey!==nextKey||minute<lastMinute){
    reset();simulation=createSimulation({seed:frame.config?.seed??42,initialMinute:minute,context,parameters:savedParameters,population:{populationCount:frame.metrics?.syntheticPopulation??frame.config?.population??frame.population??0,...(frame.populationComposition??{})}});runKey=nextKey;lastMinute=minute;onUpdate(simulation.snapshot());
   }else if(minute>lastMinute){simulation.stepTo(minute);lastMinute=minute;onUpdate(simulation.snapshot());}
   return simulation;
  },
  getSimulation:()=>simulation,
  reset,
  destroy(){if(destroyed)return;reset();destroyed=true;}
 };
}
