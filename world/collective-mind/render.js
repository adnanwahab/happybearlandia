import { draw } from '../population/contracts.js';
import { AGENT_COUNT, COMMUNITY_SIZE } from './model.js';

export const OPTION_COLORS = Object.freeze(['#64e1c1', '#f7c77d', '#bca5ff']);
const colors = OPTION_COLORS.map(color => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255));
const background = '#08101a';
const FLOATS = 6;

export function networkLayout({ recipe, edges }) {
  const seed = recipe.seed;
  const anchors = Float32Array.from({ length: AGENT_COUNT * 2 }, (_, coordinate) => {
    const id = Math.floor(coordinate / 2);
    const group = Math.floor(id / COMMUNITY_SIZE);
    const angle = id % COMMUNITY_SIZE * 2.39996 + draw(seed, id, 0, 12) * 0.45;
    const radius = Math.sqrt((id % COMMUNITY_SIZE + 0.5) / COMMUNITY_SIZE);
    if (coordinate % 2 === 0) return 0.14 + (group % 4) * 0.24 + Math.cos(angle) * radius * 0.092;
    return 0.31 + Math.floor(group / 4) * 0.38 + Math.sin(angle) * radius * 0.145;
  });
  const shownEdges = edges.filter((_, index) => draw(seed, index, 0, 13) < 0.26);
  const points = new Float32Array(AGENT_COUNT * FLOATS);
  const lines = new Float32Array(shownEdges.length * 2 * FLOATS);

  return (frame, showEdges) => {
    for (let id = 0; id < AGENT_COUNT; id++) {
      const option = frame[id];
      const offset = id * FLOATS;
      points[offset] = anchors[id * 2] + (option - 1) * 0.015;
      points[offset + 1] = anchors[id * 2 + 1] + (option === 1 ? -0.012 : 0.008);
      points.set(colors[option], offset + 2);
      points[offset + 5] = 0.95;
    }
    let used = 0;
    if (showEdges) {
      for (const [a, b] of shownEdges) {
        if (frame[a] !== frame[b]) continue;
        for (const id of [a, b]) {
          const offset = id * FLOATS;
          lines.set(points.subarray(offset, offset + FLOATS), used);
          lines[used + 5] = recipe.network === 'citywide' ? 0.11 : 0.17;
          used += FLOATS;
        }
      }
    }
    return { points, lines: lines.subarray(0, used), frame };
  };
}

function makeCanvas(host, className) {
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  return canvas;
}

function resize(canvas, host) {
  const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(host.clientWidth * scale));
  const height = Math.max(1, Math.round(host.clientHeight * scale));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height, radius: (host.clientWidth < 520 ? 1.7 : 2.65) * scale };
}

function paint2D(canvas, host, scene) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height, radius } = resize(canvas, host);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  const { points, lines, frame } = scene;
  for (let i = 0; i < lines.length; i += 2 * FLOATS) {
    const [r, g, b, alpha] = lines.subarray(i + 2, i + FLOATS);
    context.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
    context.beginPath();
    context.moveTo(lines[i] * width, lines[i + 1] * height);
    context.lineTo(lines[i + FLOATS] * width, lines[i + FLOATS + 1] * height);
    context.stroke();
  }
  for (let i = 0; i < points.length; i += FLOATS) {
    context.fillStyle = OPTION_COLORS[frame[i / FLOATS]];
    context.beginPath();
    context.arc(points[i] * width, points[i + 1] * height, radius, 0, Math.PI * 2);
    context.fill();
  }
}

const shaderCode = `
struct Settings { radius: vec2<f32>, }
@group(0) @binding(0) var<uniform> settings: Settings;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) local: vec2<f32>,
}

fn clip(position: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0);
}

@vertex
fn point_vertex(@builtin(vertex_index) vi: u32, @location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
  let quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  let corner = quad[vi];
  return VertexOutput(vec4<f32>(clip(position) + corner * settings.radius, 0.0, 1.0), color, corner);
}

@vertex
fn line_vertex(@location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
  return VertexOutput(vec4<f32>(clip(position), 0.0, 1.0), color, vec2<f32>(0.0));
}

@fragment
fn point_fragment(v: VertexOutput) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.72, 1.0, length(v.local));
  return vec4<f32>(v.color.rgb, v.color.a * alpha);
}

@fragment
fn line_fragment(v: VertexOutput) -> @location(0) vec4<f32> {
  return v.color;
}
`;

