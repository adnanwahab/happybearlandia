import {createEngine,cityMetrics} from './engine.js';
self.onmessage=({data})=>{
  try {
    const engine=createEngine();let state=engine.initialize(data.initial);state.seed=data.seed;
    const steps=[],start=performance.now();
    for(let i=0;i<data.months;i++) {
      const step=engine.step(state);state=step.state;
      if(!data.replay&&data.retention!=='full') {
        for(const decision of step.decisions)decision.alternatives=[];
        if(data.retention==='summary'){step.decisions=[];step.moves=[];step.trips=[];step.flows=[];}
      }
      steps.push(data.replay?{...step,proposals:undefined,resolutions:undefined}:{...step,proposals:undefined,resolutions:undefined,capacities:undefined,state:{month:state.month,systems:state.systems,utilities:state.utilities,facilities:state.facilities,businesses:data.retention==='summary'?[]:state.businesses}});
    }
    self.postMessage({result:{metrics:cityMetrics(state),steps,state:data.replay?state:undefined,durationMs:performance.now()-start,manifest:engine.manifest}});
  }catch(error){self.postMessage({error:error.message});}
};
