# GPU conflict reproducibility — SHE-148

This is a bounded synthetic research harness, not an integrated GPU city model.
The checkout initially had only record fingerprints and a water compute solver;
Population remains single-worker. No `docs/architecture.md` exists. Product design,
implementation plan, worker documentation and solver conventions were inspected.
The GitHub open-PR search for SHE-148 returned no matches on November 12, 2026;
this does not establish the readiness of planning dependencies HBL-1M-015/016.
Those dependencies need integration review before adopting these rules in a model.

## Contract and assumptions

`hbl-gpu-conflicts.v1` uses the specified LCG in `workload` to generate synthetic
requests. A request has a bucket (shared resource/contact destination), integer
demand 1–31 and unique agent ID. Output per bucket is request count, total demand
and minimum contact ID. Empty buckets have count/sum zero and winner `0xffffffff`.
This tests a fixed conflict rule, not contact graph evolution, capacity allocation,
floating point sums or first-arrival winners. Maximum 4096 requests avoids u32
overflow. Identities are synthetic and there is no mapping to city entities/time.

The independent sequential CPU oracle operates on request records. GPU strategies:

- Atomic add for counts/demand and atomic minimum for the winner.
- Two-phase reduction: each task scans a 64-request partition for one bucket,
  then a separate dispatch reduces partials in fixed partition order.
- Sort-by-key: unique ranks for `(bucket, agent ID)` place requests in sorted
  scratch storage, followed by a separate per-bucket reduction. This intentionally
  simple O(n²) reference sort is unsuitable for million-agent production workloads.

Each run resets output, dispatches, copies and reads back. Scratch is completely
rewritten before use; separate passes preserve causal write/read dependencies.
Acceptance requires exact element equality against the CPU oracle on all 100
runs, plus one stable fingerprint. Hashes are diagnostic, not cryptographic proof.
No tolerance or bounded nondeterminism is accepted for this integer contract.

## Reproduce and interpret

Run `bun test test/gpu-reproducibility.test.js test/reproducibility.test.js`.
Run `bun scripts/benchmark-gpu-reproducibility.js docs/evidence/gpu-reproducibility.json`
on a machine allowed to bind localhost and launch Chrome. Override `CHROME_PATH`
for other installations. The script uses a temporary isolated Chrome profile and
removes it afterward. No unsafe GPU flags or software fallback are forced.

The browser requests low-power and high-performance adapters. These preferences
can resolve to the same hardware; they are not evidence of distinct adapters.
Collect separate reports on distinct hardware/browser configurations and inspect
adapter info, limits and fallback status before claiming cross-adapter coverage.
Seeds are 0, 42, 2911; each has 257 requests and 17 buckets. Identical input hashes
must accompany comparisons. Reports include model version, machine, browser,
adapter metadata, exact hash frequencies and mismatch counts. Errors or no GPU
measurements cause a nonzero exit rather than a successful CPU-only GPU claim.

Median/p95 times cover each run including reset, submit and GPU readback; hashing
and oracle comparison are outside the timing. GPU setup/compilation is separate.
`medianVsCpu` is end-to-end overhead relative to the browser CPU oracle for the
same seed. These are small cold/steady mixed samples with no warmup, not pure GPU
kernel timings. Report absolute times alongside ratios; timer precision, JIT,
background scheduling and readback latency limit interpretation.

## Actual evidence and remaining acceptance

Eight focused tests passed (25 assertions). They cover collisions, empty buckets,
minimum contact identity, boundary generation, 300 repeated CPU runs, consistently
wrong output and one-run divergence. The benchmark script also bundles with Bun.
Recorded evidence: [CPU measurements](evidence/gpu-reproducibility.json), Apple M4,
Bun 1.4.2, macOS arm64. All three seeds had 100 identical accepted CPU hashes and
zero mismatches. CPU median times were approximately 0.014–0.018 ms in this run.

The browser experiment exited 1 because localhost server startup failed with
`EADDRINUSE` for port 0 in this restricted environment. No browser launched and no
GPU shader, adapter parity, GPU timing or multi-adapter result was verified.
Playwright is not installed in this checkout; no product browser behavior changed.
Next: run the supplied benchmark outside this bind restriction on multiple real
adapters, inspect validation errors and exact parity, then add measured results.
SHE-148 acceptance remains incomplete until those measurements exist.
