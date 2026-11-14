# First-interaction budgets — SHE-40

Status: measurement infrastructure implemented; numeric budgets await a successful
baseline run. No mobile or laptop hardware has been tested by this change.
Dependency HBL-W1-006 / SHE-11 is marked Done in Linear (inspected 2026-11-14),
but its latest committed evidence still has no successful browser measurements.
Do not treat this slice as completion of that renderer-wide cold-start audit.

## Audit and scope

Existing House performance tests cover checkpoint worker responsiveness, saved-home
fetch reuse, paused frame work and render resources. Decision performance tests
measure simulation throughput. Future Machine documentation records local saved
replay readiness near 0.65 seconds and sampled heap around 68 MB, with larger
recipes reaching roughly 109 MB. Those are different workloads and cannot justify
homepage first-interaction budgets. No existing mobile/laptop first-interaction
budget gate was found. `docs/architecture.md` is absent.

Owned slice: the dedicated first-interaction config/test, budget JSON, calibration
module and unit test, dedicated CI workflow, this document and the plan status.
Application and simulation behavior are unchanged. Branch: `mini/SHE-40`.
No deployment, merge, Linear dispatch-state change or physical support claim.

## Reproduction and definitions

```
bun install --frozen-lockfile
bun test test/first-interaction-budgets.test.js
bunx playwright install --with-deps chromium
HBL_PERF_CALIBRATE=1 bunx playwright test --config test/first-interaction.browser.config.js
bun scripts/performance/calibrate-first-interaction.mjs
```

If the local dependency's Bun shim is unavailable, set `HBL_PERF_BUN` to the system
Bun executable. The dedicated config uses an isolated temporary simulation store.
Each sample uses a new browser context with cache disabled and the normal homepage
Play Demo link, synthetic default seed 42, and the existing source-of-truth history.
There are three cold samples for each declared profile:

| Profile | Viewport / DPR | CPU slowdown | RTT | Down / up bytes per second |
| --- | --- | --- | --- | --- |
| laptop-emulated | 1366×768 / 1 | 1× | 20 ms | 12500000 / 1250000 |
| mobile-emulated | 390×844 / 2 | 4× | 80 ms | 1250000 / 625000 |

These are lab profiles, not hardware models. Browser version, host CPU, commit,
seed, model version, initial-state hash and actual renderer backend are recorded.
The default renderer is measured; this is not an all-renderer certification.

| Metric | Measurement window and unit |
| --- | --- |
| `jsBytes` | Sum of decoded script response bodies requested by homepage (including its frames) and demo through the first interaction. Includes repeated response bodies, not compressed transfer size. |
| `readyMs` | Host monotonic time from homepage navigation through Play Demo, ready state, pause and enabled time slider. Includes automation overhead. |
| `renderMs` | Browser monotonic time from slider input at Month 16 through two animation frames, with the resulting month verified. Render opportunity proxy, not physical scanout or FPS. |
| `peakHeapBytes` | Maximum sampled main-page V8 used heap at 50 ms intervals plus endpoint; excludes workers, GPU and native/process memory. Short peaks may be missed. |

Peak *total* memory is unsupported by this harness and must remain unverified.
CPU emulation is host-relative. Network/CPU emulation targets the main page;
subframes/workers and external service variability limit device fidelity.

## Choosing and enforcing budgets

The workflow uploads raw `measurement.json` reports even on test failure. A
successful calibration creates `budget-proposal.json`: each limit is
`ceil(max(three cold samples) × 1.25)`. The 25% allowance is an explicit policy
choice, not a measured confidence interval. Missing, nonfinite or nonpositive
metrics cannot produce budgets. Keep raw baseline evidence with the reviewed
limits; do not silently recalibrate a regression.

After CI succeeds, review its baseline and copy each proposed `limits` object into
`test/performance/first-interaction-budgets.json`. Run the same browser command
without `HBL_PERF_CALIBRATE=1` to enforce those fixed limits. Until then it fails
closed with `Uncalibrated budget`. The current CI job is calibration only and does
not claim a regression pass. A later gate should run on application changes after
baseline limits are pinned; the present workflow runs on measurement-code PRs
or manual dispatch.

## Verification and unresolved evidence

- `bun test test/first-interaction-budgets.test.js`: 2 passed, 10 assertions.
- Browser test discovery: two profile tests (see final verification).
- Calibration attempted using the installed system Bun on ports 39884 and 39940;
  server could not listen. Independent Node `net.listen(0, '127.0.0.1')` returned
  `EPERM`, confirming the sandbox socket restriction. No browser execution or
  numerical measurement is claimed.
- No UI changed; no screenshots are required. No PR or CI run was published.

Next: execute CI calibration, inspect completeness and host variability, pin
measured numeric limits, run fixed-limit enforcement, then expand memory accounting
and renderer coverage using SHE-11 evidence. SHE-40 remains incomplete until the
measured budgets are selected and verified.

## Completion sprint follow-up — 2026-11-14

PR #74 merged the existing harness, not measured numeric budgets. The follow-up on
`mini/SHE-40-r2` adds a report completion marker and rejects incomplete calibration,
incorrect profile settings/sample counts, absent environment provenance and
inconsistent seed/model/hash/backend evidence. Old reports without a completion
marker require a fresh run. The generator's 25% allowance is unchanged. Tests use
explicit contract fixtures, never baseline observations. See
[the acceptance audit](reviews/SHE-40.md) for exact commands and remaining gates.
SHE-11's Done status does not supersede its missing measurement evidence.
