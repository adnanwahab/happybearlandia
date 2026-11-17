const code = `
struct Params { count:u32, side:u32, cap:u32, pad:u32 }
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read> spatial:array<u32>;
@group(0) @binding(2) var<storage,read> offsets:array<u32>;
@group(0) @binding(3) var<storage,read> ids:array<u32>;
@group(0) @binding(4) var<storage,read> previous:array<u32>;
@group(0) @binding(5) var<storage,read_write> result:array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
 let i=gid.x; if(i>=p.count){return;}
 let cell=spatial[p.count+i]*p.side+spatial[i];
 var sum=0u; var used=0u;
 for(var k=offsets[cell]; k<offsets[cell+1u] && used<p.cap; k++) {
  let j=ids[k]; if(j==i){continue;} sum+=previous[j]; used++;
 }
 result[i]=(previous[i]+1u+sum%7u)%1024u;
 result[p.count+i]=used;
 result[2u*p.count+i]=1u;
}`;
export async function createGPU(s) {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('WebGPU unavailable');
  const timestamp = adapter.features.has('timestamp-query');
  const device = await adapter.requestDevice({ requiredFeatures: timestamp ? ['timestamp-query'] : [] });
  const buffers = [];
  let query;
  try {
    const bytes = s.count * 4, spatial = new Uint32Array(s.count * 2);
    spatial.set(s.x); spatial.set(s.y, s.count);
    const U = GPUBufferUsage;
    function alloc(size, usage, data) {
      if (size > device.limits.maxBufferSize) throw new Error('Buffer exceeds device limit');
      const b = device.createBuffer({ size, usage }); buffers.push(b);
      if (data) device.queue.writeBuffer(b, 0, data);
      return b;
    }
    const settings = alloc(16, U.UNIFORM | U.COPY_DST, new Uint32Array([s.count,s.side,s.cap,0]));
    const inputs = [spatial,s.offsets,s.ids].map(a => alloc(a.byteLength,U.STORAGE|U.COPY_DST,a));
    const states = [0,1].map(() => alloc(bytes*3,U.STORAGE|U.COPY_SRC|U.COPY_DST));
    device.queue.writeBuffer(states[0],0,s.energy);
    const read = alloc(bytes*3,U.MAP_READ|U.COPY_DST);
    const resolve = timestamp ? alloc(16,U.QUERY_RESOLVE|U.COPY_SRC) : null;
    const times = timestamp ? alloc(16,U.MAP_READ|U.COPY_DST) : null;
    if (timestamp) query=device.createQuerySet({type:'timestamp',count:2});
    const pipeline = await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code}),entryPoint:'main'}});
    const groups=states.map((b,i)=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[settings,...inputs,b,states[1-i]].map((buffer,binding)=>({binding,resource:{buffer}}))}));
    let tick=0;
    return {
      metadata: { adapter: { ...adapter.info }, limits: Object.fromEntries(['maxBufferSize','maxStorageBufferBindingSize','maxComputeWorkgroupsPerDimension'].map(k=>[k,device.limits[k]])), allocatedGPUBufferBytes: buffers.reduce((n,b)=>n+b.size,0), physicalVRAMBytes:null, timestamp },
      async step() {
        const encoder=device.createCommandEncoder();
        const start=performance.now();
        const pass=encoder.beginComputePass(timestamp?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{});
        pass.setPipeline(pipeline); pass.setBindGroup(0,groups[tick%2]); pass.dispatchWorkgroups(Math.ceil(s.count/64)); pass.end();
        encoder.copyBufferToBuffer(states[1-tick%2],0,read,0,bytes*3);
        if(timestamp){encoder.resolveQuerySet(query,0,2,resolve,0);encoder.copyBufferToBuffer(resolve,0,times,0,16);}
        device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        const data=new Uint32Array(read.getMappedRange()).slice(); read.unmap();
        let gpuPassMs=null;
        if(timestamp){await times.mapAsync(GPUMapMode.READ);const t=new BigUint64Array(times.getMappedRange());gpuPassMs=Number(t[1]-t[0])/1e6;times.unmap();}
        tick++;
        return { tick, energy:data.slice(0,s.count), contacts:data.slice(s.count,s.count*2), updated:data.slice(s.count*2), gpuPassMs, submitReadbackMs:performance.now()-start };
      },
      destroy(){query?.destroy();buffers.forEach(b=>b.destroy());device.destroy();},
    };
  } catch(e) { query?.destroy(); buffers.forEach(b=>b.destroy()); device.destroy(); throw e; }
}
