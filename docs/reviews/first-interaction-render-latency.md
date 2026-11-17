# First-interaction render latency — November 17, 2026

Bounded slice: profile and reduce real committed Month16 timeline interaction
through the normal homepage/demo route. Own Future Machine presentation code and
focused regressions; retain the exact performance harness, existing100/250ms
render ceilings, provisional budget status, seed42, unchanged City model and
complete two-frame measurement. No production changes or live runner edits.

Prerequisites audited: AGENTS, design, first-interaction measurement contract,
SHE-40/SHE-481 plan, scrub-preview/UI/scene interfaces, retained stage and current
main. Current120ms committed-seek debounce alone exceeds the laptop100ms target;
profile native commit, scene draw and UI work before choosing implementation.

Acceptance: drag preview stays independent of authoritative month; terminal
selection updates the real month and both scenes/evidence, no stale selection or
checkpoint mutation; existing cancellation/keyboard/touch behavior verified.
Before/after real measurements use unchanged harness and exact profile settings.
Final cold runs wait for a quiet browser window to reduce contention. No budget
increase or measurement-window change; failure remains explicit if target unmet.

## Delivered candidate and causal evidence

- Default terminal release/change commits immediately, preserving input-only drag
  previews and optional explicit delay. Existing cancel/Escape tests remain.
- Identical decorative facade windows share one InstancedMesh with the original
  dimensions, per-window matrices and material. Instance buffers and shared
  geometry/material resources release exactly once. Model picks and snapshots
  remain unchanged.
- Early inline cross-document opt-in restores the real homepage/demo/Back journey
  under delayed styles, instead of masking native errors. Normal/reduced-motion
  browser regressions retain the zero-pageerror assertion.
- Existing isolated UI tests now name the timeline slider rather than ambiguously
  matching the unrelated sound slider, and supply the normal coordinator's idle
  initialization before testing unavailable controls.

Instrumented cause profile (not the untouched budget run): baseline517.7ms
included120.1ms artificial delay,19.4ms commit work,1.6ms UI update and a native
GPU/frame-scheduling gap. Candidate profiles331.8–393.3ms remove that delay;
commit is17–21ms and UI1.5–2.2ms. Backend remains WebGL on ANGLE SwiftShader
(software Vulkan/LLVM10), not native hardware. Last arm draw calls are96 atMonth0
and125 atMonth16. A diagnostic-only omitted cosmetic burst reduced one profile
to198ms; the actual burst remains enabled. Shader-only warmup, including retained
program references, did not improve the remaining gap (360–379ms) and was dropped.
No disabled effect, prewarm probes or warmup lifetime changes are shipped.

Verification before final cold measurements:20unit tests passed across retained
scene/effects/resources/scrub suites, one opt-in browser skip. Enabled existing
native UI/scrub browser checks:17passed, including keyboard/touch/cancellation,
mobile layout, available/unavailable controls and teardown. Their first run found
pre-existing ambiguous slider/missing-idle fixture issues, corrected above.
No budget values, profile definitions,120-month histories or measured boundaries
changed. The100ms laptop and250ms mobile targets remain unproven; final unchanged
cold-sample measurements follow after a pinned source commit. The host may have
concurrent Mini Symphony work, so these are emulated local observations, not
physical-device or controlled-host certification.
