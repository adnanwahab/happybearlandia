# Resident demo evidence card (SHE-153)

Open `/world/bench/people`, follow **Resident demo evidence card**, and upload
an exported receipt. Direct route: `/world/demo-evidence.html`.

```sh
bun scripts/export-demo-evidence-receipt.js 4096 1000 42 > /private/tmp/resident-receipt.json
bun test test/demo-evidence.test.js test/agent-counts.test.js
node test/demo-evidence.browser.js
```

`resident-demo-receipt.v1` contains the complete bounded CPU run (initial states,
events, final states, model/rules/seed), positive monotonic `wallSeconds`, capture
time, machine CPU/OS/architecture/runtime, and reproduction command. Timing
includes fixture setup and event allocation, excluding validation/export.
Existing aggregate benchmark JSON and canonical monthly City receipts are
intentionally unsupported: neither carries this adapter's replayable transitions.
No production model authority or entity identity is changed.

The browser replays the receipt using SHE-141's versioned metric validator and
exports `resident-demo-evidence.v1`. Six counts, rates, prose, model versions,
seed, adapter limits, machine and outcome come from this receipt and its pinned
adapter. Extra caller-supplied claims and review status do not authorize claims.
Unknown/malformed receipts and missing device/timing fail closed; a failed upload
clears the previous result. No receipt is fetched or uploaded to a service.

The CPU adapter cannot demonstrate a million records. Its zero avatar/cohort
counts describe this headless run only, not the surrounding game. Active means
distinct changed states in this run, not scheduled work. Timings/device are
self-reported; replay validates transitions, not benchmark authenticity. This is
a synthetic, uncalibrated energy-transfer rule with no social-science inference.
See [metric assumptions](agent-counts.md) and the linked CPU oracle tests.
SHE-151 architecture results and human claim review remain pending.

## Executed evidence

2026-11-12T20:22:16.281Z: command above, Apple M4, Darwin 24.6.0 arm64,
Bun 1.4.2, seed 42. Six counts: 4096 / 1680 / 2000 / 1000 / 0 / 0.
One cold fixture run took 0.001233584 wall seconds, yielding approximately
810646 pair events/second; render FPS unavailable. This short single measurement
has no warmup/repetitions/uncertainty interval and supports no sustained or
million-scale throughput claim. Raw receipt retained only at
`/private/tmp/she153-receipt.json`; regenerate using the command above.

13 tests passed, 294 assertions, including real CLI success and rejected million
records, event tampering, missing metadata and deterministic replay. No lint or
typecheck commands are configured in package.json. `git diff --check` passed.
The browser integration script covers empty/upload/replay/download/invalid input
and mobile width, but could not execute: Chromium failed at macOS
MachPortRendezvous bootstrap with Permission denied (1100). Application server
startup also returned EADDRINUSE for ports 3153 and 0 in this sandbox. Browser
behavior and normal-route integration remain unverified until that check runs
in a permitted environment. No human review, merge, deployment or publication
was performed.
