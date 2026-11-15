/** Compile newly visible render objects off the animation callback. Three's
 * async compiler yields while building nodes and polls parallel shader linking.
 * Unready objects are omitted from that draw, then restored for picking/culling.
 * No scene or simulation records are cloned or retained after object disposal. */
export function createShaderWarmup({renderer,scene,camera,schedule=fn=>setTimeout(fn,0),now=()=>performance.now(),maxPending=128,visibilityTimeoutMs=15000}={}){
 const states=new WeakMap();let disposed=false,working=false;const queue=[];let pending=0,compiled=0,failed=0;
 // Geometry buffer identity changes need fresh buffers, not a new shader.
 // Material identity remains part of the key: custom node graphs are not guessed.
 const signature=object=>[object.geometry?.version,...Object.entries(object.geometry?.attributes??{}).sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,attribute])=>[name,attribute.itemSize,attribute.normalized,attribute.array?.constructor?.name]),Object.keys(object.geometry?.morphAttributes??{}).sort().join(','),Boolean(object.isInstancedMesh),Boolean(object.isBatchedMesh),Boolean(object.isSkinnedMesh),object.skeleton?.bones?.length,...(Array.isArray(object.material)?object.material:[object.material]).flatMap(material=>[material?.id,material?.version]),object.receiveShadow,scene.fog?.isFogExp2,renderer.shadowMap?.enabled,renderer.shadowMap?.type].join(':');
 function pump(){if(disposed||working)return;const item=queue.shift();if(!item)return;working=true;
  // compileAsync projects visible objects, so suppression must only span render().
  Promise.resolve().then(()=>{const visible=item.object.visible;item.object.visible=true;try{return renderer.compileAsync(item.object,camera,scene);}finally{item.object.visible=visible;}}).then(()=>{item.state.ready=true;compiled++;},()=>{item.state.ready=true;failed++;}).finally(()=>{pending--;working=false;if(queue.length&&!disposed)schedule(pump);});
 }
 const materialRevision=material=>{if(!Array.isArray(material))return material?.version??0;let value=0;for(const item of material)value=(value*31+(item?.id??0)*7+(item?.version??0))|0;return value;};
 function changed(object,state,context){if(!state||state.geometry!==object.geometry||state.material!==object.material||state.materialRevision!==materialRevision(object.material)||state.receiveShadow!==object.receiveShadow||state.context!==context)return true;let count=0;for(const name in object.geometry?.attributes){count++;if(state.attributes[name]!==object.geometry.attributes[name])return true;}return count!==state.attributeCount;}
 function remember(object,state,context){state.geometry=object.geometry;state.material=object.material;state.materialRevision=materialRevision(object.material);state.receiveShadow=object.receiveShadow;state.context=context;state.attributes={...object.geometry?.attributes};state.attributeCount=Object.keys(state.attributes).length;}
 return{draw(render){if(disposed||typeof renderer.compileAsync!=='function'){render();return;}
  const hidden=[],context=`${scene.fog?.isFogExp2}:${renderer.shadowMap?.enabled}:${renderer.shadowMap?.type}`;scene.traverseVisible(object=>{if(!object.material||!object.geometry)return;let state=states.get(object);if(changed(object,state,context)){const key=signature(object);if(!state||state.key!==key){state={key,ready:false,queued:false,firstSeen:now()};states.set(object,state);}remember(object,state,context);}
   if(!state.ready&&now()-state.firstSeen>=visibilityTimeoutMs){state.ready=true;failed++;}
   if(!state.ready&&!state.queued&&pending<maxPending){state.queued=true;queue.push({object,state});pending++;}
   if(!state.ready)hidden.push(object);
  });
  if(queue.length&&!working)schedule(pump);
  for(const object of hidden)object.visible=false;
  try{render();}finally{for(const object of hidden)object.visible=true;}
 },getStats:()=>({pending,compiled,failed}),dispose(){disposed=true;queue.length=0;pending=working?1:0;}};
}
