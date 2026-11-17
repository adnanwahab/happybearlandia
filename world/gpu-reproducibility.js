import { fingerprint } from './reproducibility.js';

export const VERSION = 'hbl-gpu-conflicts.v1';
export const BACKENDS = ['atomic', 'two-phase', 'sort-by-key'];
// Synthetic requests: [resource/contact bucket, integer demand, unique agent ID].
export function workload(seed, count = 257, buckets = 17) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(count) || count < 1 || count > 4096 || !Number.isInteger(buckets) || buckets < 1 || buckets > 256) throw new Error('Invalid bounded workload');
  let state = seed >>> 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const records = Array.from({ length: count }, (_, id) => [next() % buckets, 1 + next() % 31, id]);
  return { seed, count, buckets, records };
}
export function oracle(input) {
  const output = Array.from({ length: input.buckets }, () => [0, 0, 0xffffffff]);
  for (const [key, demand, id] of input.records) {
    output[key][0]++; output[key][1] += demand; output[key][2] = Math.min(output[key][2], id);
  }
  return output.flat();
}

const declarations = `
struct Params { count: u32, buckets: u32, groups: u32, pad: u32 }
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> requests: array<vec4<u32>>;
@group(0) @binding(2) var<storage, read_write> scratch: array<u32>;
@group(0) @binding(3) var<storage, read_write> result: array<atomic<u32>>;
`;
const shaders = {
  atomic: `@compute @workgroup_size(64) fn first(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x; if (i >= p.count) { return; } let r = requests[i];
    atomicAdd(&result[r.x*3u], 1u); atomicAdd(&result[r.x*3u+1u], r.y); atomicMin(&result[r.x*3u+2u], r.z);
  }`,
  'two-phase': `@compute @workgroup_size(64) fn first(@builtin(global_invocation_id) gid: vec3<u32>) {
    let task = gid.x; if (task >= p.groups*p.buckets) { return; }
    let group = task/p.buckets; let key = task%p.buckets;
    var count = 0u; var sum = 0u; var winner = 0xffffffffu;
    for (var i = group*64u; i < min(p.count,(group+1u)*64u); i++) {
      let r = requests[i]; if (r.x == key) { count++; sum += r.y; winner = min(winner,r.z); }
    }
    scratch[task*3u] = count; scratch[task*3u+1u] = sum; scratch[task*3u+2u] = winner;
  }
  @compute @workgroup_size(64) fn second(@builtin(global_invocation_id) gid: vec3<u32>) {
    let key = gid.x; if (key >= p.buckets) { return; }
    var count = 0u; var sum = 0u; var winner = 0xffffffffu;
    for (var g = 0u; g < p.groups; g++) {
      let index = (g*p.buckets+key)*3u; count += scratch[index]; sum += scratch[index+1u]; winner = min(winner,scratch[index+2u]);
    }
    atomicStore(&result[key*3u],count); atomicStore(&result[key*3u+1u],sum); atomicStore(&result[key*3u+2u],winner);
  }`,
  // Unique rank by (key, ID); intentionally simple O(n²) reference sort.
  'sort-by-key': `@compute @workgroup_size(64) fn first(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x; if (i >= p.count) { return; } let r = requests[i]; var rank = 0u;
    for (var j = 0u; j < p.count; j++) { let other = requests[j];
      if (other.x < r.x || (other.x == r.x && other.z < r.z)) { rank++; }
    }
    scratch[rank*3u] = r.x; scratch[rank*3u+1u] = r.y; scratch[rank*3u+2u] = r.z;
  }
  @compute @workgroup_size(64) fn second(@builtin(global_invocation_id) gid: vec3<u32>) {
    let key = gid.x; if (key >= p.buckets) { return; }
    var count = 0u; var sum = 0u; var winner = 0xffffffffu;
    for (var i = 0u; i < p.count; i++) { let index = i*3u;
      if (scratch[index] == key) { count++; sum += scratch[index+1u]; winner = min(winner,scratch[index+2u]); }
    }
    atomicStore(&result[key*3u],count); atomicStore(&result[key*3u+1u],sum); atomicStore(&result[key*3u+2u],winner);
  }`,
};

export async function gpuRunner(device, input, backend) {
  if (!BACKENDS.includes(backend)) throw new Error('Unknown backend');
  const buffers = [];
  const make = (size, usage) => { const b = device.createBuffer({size, usage}); buffers.push(b); return b; };
  try {
    const U = GPUBufferUsage;
    const groups = Math.ceil(input.count / 64);
    const params = make(16, U.UNIFORM | U.COPY_DST);
    const data = make(input.count*16, U.STORAGE | U.COPY_DST);
    const scratch = make(Math.max(input.count, groups*input.buckets)*12, U.STORAGE);
    const result = make(input.buckets*12, U.STORAGE | U.COPY_DST | U.COPY_SRC);
    const read = make(input.buckets*12, U.MAP_READ | U.COPY_DST);
    device.queue.writeBuffer(params, 0, new Uint32Array([input.count,input.buckets,groups,0]));
    device.queue.writeBuffer(data, 0, new Uint32Array(input.records.flatMap(r => [...r,0])));
    const module = device.createShaderModule({code: declarations + shaders[backend]});
    const pipelines = await Promise.all((backend === 'atomic' ? ['first'] : ['first','second']).map(entryPoint => device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint}})));
    // Auto layouts omit unused bindings independently for each entry point.
    const resources = [params,data,scratch,result];
    const bindings = backend === 'atomic' ? [[0,1,3]] : [[0,1,2],[0,2,3]];
    const binds = pipelines.map((pipeline,i) => device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:bindings[i].map(binding => ({binding,resource:{buffer:resources[binding]}}))}));
    return {
      async run() {
        device.queue.writeBuffer(result,0,new Uint32Array(Array.from({length:input.buckets},()=>[0,0,0xffffffff]).flat()));
        const encoder = device.createCommandEncoder();
        pipelines.forEach((pipeline,i) => {
          const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0,binds[i]);
          pass.dispatchWorkgroups(Math.ceil((i ? input.buckets : backend === 'two-phase' ? groups*input.buckets : input.count)/64)); pass.end();
        });
        encoder.copyBufferToBuffer(result,0,read,0,input.buckets*12); device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ); const output = Array.from(new Uint32Array(read.getMappedRange())); read.unmap(); return output;
      },
      destroy() { buffers.forEach(b=>b.destroy()); },
    };
  } catch (error) { buffers.forEach(b=>b.destroy()); throw error; }
}

export async function measure(input, backend, run, repeats = 100) {
  if (!Number.isInteger(repeats) || repeats < 100 || repeats > 10000) throw new Error('Require 100–10000 repeats');
  const expected = oracle(input), expectedHash = fingerprint(expected), hashes = {}, times = [];
  let mismatches = 0;
  for (let i=0;i<repeats;i++) {
    const start = performance.now(); const actual = await run(); times.push(performance.now()-start);
    const hash = fingerprint(actual); hashes[hash] = (hashes[hash] || 0)+1;
    if (actual.length !== expected.length || actual.some((v,j)=>v!==expected[j])) mismatches++;
  }
  times.sort((a,b)=>a-b);
  return { backend, seed: input.seed, count: input.count, buckets: input.buckets, inputHash:fingerprint(input), repeats, expectedHash, hashes, mismatches, accepted:mismatches===0 && Object.keys(hashes).length===1, medianMs:times[Math.floor(times.length/2)], p95Ms:times[Math.ceil(times.length*.95)-1] };
}
