# Lumen

A local-only glTF/GLB model review workspace. Open `/tools/lumen/` through the existing Bun server.

Rendering uses native WebGPU via vendored Three.js r186 (`three.webgpu.js` and `three.core.js`, copied from this checkout's installed Three package). Standard glTF materials are translated by Three's node material library; sectioning uses a `ClippingGroup`. Initialization is awaited before environment generation, compressed-texture capability detection, and rendering.

`gpu-renderer.js` disables Three's cached `_getFallback` callback before initialization, then verifies `isWebGPUBackend`. This version-specific hook must be checked when upgrading Three. Unsupported browsers and device failures show an explicit WebGPU availability panel; there is no WebGL fallback.

The legacy `three.module.js` is retained for compatibility with existing files but is not imported by this page.

Focused checks: `bun test tools/lumen/gpu-renderer.test.js`.
