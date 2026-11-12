# Reproducible headless benchmark (SHE-171)

Review candidate. Run explicitly with installed dependencies and Chromium:

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun scripts/benchmark-million.js /private/tmp/million.json 30 42
```

Optional fourth argument selects a unique comma-separated subset of
`10000,100000,1000000`; steps are 1–600 and seed is uint32. Defaults run all
nine size/phase combinations. No application server, persistence, external
requests or application routes are involved: Playwright intercepts and serves
only the pinned benchmark modules. The manual GitHub workflow runs the same
command and retains the report, including failed runs. This is not a CI budget
or production performance gate.

Each phase opens a fresh 800×600 DPR1 page and starts identical state. Setup is
excluded; no warm-up is hidden. `compute-only` runs synchronous fixed steps,
`render-only` repeatedly draws unchanged state, and `combined` steps then draws
on animation callbacks. There is no worker or production population adapter.
Render-only reports zero updates/interactions and null step time; compute-only
reports zero rendered points and null frame/callback time. A rendering failure
is an error, never an automatic compute substitute. Failure exits nonzero and
writes status/error plus completed records. Invalid recipes fail before launch.

Model/rules/source `hbl.synthetic-paired-transfer.v1`: ID is array index,
initial energy is10 per resident, abstract tick starts0. Each tick advances a
uint32 LCG (1664525,1013904223), selects offset modulo size, then pairs adjacent
IDs in wraparound order. Nonempty donors transfer exactly one unit. Pairs are
disjoint within a tick; every counted interaction changes both stored states.
Agent updates count those transitions, distinct changed IDs are separately
tracked, and empty donors count neither. This is an uncalibrated synthetic
schedule, not PR34's bounded fixture or PR50's scalar oracle. Their limits and
contracts remain intact. Replay retains seed, tick count, final PRNG/state digest,
energy invariant, module SHA256 hashes and model version. The compact digest is
a regression check, not cryptographic proof or an event log; exact events can
be regenerated from this recipe. No cross-model causal equivalence is claimed.

Each record includes per-step counts/time and per-draw completion time plus RAF
callback intervals. `frameMs` includes position encoding, buffer upload, draw
submission and blocking `gl.finish`; it is not presented-frame or GPU-only time.
Points overlap, especially at1M: submitted instances do not establish visible
avatars. Step timing includes changed-ID instrumentation. Wall time includes
callback waits and memory sampling, excludes setup and final digest. Run multiple
repetitions with identical recipes/source hashes and environment before drawing
performance conclusions; timings themselves are not reproducible constants.

`peakMemory` is the maximum sampled `performance.memory.usedJSHeapSize`, or null
when unavailable. It is a page JS heap observation at setup and step boundaries,
not a true process/GPU peak and may be coarse or miss transient allocations.
Portable total peak memory remains unavailable. Browser version/UA, viewport,
device memory/concurrency, GL identity, OS/release/architecture, CPU/RAM and runtime
versions accompany observations. Headless software rendering is not a device GPU
certification. No public million-agent capacity claim is authorized.

Validation: `bun test test/million-benchmark.test.js test/agent-counts.test.js`.
On this sandbox, Chromium launch was denied by macOS MachPortRendezvous
`bootstrap_check_in` (permission denied). The CLI exported failed status and
exit1. Render-only/combined actual browser execution remains unverified here;
run the manual workflow or the command above on a browser-capable host before
accepting performance numbers. Unit tests cover all three sizes and compute
phase exports, deterministic replay, a separate first-tick scalar oracle,
conservation, empty donors and invalid inputs. No lint/typecheck scripts exist.
