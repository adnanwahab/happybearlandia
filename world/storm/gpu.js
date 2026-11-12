import {
  completeWaterSimulation, FLOW_COEFFICIENT, NEIGHBOR_CAP, prepareWaterInput,
} from './physics.js';

const WORKGROUP_SIZE = 64;

const shader = `
struct Settings {
  size: u32,
  count: u32,
  rain_rate: f32,
  padding: u32,
}

@group(0) @binding(0) var<uniform> settings: Settings;
@group(0) @binding(1) var<storage, read> terrain: array<f32>;
@group(0) @binding(2) var<storage, read> drains: array<f32>;
@group(0) @binding(3) var<storage, read> previous: array<f32>;
@group(0) @binding(4) var<storage, read_write> next: array<f32>;

fn remaining(i: u32) -> f32 {
  return max(0.0, (previous[i] + settings.rain_rate) - drains[i]);
}

fn transfer(water: f32, slope: f32) -> f32 {
  return min(water * ${NEIGHBOR_CAP}, max(0.0, slope * ${FLOW_COEFFICIENT}));
}

fn net(i: u32, depth: f32, surface: f32) -> f32 {
  let neighbor_depth = remaining(i);
  let neighbor_surface = terrain[i] + neighbor_depth;
  let slope = surface - neighbor_surface;
  return transfer(neighbor_depth, -slope) - transfer(depth, slope);
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn step_water(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= settings.count) {
    return;
  }
  let size = settings.size;
  let x = i % size;
  let depth = remaining(i);
  let surface = terrain[i] + depth;
  var water = depth;
  if (x > 0u) {
    water += net(i - 1u, depth, surface);
  }
  if (x < size - 1u) {
    water += net(i + 1u, depth, surface);
  }
  if (i >= size) {
    water += net(i - size, depth, surface);
  }
  if (i < settings.count - size) {
    water += net(i + size, depth, surface);
  }
  next[i] = max(0.0, water);
}
`;

let cachedContext;

function getContext() {
  if (!cachedContext) {
    const init = (async () => {
      const adapter = await globalThis.navigator?.gpu?.requestAdapter();
      if (!adapter) throw new Error('No WebGPU compute adapter is available.');
      const device = await adapter.requestDevice();
      try {
        const pipeline = await device.createComputePipelineAsync({
          label: 'Heightfield water update',
          layout: 'auto',
          compute: { module: device.createShaderModule({ code: shader }), entryPoint: 'step_water' },
        });
        device.lost.then(() => {
          if (cachedContext === init) cachedContext = undefined;
        });
        return { device, pipeline };
      } catch (error) {
        device.destroy();
        throw error;
      }
    })();
    cachedContext = init;
    init.catch(() => {
      if (cachedContext === init) cachedContext = undefined;
    });
  }
  return cachedContext;
}

export async function simulateWaterGPU(input) {
  const config = prepareWaterInput(input);
  const { size, steps, rainRate, terrain, drains } = config;
  const { device, pipeline } = await getContext();
  const { COPY_DST, COPY_SRC, MAP_READ, STORAGE, UNIFORM } = GPUBufferUsage;
  const bytes = terrain.byteLength;
  const frames = [new Float32Array(size ** 2)];
  if (!steps) return completeWaterSimulation(config, frames, 'WebGPU');

  const buffers = [];
  function allocate(label, length, usage) {
    const buffer = device.createBuffer({ label, size: length, usage });
    buffers.push(buffer);
    return buffer;
  }

  try {
    const settings = allocate('Water grid settings', 16, UNIFORM | COPY_DST);
    const landscape = allocate('Water terrain elevations', bytes, STORAGE | COPY_DST);
    const drainage = allocate('Water drain rates', bytes, STORAGE | COPY_DST);
    const state = [
      allocate('Water depth A', bytes, STORAGE | COPY_SRC),
      allocate('Water depth B', bytes, STORAGE | COPY_SRC),
    ];
    const readback = allocate('Water frame readback', steps * bytes, MAP_READ | COPY_DST);

    const values = new ArrayBuffer(16);
    const settingsView = new DataView(values);
    settingsView.setUint32(0, size, true);
    settingsView.setUint32(4, size ** 2, true);
    settingsView.setFloat32(8, rainRate, true);
    device.queue.writeBuffer(settings, 0, values);
    device.queue.writeBuffer(landscape, 0, terrain);
    device.queue.writeBuffer(drainage, 0, drains);

    const bindGroups = state.map((buffer, i) => device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [settings, landscape, drainage, buffer, state[1 - i]].map((resource, binding) => ({
        binding, resource: { buffer: resource },
      })),
    }));
    const commands = device.createCommandEncoder();
    for (let step = 0; step < steps; step++) {
      const previousIndex = step % 2;
      const pass = commands.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroups[previousIndex]);
      pass.dispatchWorkgroups(Math.ceil(size ** 2 / WORKGROUP_SIZE));
      pass.end();
      commands.copyBufferToBuffer(state[1 - previousIndex], 0, readback, step * bytes, bytes);
    }
    device.queue.submit([commands.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Float32Array(readback.getMappedRange());
    for (let step = 0; step < steps; step++) frames.push(mapped.slice(step * size ** 2, (step + 1) * size ** 2));
    readback.unmap();
    return completeWaterSimulation(config, frames, 'WebGPU');
  } finally {
    for (const buffer of buffers) buffer.destroy();
  }
}
