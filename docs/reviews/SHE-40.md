# SHE-40 acceptance audit — 2026-11-14

Status: partial implementation verified; measured-budget acceptance remains blocked.
Branch `mini/SHE-40-r2`, starting commit `7cbb9c7f7aba2f85f29285ffe8e3cca39149a508`,
target `sprint/one-city-two-futures-20261111`. No new commit or PR published.

## Audit and ownership

Read repository AGENTS.md, product design, affected implementation-plan entries,
first-interaction, City performance and cold-start documentation. No root README
or docs/architecture.md exists. No more specific instructions apply to the owned
files. Initial checkout was clean. Read-only status checks across registered
worktrees found no uncommitted changes in the five claimed files: calibration
module, its unit test, existing browser test, performance documentation and this
review. The coordinator plan update is recorded below without changing the shared
plan or runtime files. No independent implementation tasks warranted delegation.

[PR #74](https://github.com/adnanwahab/happybearlandia/pull/74) is merged
(`f88d759c7db43116f00864627b2f99a97851068d`); its body explicitly says process
completion is not acceptance. Source already implements emulated profiles,
normal homepage → Play Demo → Month 16 measurements, raw CI artifacts and proposed
limits at worst sample × 1.25. Both configured limits objects remain empty.
SHE-201's City guardrails and House/Decision performance tests measure other
workloads and cannot substitute for these baselines.

[SHE-11](https://linear.app/shel-bernstein/issue/SHE-11/hbl-w1-006-capture-cold-start-performance-on-each-renderer)
is currently Done, but its merged follow-up
[PR #303](https://github.com/adnanwahab/happybearlandia/pull/303), present locally
as `19b18ad9`, still documents no browser measurements. Its acceptance-correction
comment explicitly retains the SHE-40 evidence gate. A status or merge alone
does not satisfy it. Earlier attempts and issue criteria remain intact.

## Concrete gap addressed

`scripts/performance/first-interaction-budgets.mjs` previously accepted any one
report per profile with three positive metric rows, including a failed test's
partial artifact. The browser harness now marks a report passed only after all
samples, cleanup and assertions succeed. Calibration requires that marker, the
expected schema, exact profile settings and sample count, environment provenance,
ordered runs, seed 42, month 16 and consistent model/hash/actual backend evidence.
Unknown/fallback-only backends cannot qualify. This does not certify hardware.
The existing CLI uses the validator; tests exercise actual proposal-file creation
and nonzero CLI failure without a proposal using explicitly synthetic fixtures.
No numeric limit, model rule, source history, data identity or disclaimer changed.

## Verification

Commands executed from the repository:

```sh
bun test test/first-interaction-budgets.test.js
bun test test/cold-start-report.test.js test/performance-budgets.test.js
bun test test/first-interaction-budgets.test.js test/cold-start-report.test.js test/performance-budgets.test.js
node --check scripts/performance/first-interaction-budgets.mjs
node --check test/e2e/first-interaction-budget.e2e.js
HBL_PERF_CALIBRATE=1 HBL_PERF_BUN=/Users/wahabma/.bun/bin/bun bunx --no-install playwright test --config test/first-interaction.browser.config.js
bun scripts/benchmark-cold-start.mjs http://127.0.0.1:39940 /private/tmp/she40-r2-cold-start.json > /private/tmp/she40-r2-cold-start.log 2>&1
git diff --check
```

Bun 1.4.2: calibration tests passed 4 tests / 49 assertions, exit 0.
Separate existing-contract run passed 7 tests / 273 assertions, exit 0.
Combined command reports 11 passing tests / 322 assertions but exits 1;
this interaction remains unresolved and is not a green combined check.
Syntax and whitespace checks passed. No root lint/typecheck script exists in
package.json; no TypeScript interfaces changed.

Playwright exited 1 before tests: isolated server listen failed with EADDRINUSE
at server.js:437, port 39940. Existing listener was not reused. Separate cold-start
harness exited 1 and wrote JSON at 2026-11-14T13:33:13.532Z; both requested WebGL
and Canvas2D launches failed at Chromium MachPort rendezvous with Permission
denied (1100), before navigation. Host Apple M4 / Darwin 24.6.0 / arm64 / 16 GiB;
configured viewport 1440×900, DPR 1. Browser version, selected backend, timings and
memory are unavailable. The local JSON/log paths are attempt artifacts, not
portable baseline evidence. No UI changed, page opened or screenshot produced.

## Remaining acceptance and coordinator plan update

Keep SHE-40 incomplete: obtain independently verified SHE-11 measurements, run
the existing CI calibration on a host with functioning server/Chromium, inspect
all three cold samples per emulated profile, retain their raw provenance, review
and pin numeric limits, then run fixed-limit enforcement. CI was inspected, not
executed remotely. Total peak memory remains unsupported: the current metric is
sampled main-page V8 heap, excluding workers, GPU and native/process allocations.
Neither emulated profile is physical laptop/mobile testing. No device or native
WebGPU performance claim is supported.

Merge policy preserved: `.github/workflows/auto-merge.yml` keeps the merge job
under literal false. `.github/scripts/auto-merge.cjs` retains current-head/base
checks, required CI, review/hold and unresolved-thread checks. Remote protection
settings were not modified or independently certified. No voting/auth/quorum,
release gate, production, merge, deployment or external-message action occurred.
