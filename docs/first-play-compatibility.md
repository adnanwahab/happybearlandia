# First-play compatibility matrix — SHE-175

Review candidate: runner and manual protocol prepared; browser acceptance remains
incomplete. No consumer-device compatibility or performance claim is supported
by this attempt. Evidence date: 2026-11-12.

## Integration verification — 2026-11-12

PR #176 retains the original attempt JSON and startup log unchanged. The current
config additionally places City, share and Decision stores in a fresh temporary
directory (World remains in memory), refuses existing server reuse, and explicitly
sets bounded test-only simulation admission budgets. Many unrelated desktop and
mobile journeys share one loopback address; `NODE_ENV=test` plus budgets of
120/client and 600/process prevent collision with the production six/client,
sixty/process defaults. No HTTP bypass or production exemption was added.

Current checks rediscover eight Chromium tests and 24 tests across all three
engines, validate syntax, and inspect isolated server configuration. An actual
server HTTP smoke confirmed production still rejects the seventh submission with
429 even when test-budget variables are present; an explicit test process admits
the seventh malformed request to ordinary 400 validation. No simulation work or
browser results are fabricated by that check. Chromium remains blocked by socket
EPERM before page creation, so the historical evidence and all physical-device
coverage limitations below remain explicit.

## Audit and scope

The isolated `mini/SHE-175` checkout was clean before this slice. Product design,
implementation plan, Future Machine interfaces and scene documentation were
reviewed. No `docs/architecture.md` exists. Existing `two-futures-compatibility`,
`world-progressive-loading` and `pipeline-device-loss` tests already cover
related journeys; the new config reuses the real device-loss tests unchanged.
Core journeys CI installs Chromium only. GitHub compatibility search found
[PR 26](https://github.com/adnanwahab/happybearlandia/pull/26), whose manifest and
replay fixes are present, and no dedicated consumer matrix delivery in returned
results. Planning dependencies HBL-1M-039 (SHE-166) and HBL-1M-041 are not
certified by this work; this scope verifies the existing homepage Play Demo
monthly City journey, not completion of those dependencies or the separate
Population onboarding model.

## Current matrix

Every row must record click-to-first-draw, actual backend, receipt, interaction
results and failure recovery. A missing adapter is a coverage gap, never a native
WebGPU pass. No rows below are browser passes.

| Device/browser target | Paths | Current evidence/status |
| --- | --- | --- |
| Local arm64 macOS / Chromium desktop | automatic, no-WebGPU, no graphics; actual GPU/context loss | Blocked before tests: server listen failed on ports 3199 and 58473 |
| Local arm64 macOS / Firefox | same | Not run; browser binary absent |
| Local arm64 macOS / WebKit | same | Not run; browser binary absent; WebKit runner does not certify Safari |
| Chromium, Firefox, WebKit mobile profiles | automatic, no-WebGPU, no graphics | Discoverable; unrun; viewport/touch emulation only (Firefox uses desktop context with mobile dimensions/touch) |
| Physical M-series laptop / Chrome and Safari | native WebGPU where available and fallback | Not verified; arm64 host identity alone does not establish GPU/device coverage |
| Physical Intel/AMD integrated GPU / Chrome or Edge and Firefox | native WebGPU where available and fallback | Device unavailable |
| Physical iPhone / Safari or Android / Chrome | native where available, fallback, touch controls, rotation | Device unavailable |

The actual startup error and source hashes are retained in
[evidence](evidence/first-play/attempt.json) and [log](evidence/first-play/startup-blocked.log).
Bun reports `EADDRINUSE`; its underlying cause was not established. No browser
launched and no first-frame timings or simulation receipts were generated.

## Reproduction

Use the installed Bun executable if a package-local `bun` shim is broken:

```sh
TMPDIR=/private/tmp bun install --frozen-lockfile --offline
HBL_BUN_EXECUTABLE="$(command -v bun)" HBL_FIRST_PLAY_PORT=58473 \
  bunx playwright test --config test/first-play.browser.config.js
# On a host with these browsers installed:
HBL_FIRST_PLAY_BROWSERS=chromium,firefox,webkit \
  HBL_BUN_EXECUTABLE="$(command -v bun)" \
  bunx playwright test --config test/first-play.browser.config.js
```

Default Chromium discovery: 8 tests. All-engine discovery: 24 tests. Desktop
projects include initialized WebGPU destruction and WebGL context loss. Native
WebGPU loss skips with an explicit unavailable artifact if native initialization
fails. No unsafe/software GPU launch flags are forced by this runner. Use
`--headed` for a hardware-backed attempt and retain adapter identity; headless
results alone cannot certify hardware. Output defaults to
`/private/tmp/hbl-first-play-results` and `/private/tmp/hbl-first-play-report.json`;
archive them before another run (including `--list`) overwrites the report.

Each new test enters through homepage Play Demo and checks the real 121-snapshot
paired run, seed 42 receipt, month 16 housing delta 24, timeline and recorded WHY.
Evidence attachments record browser/version, host CPU/architecture, requested
path, actual backend, available GPU adapter information, recipe/model/run/hash,
provenance and page errors. The no-WebGPU path removes `navigator.gpu` before
startup; the no-graphics path denies canvas contexts and requires inventory
controls to work. These are synthetic capability failures, not physical driver
faults. Existing loss tests destroy the actual configured device/context and
verify unchanged run identity and recorded data through Canvas recovery.

Timing observes the first successful stage Canvas/WebGL draw or WebGPU queue
submission after the homepage click, across navigation time origins. It includes
navigation/model/startup work; it is a submission proxy, not display scanout or
proof that the first submitted frame contains useful geometry. Inventory-only
results have no drawable first frame and retain null timing. Screenshot, ready
state and interaction checks supply the separate usefulness evidence. One sample
is diagnostic only; no speed threshold or public performance baseline is claimed.

## Physical-device protocol and remaining acceptance

1. Record date, OS, exact device/CPU/GPU, RAM, browser/version, URL, commit and
   source hashes, cold/warm cache state, power mode and viewport. Start with a
   fresh browser profile; use seed 42 and the existing default synthetic recipe.
2. From the homepage click Play Demo. Record click-to-visible-useful-frame with
   screen recording or DevTools, explicitly stating measurement method. Capture
   the backend and the visible seed/model/run receipt. Preserve exported recipe,
   initial hash and run provenance. Never substitute a different model's seed.
3. Pause, scrub month 15 then 16, verify housing delta 0 then 24, open WHY, switch
   comparison mode and refresh the shared URL. On phones use touch controls,
   portrait/landscape and check clipping. Record each outcome separately.
4. Repeat with WebGPU disabled, confirm usable WebGL/Canvas fallback. On desktop
   run the initialized-loss tests; preserve before/after receipts and screenshots.
   If loss cannot be induced, record unavailable rather than claiming recovery.
5. Repeat at least three cold/warm attempts if reporting timing ranges; preserve
   every attempt including failures. Compare identical seed/recipe/model/initial
   hash across backends; run IDs can differ for fresh persisted runs. Record
   spontaneous failures separately from controlled injection.

Local verification: 21 focused Bun tests passed, 145 assertions, zero failures
(scene/data/share including real City API persistence/replay). Chromium and
all-engine test discovery passed. Browser execution is blocked as above. No
lint/typecheck scripts exist in package.json. Next action: run this exact suite
on a host that can bind the application server, then fill the physical-device
rows before accepting SHE-175. No deploy, merge or Linear completion performed.
