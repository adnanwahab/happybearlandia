import {constructionFrame, forkFrame} from './index.js';

export function createRecordedPlayback({run, parent=null, forkMonth=0, projectId, endMonth, onFrame, onCue=()=>{}, requestFrame=cb=>requestAnimationFrame(cb), cancelFrame=id=>cancelAnimationFrame(id), motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}) {
  if(!Number.isFinite(endMonth)||endMonth<0)throw new RangeError('Invalid recorded horizon');
  let month=0, speed=1, playing=false, disposed=false, handle=null, last=null, reduced=Boolean(motion?.matches), generation=0;
  const eventsAt=(source,t)=> (source?.events||[]).filter(e=>Number.isFinite(e.month)&&e.month<=t&&e.type==='STRESS_PRESET_STARTED');
  const visibleEvents=()=>parent ? [...eventsAt(parent,Math.min(month,forkMonth)),...eventsAt(run,month).filter(e=>e.month>forkMonth)] : eventsAt(run,month);
  function emit(){if(disposed)return;const frame=parent?forkFrame({parent,fork:run,forkMonth,month,projectId}):constructionFrame(run,projectId,month);if(reduced){for(const f of parent?[frame.original,frame.branch]:[frame])if(f.recorded)f.visual={progress:f.recorded.progress??null,floorsBuilt:f.recorded.floorsBuilt??null};}onFrame({month,playing,reducedMotion:reduced,frame,events:visibleEvents(),visualOnly:true});}
  function pause(){generation++;playing=false;last=null;if(handle!==null)cancelFrame(handle);handle=null;}
  function scrub(value){if(disposed)return;if(!Number.isFinite(value)||value<0||value>endMonth)throw new RangeError('Outside recorded horizon');pause();month=value;emit();}
  function play(value=speed){if(disposed)return;if(!Number.isFinite(value)||value<=0)throw new RangeError('Invalid speed');pause();speed=value;if(month>=endMonth){emit();return;}playing=true;const token=generation;
    function tick(time){if(disposed||!playing||token!==generation)return;const previous=month;if(last!==null)month=Math.min(endMonth,month+Math.max(0,time-last)*speed/1000);last=time;
      for(const event of visibleEvents())if(event.month>previous&&event.month<=month)onCue({event,animate:!reduced,text:event.message||event.label||`Recorded stress: ${event.presetId} at month ${event.month}`});
      if(month>=endMonth)pause();emit();if(playing)handle=requestFrame(tick);
    }handle=requestFrame(tick);emit();
  }
  function preference(event){reduced=event.matches;emit();}
  motion?.addEventListener?.('change',preference);
  return {play,pause(){pause();emit()},scrub,cancel(){scrub(0)},dispose(){pause();disposed=true;motion?.removeEventListener?.('change',preference)},get state(){return {month,playing,reducedMotion:reduced}}};
}

// Only explicit recorded stress events are accepted. Text remains the audio equivalent.
export function mountStressCue(container,{sound=null}={}) {
  const doc=container.ownerDocument, text=doc.createElement('p');text.setAttribute('role','status');text.setAttribute('aria-live','polite');container.append(text);let animation=null,disposed=false;
  return {show(cue){if(disposed||cue?.event?.type!=='STRESS_PRESET_STARTED')return;animation?.cancel();text.textContent=cue.text; if(cue.animate&&text.animate)animation=text.animate([{opacity:.5},{opacity:1}],{duration:250});sound?.cue()},clear(){animation?.cancel();text.textContent=''},dispose(){disposed=true;animation?.cancel();text.remove()}};
}

export function createSubtleSound({AudioContext=globalThis.AudioContext}={}) {
  let context=null,muted=true,disposed=false;const active=new Set();
  function silence(){for(const node of active){try{node.stop()}catch{} }active.clear();}
  return {async enable(){if(disposed||!AudioContext)return false;try{context ||= new AudioContext();await context.resume();if(disposed)return false;muted=context.state!=='running';return !muted}catch{muted=true;return false}},mute(){muted=true;silence()},cue(){if(disposed||muted||context?.state!=='running')return false;try{const node=context.createOscillator(),gain=context.createGain(),now=context.currentTime;node.frequency.value=220;gain.gain.setValueAtTime(.012,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.12);node.connect(gain);gain.connect(context.destination);node.onended=()=>{active.delete(node);node.disconnect();gain.disconnect()};active.add(node);node.start(now);node.stop(now+.13);return true}catch{return false}},async dispose(){disposed=true;muted=true;silence();try{await context?.close()}catch{}}};
}
