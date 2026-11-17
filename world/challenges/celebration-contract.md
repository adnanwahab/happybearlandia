# Verified completion decoration v1

Entry: `/world` → Quests → Open city challenges (or Challenge a friend).
The unchecked **Optional completion stars** control applies only to future
successful local verifications. No network, telemetry, sound, rewards, streaks,
simulation pause or population inference is added.

Authority is the panel-owned verification worker (`verification.worker.js` →
`verifyChallenge` in `contract.js`). Only its current-generation RESULT handler
feeds the decoration. Arbitrary window events, imported claimed scores,
needs-threshold objectives, chart deltas and descriptive headlines never do.
`celebrationOccurrence` is a defensive consumer, not a signature validator or a
standalone anti-cheat verifier; do not call it on untrusted result payloads.

Required contract: validated frozen envelope with ID, SHA256 digest, initialHash,
seed and action menu; `city-challenge-verification.v1` result with matching
challengeId, both replay initial hashes and seeds, won=true, challenge-beaten,
both capital caps passing, nonempty passing guards and available/no-worse finite
metric deltas with at least one strictly better metric. Candidate action IDs
must be unique and in the frozen menu. Worker verification owns full replay and
rule validation. Missing/invalid/mismatched evidence produces no decoration;
the existing result/status UI explains unavailable measurements or errors.

An occurrence is the frozen envelope digest plus sorted candidate action IDs.
Re-verifying that exact recipe is the same occurrence, including after plan
switches or close/reopen. The panel session consumes successful occurrences even
when effects are off, preventing retrospective bursts on opt-in. At 256 unique
occurrences the gate fails closed; it never evicts and repeats a burst. Reload
or destruction starts a new panel session; deduplication is not durable across
page visits. A new frozen recipe has a new digest. No occurrence IDs are written
to storage and simulation/replay records remain unchanged.

The seven stars are purely decorative authored geometry; their number and
motion encode no model quantity. They animate once for 700ms and the inline
acknowledgement disappears after 2400ms, or immediately on Skip, opt-out, close,
cancel, new verification, load or destruction. Reduced motion shows the same
static text and Skip without animated stars; preference changes cancel active
animations. No requestAnimationFrame loop, GPU object, audio or model resource
is allocated. Disposal cancels animations, timer and preference listener.

The model values are computed synthetic City results under frozen authored
assumptions, not observed external outcomes or evidence that a policy caused an
empirical improvement. The UI explicitly says local model challenge; existing
rules, capital scope, guard limitations and source details remain inspectable.
No social mechanism or model rule changes, so ODD inventory changes are not
needed. Existing monthly City description remains applicable.

Deterministic representative fixture:
`test/fixtures/celebration/verified-challenge.js` uses seed 42, six synthetic
households, a declared housing shortage, utility capacity 10000, a 20-month
horizon, 5000 synthetic USD cap and a two-home/1000 USD action. Employment guard
is explicitly disabled in that fixture; other enabled guards still pass.
This is a reproducible test scenario, not a default-world claim.

Checks: `bun test test/challenge-celebration.test.js test/challenge-contract.test.js test/challenge-ui.test.js`.
Focused normal-entry browser check:
`bunx playwright test --config test/challenge-celebration.browser.config.js`.
`HBL_FM_PORT` selects an isolated port; `HBL_BUN_EXECUTABLE` can select the real
Bun executable when a script-disabled dependency shadows it. Browser execution
and physical-device frame-time qualification remain required when unavailable;
unit disposal checks do not establish device performance.
