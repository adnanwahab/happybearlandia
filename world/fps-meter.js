/** Actual rolling callback FPS and frame interval, supplied by existing RAF loop.
 * mountFpsMeter({container,windowMs=1000,refreshMs=250,visible=true}) returns
 * {update(now),setVisible(bool),destroy()}. It never schedules RAF or a timer.
 * If the renderer intentionally skips renders this still measures callback FPS,
 * so the visible label says RAF FPS rather than claiming GPU render throughput.
 */
const cssURL=new URL('./map-controls.css',import.meta.url).href;
export function createFrameMeter({windowMs=1000,maxGapMs=1000}={}) {
  const span=Number.isFinite(windowMs)&&windowMs>0?windowMs:1000;
  let last=null,intervals=[];
  function reset(){last=null;intervals=[];}
  function update(now){
    if(!Number.isFinite(now))return null;
    if(last===null){last=now;return null;}
    const dt=now-last;last=now;
    if(dt<=0||dt>maxGapMs){intervals=[];return null;}
    intervals.push({now,dt});while(intervals.length&&intervals[0].now<now-span)intervals.shift();
    const total=intervals.reduce((sum,row)=>sum+row.dt,0),frameMs=total/intervals.length;
    return{fps:1000/frameMs,frameMs,samples:intervals.length,windowMs:span};
  }
  return{update,reset};
}
export function mountFpsMeter({container,windowMs=1000,refreshMs=250,visible=true}={}) {
  if(!container?.ownerDocument)throw new TypeError('FPS meter requires a DOM container.');
  const doc=container.ownerDocument,root=doc.createElement('aside');root.className='world-fps-meter';root.dataset.testid='world-fps-meter';root.setAttribute('aria-label','Live animation performance');
  const value=doc.createElement('output');value.textContent='RAF FPS — · — ms';value.setAttribute('aria-live','off');
  const toggle=doc.createElement('button');toggle.type='button';toggle.className='fps-meter-toggle';toggle.textContent='FPS';toggle.title='Show or hide live RAF frame rate';toggle.setAttribute('aria-label','Toggle FPS meter');
  const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=cssURL;root.append(value,toggle);container.append(sheet,root);
  const meter=createFrameMeter({windowMs});let destroyed=false,shown=Boolean(visible),lastPaint=-Infinity;
  function setVisible(next){shown=Boolean(next);value.hidden=!shown;toggle.setAttribute('aria-pressed',String(shown));}
  const click=()=>setVisible(!shown),visibility=()=>{meter.reset();lastPaint=-Infinity;value.textContent='RAF FPS — · — ms';};toggle.addEventListener('click',click);doc.addEventListener('visibilitychange',visibility);doc.defaultView?.addEventListener('blur',visibility);setVisible(shown);
  function update(now){if(destroyed||doc.visibilityState==='hidden')return null;const sample=meter.update(now);if(!sample&&now-lastPaint>=refreshMs)value.textContent='RAF FPS — · — ms';if(sample&&now-lastPaint>=refreshMs){lastPaint=now;value.textContent=`RAF FPS ${sample.fps.toFixed(0)} · ${sample.frameMs.toFixed(1)} ms`;value.title=`${sample.samples} actual frame intervals in the last ${(sample.windowMs/1000).toFixed(1)} seconds`;root.dataset.fps=sample.fps.toFixed(1);root.dataset.frameMs=sample.frameMs.toFixed(2);}return sample;}
  return{update,setVisible,destroy(){if(destroyed)return;destroyed=true;toggle.removeEventListener('click',click);doc.removeEventListener('visibilitychange',visibility);doc.defaultView?.removeEventListener('blur',visibility);sheet.remove();root.remove();}};
}
export const mountFPSMeter=mountFpsMeter;
