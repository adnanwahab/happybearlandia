import { createState, step, digest, VERSION } from './million-kernel.js';
export async function runPhase(options, phase) {
  if (!['compute-only', 'render-only', 'combined'].includes(phase)) throw new Error('Unknown phase');
  const state = createState(options), samples = [], changed = new Uint8Array(options.size);
  let gl, buffer, program, positions, frameStart, peak = null;
  const memory = () => { const bytes = performance.memory?.usedJSHeapSize; if (Number.isFinite(bytes)) peak = Math.max(peak ?? 0, bytes); };
  if (phase !== 'compute-only') {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600; document.body.append(canvas);
    gl = canvas.getContext('webgl'); if (!gl) throw new Error('WebGL unavailable');
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);gl_PointSize=1.;}'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; void main(){gl_FragColor=vec4(0.,.6,.4,1.);}'));
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL link failed');
    gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    positions = new Float32Array(options.size * 2);
    for (let i = 0; i < options.size; i++) { positions[i*2] = (i % 1000)/500-1; positions[i*2+1] = Math.floor(i/1000)/Math.ceil(options.size/1000)*2-1; }
    const location = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }
  // Setup excluded; each phase starts from identical state, no hidden warm-up ticks.
  memory(); const started = performance.now();
  for (let i = 0; i < options.steps; i++) {
    const row = { tick: i + 1, agentUpdates: 0, interactions: 0, stepMs: null, frameMs: null, callbackIntervalMs: null };
    if (phase !== 'compute-only') {
      const now = await new Promise(requestAnimationFrame);
      row.callbackIntervalMs = frameStart === undefined ? null : now - frameStart; frameStart = now;
    }
    if (phase !== 'render-only') {
      const start = performance.now();
      // Record distinct changed IDs from this workload's actual transitions.
      const before = state.energy.slice();
      Object.assign(row, step(state));
      for (let j = 0; j < before.length; j++) if (before[j] !== state.energy[j]) changed[j] = 1;
      row.stepMs = performance.now() - start;
    }
    if (gl) {
      const start = performance.now();
      for (let j = 0; j < options.size; j++) positions[j*2+1] = Math.min(.999, Math.floor(j/1000)/Math.ceil(options.size/1000)*2-1 + (state.energy[j]-10)*.001);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, options.size); gl.finish();
      if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) throw new Error('WebGL draw failed');
      row.frameMs = performance.now() - start;
    }
    memory(); samples.push(row);
  }
  return { phase, status: 'ok', model: VERSION, ...options, wallMs: performance.now()-started,
    independentlyUpdatedStates: changed.reduce((a,b)=>a+b,0),
    agentUpdates: samples.reduce((a,b)=>a+b.agentUpdates,0), interactions: samples.reduce((a,b)=>a+b.interactions,0),
    renderedPointInstancesPerFrame: gl ? options.size : 0, finalState: digest(state), samples,
    peakMemory: { bytes: peak, source: peak === null ? 'unavailable' : 'performance.memory.usedJSHeapSize', scope: 'sampled page JS heap; not process/GPU peak' },
    renderer: gl ? { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) } : null };
}
