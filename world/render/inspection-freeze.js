/** Page-local presentation gate. Never receives a simulation command interface. */
export function createInspectionFreeze({supported=()=>true,capture=()=>null,release=()=>{}}={}){
 let frozen=false,frame=null,error=null,frames=0,maxFrameMs=0;
 return {get frozen(){return frozen;},toggle(){
  if(frozen){this.clear();return false;}
  if(!supported()){error='Unavailable in this view';return false;}
  try{frame=capture();frozen=true;error=null;return true;}catch{frame=null;error='Could not freeze this scene';return false;}
 },clear(){if(frozen)release(frame);frozen=false;frame=null;},
 record(ms){if(frozen){frames++;if(Number.isFinite(ms))maxFrameMs=Math.max(maxFrameMs,ms);}},
 getState(){return {frozen,error,frames,maxFrameMs};}};
}
export function mountInspectionFreeze({container,gate,modelPaused=()=>false}){
 const doc=container.ownerDocument,root=doc.createElement('div'),button=doc.createElement('button'),status=doc.createElement('span');
 root.dataset.inspectionFreeze='';button.type='button';button.style.cssText='min-height:44px;min-width:44px';status.setAttribute('role','status');
 root.append(button,status);container.append(root);
 const update=()=>{const state=gate.getState();button.textContent=state.frozen?'Unfreeze scene':'Freeze to inspect';button.setAttribute('aria-pressed',String(state.frozen));status.textContent=state.error||`${state.frozen?'Scene frozen · exact geometry selection':'Scene live'} · Model ${modelPaused()?'paused':'running'}`;};
 const click=()=>{gate.toggle();update();};button.addEventListener('click',click);update();
 const win=doc.defaultView,clear=()=>{gate.clear();update();};for(const type of ['pagehide','popstate','hashchange'])win.addEventListener(type,clear);
 return {update,destroy(){clear();button.removeEventListener('click',click);for(const type of ['pagehide','popstate','hashchange'])win.removeEventListener(type,clear);root.remove();}};
}
