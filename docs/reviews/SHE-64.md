# SHE-64 current-source recording attempt — November 15, 2026

Acceptance remains incomplete: no current-source video was recorded. This is an
execution-blocked receipt, not final demo approval. Candidate source is
`8afcacd5891638c6552e7f885a81234ab5bd6bfe`, branch `mini/SHE-64-r3`, base
`sprint/one-city-two-futures-20261111`. No new PR was published.

## Audit and ownership

Read root AGENTS/README, product design, affected implementation-plan entries,
Future Machine handoff, model inventory, review instructions, recording CLI,
canonical browser config, and both linked acceptance test files. There is no
`docs/architecture.md`. This isolated worker owns only this report,
`docs/evidence/she64-r3/`, and the appended implementation-plan status. The five
pre-existing `.mini-symphony-evidence/SHE-64-r3-before*` files are untouched.
One shared recording pipeline needs no parallel workers or new application code.

[Prior PR #125](https://github.com/adnanwahab/happybearlandia/pull/125) merged
`61f1ec900393dd61d1f7c3250a815ae48765144f`. Its checked-in
[receipt](../evidence/she64/README.md) explicitly retains a historical capture,
whose exact capture commit is not independently established. It leaves fresh
current-source acceptance open. No duplicate demo implementation is needed.

Linear readback: HBL-W1-004/SHE-9 and HBL-W1-033/SHE-46 are Done; SHE-46 links
[PR #120](https://github.com/adnanwahab/happybearlandia/pull/120). SHE-64 already
has `hbl-agent-ready` and `hbl-coordinator-approved`. SHE-63 is also marked Done
and links [PR #328](https://github.com/adnanwahab/happybearlandia/pull/328), but
the current [SHE-63 report](SHE-63.md) says no matrix journey reached a browser.
That evidence gap remains a final-recording prerequisite regardless of status.
No Linear status or label mutation was needed or made.

## Existing integrated behavior

`scripts/record-one-city-two-futures.mjs` runs the real SHE-71 journeys in
`test/e2e/one-city-two-futures.e2e.js` through
`test/one-city-two-futures.browser.config.js`. The homepage Play Demo journey
waits for the presentation, then captures Month 0, first added building, WHY,
unchanged control and deterministic rerun. Requests continue to the real City
API; no substituted model responses are used. The CLI requires screenshots,
scenario/metrics JSON, trace and a nonempty decoded WebM before success.
`test/e2e/two-futures-sprint.e2e.js` separately contains the timed 45–60 second
one-click presentation and exact recorded completion-event checks.

Data normalization in `world/future-machine/data/index.js` validates model,
recipe, seed and replay frames. Model authority remains monthly City; no rules,
seed, source data, simulation output, identity or ODD description changed.
Detailed replay remains manifest recomputation, not independently verified
checkpoint equivalence. Model-owned events and narrative WHY do not establish
empirical causal certainty.

## Actual execution

Initial command (exit 1 before browser launch):

```sh
bun scripts/record-one-city-two-futures.mjs --output /tmp/hbl-she64-r3-recording --port 39964
TMPDIR=/private/tmp bun install --frozen-lockfile
```

The first command cannot resolve local `@playwright/test`. Installation also
exits 1: `bun is unable to write files to tempdir: EPERM`. No lockfile changed.
Using the already-installed coordinator dependency tree read-only resolves the
test package but exposes its uninitialized dependency-provided Bun launcher:

```sh
NODE_PATH=/Users/wahabma/happybearlandia/node_modules TMPDIR=/private/tmp /Users/wahabma/.bun/bin/bun scripts/record-one-city-two-futures.mjs --output /private/tmp/hbl-she64-r3-recording-final --port 39964
```

Exit 1 before tests: [recording.log](../evidence/she64-r3/recording.log).
No coordinator dependencies were modified. Direct use of the functioning Bun
executable independently verifies the server blocker:

```sh
PORT=39964 /Users/wahabma/.bun/bin/bun --no-env-file run server.js
python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()); s.close()'
```

Both exit 1. [server.log](../evidence/she64-r3/server.log) reports listen
EADDRINUSE at server.js:440; [socket-probe.log](../evidence/she64-r3/socket-probe.log)
reports `PermissionError: [Errno 1] Operation not permitted` even on an ephemeral
localhost port. Port selection or dependency repair alone cannot solve this
session's listener restriction. No escalation is available under never approval.
No current browser pass, screenshot, renderer/hardware measurement or video is
claimed. The supplied before screenshots do not prove this Future Machine run.

```sh
bun test --timeout 30000 test/two-futures-demo-controller.test.js test/two-futures-evidence.test.js test/future-machine-data.test.js test/future-machine-evidence-trail.test.js test/fixtures/one-city-two-futures/recording-command.test.js
```

Results: exit 0, **28 passed, 0 failed, 159 assertions** across five files;
retained in [contracts.log](../evidence/she64-r3/contracts.log).
An initial run with the default 5000ms timeout had 27 passes and one timeout in
`editing proposed homes reuses the original baseline and leaves prior results
immutable`; the rerun allows 30000ms for the actual simulation. This does not
substitute for browser acceptance. No repository lint/typecheck script exists;
no application or TypeScript code changed. `git diff --check` passed.

## Historical artifact recheck

Copied `docs/evidence/she64` to `/private/tmp/hbl-she64-r3-historical-audit`
before running the verifier, preserving committed historical receipts:

```sh
bun scripts/verify-demo-artifacts.mjs /private/tmp/hbl-she64-r3-historical-audit
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json docs/evidence/she64/one-city-two-futures.mp4
ffmpeg -v error -i docs/evidence/she64/one-city-two-futures.mp4 -f null -
ffmpeg -v error -i docs/evidence/she64/video.webm -f null -
shasum -a 256 docs/evidence/she64/one-city-two-futures.mp4 docs/evidence/she64/video.webm
```

All exit 0. Structural verifier: two browser records, one WebM, Months 0/120.
MP4: H.264, 1440×1000, 56.84s. Both videos fully decode. MP4 SHA-256 is
`be8ada5ed32bb98e16fe8bcc75fe17e3988b19287f8d82f3ea7e617bf950d82f`;
WebM is `d857d79ba5e7bb6afb01d070d822fb5f5b83591a35db9fe530bae9a15f29abfd`.
The [retained video](../evidence/she64/one-city-two-futures.mp4) is playable
historical evidence only, with no independent guarantee of original editing.
No trimming, stitching, speed changes or replacement assets were made here.

Visually inspected the retained WHY frame: Month 120, seed 42,
`city-systems.1.0.0`, run `city_705bdf23e7e64d3b8d6b51f1665d11f6`, completion
event `16-0`, building `building-project-policy-1-0`, and explicit synthetic,
uncalibrated/causal-evidence limitations are visible. Historical receipt recipe:
30 households, 120 months, district d1, +24 homes, illustrative 1,000,000 USD,
delay 0, compliance 1. First added completed building at Month 16 differs from
earlier policy/construction differences. These are historical synthetic modeled
results, not measurements of the current candidate or a real city.

## Remaining acceptance and policy

Resolve actual matrix evidence, then run the existing recorder in a host with
working local dependencies, listener permission and browser access. Use a fresh
artifact directory, pin exact source SHA and runtime versions, decode and view
the continuous video, verify screenshots/WHY/divergence and record hashes with
its actual model/seed/run identity. Do not replace the historical receipt's
model version or claim its video represents the current candidate.

Inspected `.github/workflows/auto-merge.yml`: merge job remains under literal
`false`; existing voting/auth/check requirements are unchanged. Remote branch
protection was not independently certified. No merge, deployment, production
mutation, external message, workflow dispatch or source-control policy change.
