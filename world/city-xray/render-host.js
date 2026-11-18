/** A presentation slot on the existing renderer. No scheduling or simulation writes. */
export function installPresentationHost(renderer,{announce=()=>{},clock=()=>performance.now()}={}) {
 const render=renderer.render,dispose=renderer.dispose;
 let presentation=null,normal=null,announced=false,lost=false,disposed=false;
 const host={renderer,get normal(){return normal;},get available(){return !lost&&!disposed;},
  setPresentation(value){if(value&&!host.available)throw Error('Graphics unavailable');presentation=value;},
  get presentation(){return presentation;}};
 renderer.render=function(scene,camera,...rest){
  if(disposed||lost)return;
  normal={scene,camera};
  if(!announced&&renderer.domElement?.isConnected){announced=true;announce('ready',host);}
  if(presentation){presentation.beforeRender(clock());return render.call(this,presentation.scene,presentation.camera,...rest);}
  return render.call(this,scene,camera,...rest);
 };
 const release=reason=>{if(lost||disposed)return;lost=reason==='device-lost';presentation?.dispose();presentation=null;announce(reason,host);};
 renderer.backend?.device?.lost?.then(()=>release('device-lost'));
 renderer.dispose=function(...args){if(disposed)return;release('disposed');disposed=true;normal=null;return dispose?.apply(this,args);};
 return host;
}
