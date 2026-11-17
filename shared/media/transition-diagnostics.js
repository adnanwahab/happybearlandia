// Presentation-only telemetry. No storage, identifiers, model reads or network.
// 60 Hz is an engineering reference, not a measured display refresh rate.
export function createTransitionDiagnostics(win, {maxSamples=20, budgetMs=750, maxGapMs=100}={}) {
  let consent=false, simple=false, disposed=false;
  const samples=[], active=new Set();
  const now=()=>win?.performance?.now?.() ?? Date.now();
  function begin(mode, skip=()=>{}) {
    if(disposed||!consent)return ()=>{};
    const start=now();let previous=start,frames=0,missed=0,worst=0,raf=null,timer=null,ended=false,threshold=false;
    const clear=()=>{if(raf!==null)win.cancelAnimationFrame(raf);if(timer!==null)win.clearTimeout(timer);raf=timer=null;};
    const degrade=()=>{if(!ended&&!threshold){threshold=true;simple=true;skip();}};
    const tick=time=>{
      if(ended)return;
      const gap=Math.max(0,time-previous);previous=time;frames++;worst=Math.max(worst,gap);
      missed+=Math.max(0,Math.round(gap/(1000/60))-1);
      if(gap>maxGapMs)degrade();
      if(!ended)raf=win.requestAnimationFrame(tick);
    };
    const finish=(outcome='completed',retain=true)=>{
      if(ended)return;ended=true;clear();active.delete(finish);
      if(retain&&consent){samples.push({mode,outcome,durationMs:Math.max(0,now()-start),frames,estimatedMissedFrames:missed,maxFrameGapMs:worst,threshold,frameSampling:typeof win?.requestAnimationFrame==='function'?'raf':'unsupported',rendererMemory:null});if(samples.length>maxSamples)samples.shift();}
    };
    active.add(finish);
    if(mode==='native') {
      if(typeof win?.requestAnimationFrame==='function')raf=win.requestAnimationFrame(tick);
      if(typeof win?.setTimeout==='function')timer=win.setTimeout(degrade,budgetMs);
    }
    return finish;
  }
  return {begin, useSimpleMotion:()=>simple,
    setConsent(value){consent=!!value&&!disposed;if(!consent){for(const finish of [...active])finish('cancelled',false);samples.length=0;}},
    get(){return {consent,simpleMotion:simple,active:active.size,samples:samples.map(s=>({...s})),budgetMs,maxGapMs};},
    dispose(){disposed=true;consent=false;for(const finish of [...active])finish('disposed',false);samples.length=0;},
  };
}
