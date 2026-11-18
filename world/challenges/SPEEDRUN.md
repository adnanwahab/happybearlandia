# Change-One-Thing v1

Entry: `/world/challenges.html` → **Try the Change-One-Thing Speedrun**.
This is a local scoring overlay on Monthly City, independent of the six scripted
missions, tournament, daily Population and Decision Studio. No cross-model IDs or
clock mappings are claimed. Nothing is uploaded or persisted.

`fixtures/speedrun-v1.json` is the authored immutable source checkpoint, including
its original City engine version, seed 42, full initial state, frozen action menu,
capital cap 5,000 synthetic USD and 20-month horizon. `SPEEDRUN_DIGEST` pins its
SHA256 envelope identity. An incompatible engine or altered source refuses to run.
Do not regenerate the fixture to silently accommodate model changes: publish a
new scenario/rules version and document the difference.

Initialization assumptions: six synthetic households; existing units unavailable
(under construction without assigned households); parcel capacities zero to block
ordinary development; each utility capacity 10,000. District IDs d0/d1 belong to
this City checkpoint only. Housing adds two homes in d0 at illustrative cost
1,000; transit adds capacity 10 in d1 at cost 2,000. Ordinary engine funding,
construction and assignment rules remain active. Employment protection is disabled
for this housing-only objective; population retention and housing-access guards
remain. This is an artificial shortage puzzle, not an empirical neighborhood.

Choose exactly one frozen action. Reference chooses none. Both arms start from the
same checkpoint and seed. The runner executes the pair twice and compares full
results, including state, observations and monthly capital ledgers. Cancellation,
missing source/observations, invalid selection, budget/guard failure, incompatible
version or replay mismatch yields no placement. Submitted scores are never inputs.
These checks demonstrate reproducibility within this implementation; no independent
model validation or authenticated leaderboard is claimed.

Score v1 is `round(100 * clamp((referenceUnhoused - candidateUnhoused) / 6, 0, 1))`.
Six is the fixed starting-household count, not a changing outcome denominator.
A successful verified improvement places first among the single displayed local
attempt. Non-improvement scores zero and has no placement. The scoreboard replaces
the prior attempt; it never invents other players. Equal outcomes always score
equally. No time bonus, scarcity, deadline, auto-submission or penalty applies.
The optional elapsed timer starts paused, pauses on tab hiding and when running,
and resets explicitly. Sixty seconds is a self-chosen practice target only.

Provenance: source and capacities are synthetic assumptions; final household
counts and capital are modeled observations; the title/prompt are scripted flavor.
There are no measured real-world observations. The evidence disclosure retains the
source envelope, matched arms, complete monthly capital ledgers, final states,
metric definitions, engine/rule versions and independent-replay verdict together.
Intermediate monthly state checkpoints are not retained; no scrubbable history is
claimed. Initial and final snapshots remain available without editing the source.

No agent rules, scheduling, RNG or state authority changed. See the existing
[City ODD](../../docs/models/city.md) and [City contract](../city/README.md).
Verification: `bun test test/speedrun.test.js test/challenge-contract.test.js
 test/challenge-ui.test.js test/challenge-celebration.test.js
 test/business-challenges.test.js` (run as one command).
Browser: `bunx playwright test --config test/speedrun.browser.config.js`.
