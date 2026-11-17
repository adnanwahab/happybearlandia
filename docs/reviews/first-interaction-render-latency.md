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

Verification before final cold measurements: the command below passed38tests,
skipped one opt-in browser wrapper, failed zero, with9188assertions:

```sh
bun test test/future-machine-neighborhood.test.js test/future-machine-resources.test.js test/future-machine-scrub-preview.test.js test/future-machine-scrub-identity.test.js test/future-machine-effects.test.js test/future-machine-scene.test.js test/first-interaction-budgets.test.js
```

Enabled existing native UI/scrub checks passed17tests with188assertions:

```sh
# Run from /private/tmp to keep existing screenshot fixtures outside the source tree.
HBL_FM_BROWSER=1 bun --no-env-file test /private/tmp/hbl-render-latency/test/future-machine-scrub-preview.test.js /private/tmp/hbl-render-latency/test/future-machine-ui.test.js
```

These commands overlap;38and17are not additive distinct test counts. Native checks
include keyboard/touch/cancellation, mobile layout, available/unavailable controls
and teardown. Their first run found pre-existing ambiguous slider/missing-idle
fixture issues, corrected above.
No budget values, profile definitions,120-month histories or measured boundaries
changed. The100ms laptop and250ms mobile targets remain unproven; final unchanged
cold-sample measurements follow after a pinned source commit. The host may have
concurrent Mini Symphony work, so these are emulated local observations, not
physical-device or controlled-host certification.

## Final unchanged cold-budget run

Measured source: `8f5da6d2e8c23f8435e8542c0453209471cb131d`, clean working
tree before execution. No calibration flag. Original first-interaction harness,
three cold samples per original profile, original admission pacing, seed42,
committed Month16 and both final animation frames. Only a disposable loopback
port and external artifact/data locations were overridden. Invocation:

```sh
bun --no-env-file /private/tmp/hbl-render-latency-budget-run.mjs
```

Both profile tests **failed** the unchanged budgets. All six samples completed
with the original pageerror, backend, model identity and committed-month checks.
The reports retain `status: incomplete` because numeric acceptance failed.

| Profile | Render samples (ms) | Max ready (ms) | Max decoded JS | Max sampled V8 heap | Acceptance |
| --- | --- | --- | --- | --- | --- |
| Laptop |331.7,329.4,316.0|8220.9|5,003,927 bytes|138,957,860 bytes|Render331.7 >100ms; other ceilings pass|
| Mobile |414.3,377.9,404.6|53641.4|5,003,927 bytes|130,546,228 bytes|Ready53641.4 >30000ms and render414.3 >250ms; byte/heap ceilings pass|

Chromium153.0.8010.12 on arm64 AppleM4; unchanged headless Chromium/WebGL
configuration. The causal profiler identified ANGLE SwiftShader software Vulkan,
not physical mobile hardware. Budget status remains provisional and uncalibrated.
All samples preserve initial hash
`7767de6b19f3b1c62f218c3a4ee26739157382db2c7ff962dbe141fc160821ae`
and `city-systems.1.1.0`. Mini Symphony was active elsewhere on this shared host;
other owned browser checks had stopped, but host contention is not controlled.
The instrumented baseline517.7ms is useful causal evidence, not a three-cold-sample
controlled A/B claim. Remaining software-GPU/frame cost and mobile startup exceed
targets; this change is a partial improvement, not performance acceptance.

External raw receipts, screenshots, traces and source metadata:
`/private/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-render-budget-gP4eWX`.
The two added normal/reduced native Forward/Back regressions are assigned to the
coordinator for execution after this run, avoiding concurrent measurement noise.
