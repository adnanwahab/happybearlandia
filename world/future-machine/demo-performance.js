// Local diagnostics only: no network, identifiers, recipes, or persistent history.
const KEY='hbl.demo-click.v1';
export function rememberDemoClick(storage,now=performance.timeOrigin+performance.now()){
  try{if(storage===undefined)storage=globalThis.sessionStorage;storage.setItem(KEY,String(now));}catch{}
}
export function consumeDemoClick(storage,now=performance.timeOrigin+performance.now()){
  try{if(storage===undefined)storage=globalThis.sessionStorage;const raw=storage.getItem(KEY);storage.removeItem(KEY);const value=Number(raw);return raw!==null&&Number.isFinite(value)&&value<=now&&now-value<60000?value:null;}catch{return null;}
}
export function visibleCity(element,doc= document){
  if(doc.visibilityState!=='visible'||!element?.isConnected)return false;
  if(element.checkVisibility&&!element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;
  const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
  return style.visibility==='visible'&&Number(style.opacity)>0&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<innerHeight&&rect.left<innerWidth;
}
export function createDemoTiming({now=()=>performance.timeOrigin+performance.now()}={}){
  let pending=null,result=null;
  return {
    start(start=now(),source='button'){pending={start,source};result=null;},
    cancel(){pending=null;},
    finish(backend,warm){if(!pending||!['webgpu','webgl','canvas2d'].includes(backend))return null;const elapsed=now()-pending.start;if(!Number.isFinite(elapsed)||elapsed<0)return null;result=Object.freeze({version:1,source:pending.source,renderer:backend,state:warm?'warm':'cold',durationMs:Math.round(elapsed),endpoint:'visible-city-after-paint'});pending=null;return result;},
    get result(){return result?{...result}:null;}
  };
}
