# SHE-167 population startup audit and review candidate

The current checkout has no million-resident initializer to replace. This slice
adds allocation regression coverage and a reproducible browser measurement
command. It does **not** complete the proposed million-resident lazy tile/buffer
architecture or its Chrome/Safari/Firefox measurement acceptance criteria.

Observed at baseline `b963dd3` on November 12, 2026:

- `world/population/contracts.js` version 1.3.0 defaults to 10,000 explicit
  residents and rejects more than 100,000. `representedPopulation` is a weight,
  not additional resident state. SHE-141 is Done; its six-count contract is in
  `world/metrics/agent-counts.js`.
- `world/population/generator.js` eagerly allocates arrays for the **configured**
  explicit population. `world/population/world-view.js` creates the runtime in
  `start()`, invoked by activation. `world/render.js` auto-activates it for ordinary
  unsaved World visits; demo/business and `living=0` entry paths defer it. This
  existing distinction is preserved.
- The separate `world/render/gpu-particles.js` render layer allocates only after
  explicit enablement and available evidence. Its symbols are not residents.
- Read-only GitHub search for SHE-167 returned integration PR #38, without a
  dedicated implementation. The existing core-journeys CI runs the six-count
  contract and Chromium journeys, not this new optional startup probe.

Decision: preserve the authoritative dense Population model and its deterministic
identity/clock contracts. Choosing resident paging or cohort simulation requires
an architecture decision beyond the completed metric-contract dependency. Do not
silently lower population based on `navigator.deviceMemory`: it is an approximate,
optional browser hint, not measured free memory, and changing population changes
shared-capacity model behavior.

## Reproduction

From a host that can bind a local port and launch Playwright browsers:

```sh
PORT=54327 HBL_WORLD_DB_PATH=:memory: bun --no-env-file run server.js
# In a second terminal:
bun scripts/benchmark-population-startup.js http://127.0.0.1:54327 /private/tmp/population-startup.json
bun test test/population-startup.test.js test/gpu-particles.test.js test/population-model.test.js test/agent-counts.test.js --timeout 30000
```

The script opens a fresh browser process/context per engine on a seeded synthetic
World demo with `living=0`. It asserts no Population runtime/worker before the
normal toolbar activation, then checks 10,000 configured residents, seed 42 and
at most 500 visible rows. It records machine, engine version, model version,
configuration, available provenance, JS heap, optional device memory and the first
animation callback. Any launched-engine assertion failure fails the command;
missing engines are explicit, and zero passing engines also fails. No AI service
is required. Normal server asset caches and OS caches are not cleared. JS heap
excludes workers, GPU and native allocations; a callback is not a presented
render frame. This probe covers the existing opt-out route, not default World
startup. Automated WebKit cannot establish shipping Safari performance.

## Actual local verification

Bun 1.4.2, macOS arm64. New allocation/invalid-request and GPU fallback tests:
5 passed, 75 assertions. Existing Population and metric-contract tests:
22 passed, 459 assertions. Final combined run: 27 passed, 534 assertions in
9.78 seconds; script syntax and diff whitespace checks passed. Initial test used generator-only state for a runtime
weight assertion; corrected to exercise `createPopulationModel`, where weights
are actually attached, and reran successfully.

No browser numbers were obtained. Both requested port 54327 and ephemeral port 0
failed server startup with Bun `listen`/`EADDRINUSE` in this restricted workspace.
The probe exited 1: Chromium launch closed before page creation; Firefox 1543
and WebKit 2359 executables were absent. Sanitized machine and availability
records are in `docs/evidence/she-167-startup.json`. No performance comparison,
first meaningful frame result or whole-device memory claim is established.

Next: select and document the million-resident architecture, obtain measured
allocation budgets on target devices, implement its bounded initialization through
the ordinary World entry, then rerun cold shipping Chrome/Safari/Firefox checks.
This remains a partial review candidate, not a completion or deployment receipt.

## Approved r2 follow-up

The current change defers Population allocation on ordinary World visits too;
explicit `living=1` and saved-run restoration remain supported. The probe now
uses the ordinary route without demo/opt-out flags and records host startup-frame
diagnostics. The historical audit and blocked receipt above remain unchanged.
See [r2 review and actual verification](reviews/SHE-167-r2.md). Full architecture
and shipping-browser measurement acceptance remains open.
