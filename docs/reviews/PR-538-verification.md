# PR538 verification repair

Original head21947ba080cd3694bf3e363ea555720e2f540279, run44124341976/job134183908923: release browser stage12passed/3failed. Downloaded originalartifact14347480988 and inspected errorcontexts/traces. Failure navigation lands at static-city.html, which explicitly states not a checkpoint replay; tests still demand removed Canvas2D/WebGL gameplay and oldfatal UI. Current contract: docs/she-789-webgpu.md, docs/she-789-static-city.md, world/renderer-entry.js, world/static-city.js, world/render.js. No simulation authority change warranted.

Repair preserves exact desktop/mobile saved checkpoint, household, fork/replay and return assertions under real native WebGPU. Bundled full Chromium supplies WebGPU; Linux launch explicitly uses Vulkan software rendering (not hardware-performance evidence). Missing WebGPU now has separate desktop/mobile assertions for geometry-only state, no workers/model/clock, immutable original save, preserved entity/time URL context and working back navigation. Missing WebGPU+WebGL has explicit recovery and no replacement model. No assertion retries, skipped cases, fake adapter or swallowed errors.

Added real hit testing/viewport/overlap assertions for saved exits; these expose the existing launch-shell sidebar overlap. Scoped CSS moves exits beside the desktop rail and above mobile controls. Reuses the previously prepared isolated release-repair slice; preserves the PR's workflow matrix change and all independent work.

Actual local checks (Bun1.4.2, macOS bundled Chromium):
- bunx playwright test --config test/release-browser.config.js:17passed,0failed,18.6seconds.
- bun test test/static-city.test.js test/world-persistence.test.js:11passed,76assertions.
- git diff --check:passed.

Hosted verification on the new head remains required. No merge or deploy. Performance and civilization jobs are distinct gates; local release-suite success does not certify those jobs.