async function makeGPU(canvas, host, onLost) {
  const api = globalThis.navigator?.gpu;
  const adapter = await api?.requestAdapter();
  if (!adapter) return null;
  const context = canvas.getContext('webgpu');
  if (!context) return null;
  const device = await adapter.requestDevice();
  const buffers = [];
  function buffer(size, usage) {
    const value = device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST });
    buffers.push(value);
    return value;
  }
  function destroy() {
    context.unconfigure();
    for (const value of buffers) value.destroy();
    device.destroy();
  }

  try {
    const format = api.getPreferredCanvasFormat();
    const module = device.createShaderModule({ code: shaderCode });
    const attributes = [{ shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32x4' }];
    const target = {
      format, blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      },
    };
    const [pointPipeline, linePipeline] = await Promise.all([
      device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module, entryPoint: 'point_vertex', buffers: [{ arrayStride: 24, stepMode: 'instance', attributes }] },
        fragment: { module, entryPoint: 'point_fragment', targets: [target] }, primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module, entryPoint: 'line_vertex', buffers: [{ arrayStride: 24, attributes }] },
        fragment: { module, entryPoint: 'line_fragment', targets: [target] }, primitive: { topology: 'line-list' },
      }),
    ]);
    const settings = buffer(16, GPUBufferUsage.UNIFORM);
    const pointBuffer = buffer(AGENT_COUNT * 24, GPUBufferUsage.VERTEX);
    // Citywide has at most four undirected links per agent; the visual sample is smaller.
    const lineBuffer = buffer(AGENT_COUNT * 4 * 2 * 24, GPUBufferUsage.VERTEX);
    const bind = device.createBindGroup({
      layout: pointPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: settings } }],
    });
    resize(canvas, host);
    context.configure({ device, format, alphaMode: 'opaque' });
    device.lost.then(onLost);
    device.addEventListener('uncapturederror', onLost);
    return {
      draw({ points, lines }) {
        const { width, height, radius } = resize(canvas, host);
        device.queue.writeBuffer(settings, 0, new Float32Array([2 * radius / width, 2 * radius / height, 0, 0]));
        device.queue.writeBuffer(pointBuffer, 0, points);
        if (lines.length) device.queue.writeBuffer(lineBuffer, 0, lines);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store',
            clearValue: { r: 8 / 255, g: 16 / 255, b: 26 / 255, a: 1 },
          }],
        });
        if (lines.length) {
          pass.setPipeline(linePipeline);
          pass.setVertexBuffer(0, lineBuffer);
          pass.draw(lines.length / FLOATS);
        }
        pass.setPipeline(pointPipeline);
        pass.setBindGroup(0, bind);
        pass.setVertexBuffer(0, pointBuffer);
        pass.draw(6, points.length / FLOATS);
        pass.end();
        device.queue.submit([encoder.finish()]);
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}

export function mountNetworkView(host, onBackend) {
  const fallback = makeCanvas(host, 'network-fallback');
  const gpuCanvas = makeCanvas(host, 'network-gpu');
  gpuCanvas.hidden = true;
  let gpu;
  let scene;
  let destroyed = false;
  function switchToFallback() {
    if (destroyed || !gpu) return;
    const old = gpu;
    gpu = undefined;
    old.destroy();
    gpuCanvas.hidden = true;
    fallback.hidden = false;
    onBackend('Canvas 2D');
    draw();
  }
  function draw() {
    if (!scene || destroyed) return;
    try {
      if (gpu) gpu.draw(scene);
      else paint2D(fallback, host, scene);
    } catch {
      switchToFallback();
    }
  }
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  onBackend('Canvas 2D');
  void makeGPU(gpuCanvas, host, switchToFallback).then(renderer => {
    if (destroyed) {
      renderer?.destroy();
      return;
    }
    if (!renderer) return;
    gpu = renderer;
    gpuCanvas.hidden = false;
    fallback.hidden = true;
    onBackend('WebGPU');
    draw();
  }).catch(() => {});
  return {
    draw(next) {
      scene = next;
      draw();
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      gpu?.destroy();
      fallback.remove();
      gpuCanvas.remove();
    },
  };
}
