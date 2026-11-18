import {calendarLabel, clampMonth, formatMeasurement} from './model.js';

// O(1) exact-index lookup. Never search for a neighboring snapshot or clone state.
export function checkpointPreview(history, month, busy=false) {
  const label=`${calendarLabel(month)} · Month ${month}`;
  const a=history?.baseline?.[month], b=history?.plan?.[month];
  if(a?.month!==month || b?.month!==month)return `${label} · ${busy?'Loading':'Unavailable'} — exact paired month is not loaded.`;
  return `${label} · WITHOUT PLAN ${formatMeasurement(a.metrics?.housingUnits,'homes')} · WITH PLAN ${formatMeasurement(b.metrics?.housingUnits,'homes')}. Synthetic replay from manifest; not independently verified stored checkpoints. Run ${history.experimentId??'unavailable'} · model ${history.modelVersion??'unavailable'} · seed ${history.seed??'unavailable'}.`;
}

export function bindScrubPreview(slider, card, {getState,onCommit,onBrowse,delay=0}) {
  let selected=null, timer=null, pointer=false, disposed=false, history=getState().history;
  function cancel(){clearTimeout(timer);timer=null;selected=null;pointer=false;card.hidden=true;const month=getState().month;slider.value=month;slider.setAttribute('aria-valuetext',`${calendarLabel(month)} · Month ${month}`);}
  function preview(){
    clearTimeout(timer);timer=null;
    selected=clampMonth(Number(slider.value));
    card.hidden=false;card.textContent=checkpointPreview(getState().history,selected,getState().busy);
    slider.setAttribute('aria-valuetext',`${calendarLabel(selected)} · Month ${selected} · preview`);
    onBrowse?.();
  }
  function commit(){
    clearTimeout(timer);
    if(selected===null||disposed)return;
    const month=selected;selected=null;pointer=false;card.hidden=true;
    onCommit(month);
  }
  // Input remains a cheap, cancelable preview while dragging. A terminal
  // native selection commits immediately; embedders can opt into batching.
  function schedule(){if(selected!==null){clearTimeout(timer);if(delay>0)timer=setTimeout(commit,delay);else commit();}}
  const handlers={pointerdown(event){pointer=true;if(event.isTrusted&&event.pointerId!==undefined)slider.setPointerCapture?.(event.pointerId);},input:preview,change(){if(!pointer)schedule();},pointerup(){pointer=false;schedule();},pointercancel:cancel,keydown(event){if(event.key==='Escape'){cancel();slider.value=getState().month;}},blur(){if(!pointer)schedule();}};
  for(const [type,fn] of Object.entries(handlers))slider.addEventListener(type,fn);
  return {update(){const state=getState();if(!state.ready||state.busy||state.history!==history)cancel();history=state.history;if(selected!==null){slider.value=selected;card.textContent=checkpointPreview(state.history,selected,state.busy);slider.setAttribute('aria-valuetext',`${calendarLabel(selected)} · Month ${selected} · preview`);}},dispose(){disposed=true;cancel();for(const [type,fn] of Object.entries(handlers))slider.removeEventListener(type,fn);}};
}
