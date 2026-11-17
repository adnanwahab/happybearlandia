/** Presentation-only pressure policy; never receives or mutates model state. */
export function createSchedulingGuard() {
  let mode='normal', healthy=0, nextAt=0, sequence=0;
  const transitions=[];
  const cooldown=()=>mode==='reduced'?400:0;
  return {
    record({durationMs,now,tick,revision}) {
      if(!Number.isFinite(durationMs)||durationMs<0||!Number.isFinite(now))return false;
      const previous=mode;
      if(durationMs>=100){mode='reduced';healthy=0;}
      else if(mode==='reduced'){
        healthy=durationMs<=40?healthy+1:0;
        if(healthy>=8){mode='normal';healthy=0;}
      }
      nextAt=now+cooldown();
      if(mode!==previous){
        transitions.push({sequence:++sequence,from:previous,to:mode,reason:mode==='reduced'?'commit-pressure':'sustained-recovery',durationMs,realTimeMs:now,tick,revision});
        if(transitions.length>64)transitions.shift();
      }
      return true;
    },
    allows(now){return now>=nextAt;},
    getSnapshot(){return {policyVersion:'population-scheduling.v1',mode,cooldownMs:cooldown(),transitionCount:sequence,transitions:structuredClone(transitions)};}
  };
}
