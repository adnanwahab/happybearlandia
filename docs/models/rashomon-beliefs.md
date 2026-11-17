# Rashomon toy belief overlay — rashomon-beliefs.v1

## Purpose and patterns
Explain disagreement through limited attention to three different local observations
of one recorded synthetic event. This is an authored teaching model, uncalibrated
against measured cognition or testimony.

## Entities, state and scales
Three City workers from distinct households selected by flood-perspectives.v1:
rehoused, still unhoused, and unreachable commute. The existing reader supplies
City identities, month-1/month-2 checkpoint links, seed and model version.
The separate ledger retains the single flood event ID. Belief records contain
that same ID, a local observation and unknown cause/other-household fields.
No Population/House identities or clocks are inferred.

## Process and scheduling
Load completed demo world-only-2911; validate recorded-playback checkpoints,
City version, identity, tick and seed using loadPerspectives. Require seed 2911,
month 2, seven damaged units and three available roles. Construct all three
snapshots once, recursively freeze the result, then reveal in order on request.
Cancel drops local results and invalidates pending asynchronous reads. No writes,
simulation advancement, RNG draws or new City checkpoints occur.

## Design concepts
Limited attention is a synthetic assumption: each role attends only to its own
housing/commute observation. It is not evidence of actual resident knowledge.
Scripted first-person lines express this attention; they are not recorded speech.
The commute observation comes from a separate transport event in the same month;
it does not prove flood causation. Cause and knowledge of other households remain
unknown. No learning, diffusion, interaction or causal inference is modeled.

## Initialization
Explicitly record the existing pinned World Time Machine demo before opening.
No auto-recording or fallback fixture disguises missing data. The existing City
authority owns and retains the immutable source checkpoints and event ledger.

## Input data
Existing stored synthetic City events and checkpoints, not real-world measured
observations. Source rules: world/civilization/perspectives/model.js. Belief rules
and UI: world/rashomon-mystery.js. Seed-matched reloads must return equal results;
a later incompatible engine/checkpoint yields an error rather than fabricated data.

## Submodels and invariants
Reuse the existing flood role selection, reserving the commuter before housing
roles. Every belief event ID equals the factual ledger ID; three households are
distinct; source seed/version/ticks remain verified. Beliefs and scripted flavor
never update facts. Missing source/event/run, incomplete runs, absent checkpoints
and replay mismatch expose no accounts. Tests: test/rashomon-mystery.test.js,
test/rashomon-perspectives.test.js and test/e2e/detective.e2e.js.
