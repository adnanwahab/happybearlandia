import { BENCHMARK_SCENES } from '../../world/render/bench/scenes.js';

// Provisional headless Chromium guardrails, not hardware FPS certification.
export const budgets = Object.fromEntries(BENCHMARK_SCENES.map(scene => [scene,
  Object.fromEntries(['webgl2', 'webgpu'].map(backend => [backend, {
    loadMs: 30000, p95FrameMs: 250, peakHeapBytes: 512 * 1024 * 1024,
  }]))]));

export function checkBudgets(metrics, limits) {
  if (!limits) return ['Missing route/renderer budget'];
  return Object.entries(limits).flatMap(([key, limit]) => {
    const value = metrics?.[key];
    return !Number.isFinite(limit) || limit <= 0 || !Number.isFinite(value) || value < 0
      ? [`${key}: missing or invalid measurement/budget`]
      : value > limit ? [`${key}: ${value} exceeds ${limit}`] : [];
  });
}
