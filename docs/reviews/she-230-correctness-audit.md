# SHE-230 correctness and determinism audit

Audited source HEAD: `b963dd353538294cb0fbf5d34d5283fad6e10e68` (clean before audit).
Runtime: Bun 1.4.2. Local audit, November 12, 2026. No production changes,
engine fixes, Git commits, pushes, or issue mutations.

Scope: real monthly City engine, contracts, generator, persistence/API tests,
Future Machine adapter and seed-sweep harness. Read product design,
implementation-plan sections for this journey, City README, Future Machine data
README and frozen interfaces. No docs/architecture.md or deeper AGENTS.md exists.
This is a bounded audit, not certification of the separate Population, House,
Decision Studio, legacy paired, or constitution models.

Overlap checked via full Linear issues: SHE-59 Done, linked PR32, already supplies
106-case replay evidence; SHE-76 In Review owns the paired data implementation.
Neither is reimplemented. Existing evidence is historical; this audit reran the
focused sweep tests, not the entire 106-case acceptance command.

## Reproduction artifact

`artifacts/she-230/0001-city-audit-probes.patch` is an email-format patch for
`git am`, adding only `test/she-230-audit.test.js`. Apply in a disposable clone:

```sh
git am /absolute/path/to/artifacts/she-230/0001-city-audit-probes.patch
bun test test/she-230-audit.test.js
```

Actual local execution before packaging: **4 pass, 0 fail, 9 assertions**.
These are explicitly characterization tests: they assert today's bad behavior
and reproduce it without changing the model. Convert to intended invariants
when implementing each approved fix. Every case uses real createEngine/step/run,
seed 42, 30 households, city-systems.1.0.0. Parcel capacity is set to zero to
isolate public policies from private development. No empirical numerical target
is invented; assertions follow existing rules and exact inventory/ledger sums.

## Findings

### F1 — confirmed, medium: zero compliance still changes physical policy outcomes

Location: `world/city/systems.js:46` and `:138`.
Reproducer: first patch test. Run a zero-cost, zero-compliance transit intervention
in d1, amount 10, for 12 months against a matched control. Transit capacity is
unchanged, but `transit-d1-d0.freeTime` changes **18 → 14.4 minutes**.
A zero-compliance upzone of amount 10 also changes d1 parcel capacity **0 → 10**
after four months. Both are accepted public intervention inputs.

Root cause: governance scales project amount by compliance, but transit always
multiplies freeTime by .8 even when that amount is zero. Upzone uses raw amount
for both capacity and FAR while recording adoption zero. This explains a real
worldline difference despite zero adoption; replay consistency alone misses it.

Pattern search: housing units and utility/school/resilience project amounts
already multiply compliance. Transit has a second unscaled speed effect;
upzone bypasses project scaling entirely. The separate constitution compiler
has its own compliance regression coverage; no change to that model is implied.

Smallest safe fix: use effective amount for upzone capacity/FAR; gate the transit
speed benefit on positive implemented amount. Preserve the existing .8 factor
for positive adoption until a separately versioned speed-response rule is agreed.
Do not infer that zero compliance refunds an already incurred capital cost.
Regression: zero compliance leaves capacity/FAR/freeTime unchanged across seeds;
positive compliance preserves established behavior. Bump the model/rules version
for equation changes so old saved runs cannot silently replay differently.

### F2 — confirmed, medium: flood events attribute cumulative damage to one district

Location: `world/city/systems.js:13–20`.
Reproducer: third patch test. Set district floodRisk to 1 and schedule simultaneous
severity-1, duration-1 floods in d0 and d1 at Month 1. Recorded event damage:
d0 **144,000**, d1 **309,600**; actual d1 unit-derived damage is **165,600**.
City damage is correctly 309,600, but summing event payloads gives 453,600.

Root cause: the city accumulator `damage` is also emitted as each district/shock
payload. Geography and shockId make it appear local. Event attribution changes
with shock insertion order even though the city total is unchanged.

Pattern search: this is the only FLOOD_DAMAGE producer. Other active-hazard
payloads do not carry this accumulator. Storage/adapter preserve events; no
consumer-side subtraction should be introduced.

Smallest safe fix: accumulate `shockDamage` inside each flood, add it once to the
city total, emit only shockDamage in the event. Keep city aggregate semantics.
Regression: event damage equals the affected-unit sum; per-event sum equals city
damage, including reversed shock order and a zero-damage shock. Preserve/version
the changed event semantics for replay compatibility.

### F3 — confirmed, low: atomic capacity batch leaks reservations on exception

Location: `world/city/contracts.js:31–34`.
Reproducer: second patch test. Register water capacity 10; reserveAll requests
water 8 followed by water NaN. The second reserve throws, but used remains **8**.

Root cause: rollback handles a false return only, not a thrown validation error.
This contradicts the documented atomic batch abstraction.

Pattern search: both current City batch callers are construction (utility
headroom and monthly resources). Their normal amounts are generated from
validated state; this audit did not demonstrate a corrupt normal engine result.
A thrown step discards its private registry/draft, limiting current impact.
Existing test covers insufficient capacity rollback, not exceptional rollback.

Smallest safe fix: restore the snapshot in catch and rethrow (or prevalidate the
whole batch before reserving). Test invalid later requests and retain existing
insufficient-capacity behavior. This is an abstraction defect, not evidence of
persisted budget/population corruption.

### F4 — suspected, low: newly displaced households miss this month's housing search

Location: housing proposal/resolve in `world/city/systems.js:222,256`;
proposal snapshot ordering in `world/city/engine.js`.
Reproducer: fourth patch test. Set all leaseUntil to 100, d1 floodRisk to 1, and
flood d1 at Month 1. **10 households become unhoused**, yet housing proposals
and housing decisions are empty. They can search next month.

Mechanism confirmed: all proposals use STATE(t); environment subsequently
vacates units on the draft. Housing resolves only the old searcher IDs. This
also applies to displacement during construction permit resolution. The README
says resolved inventory is used but does not specify whether new displacement
must trigger same-month applications, so the incorrectness remains suspected.

Smallest safe action: decide and document the intended lag. If same-month search
is intended, union proposed IDs with draft households lacking a unit, deduplicate
and sort deterministically. Keep proposal immutability. Add flood and construction
displacement tests; version the changed monthly transition. If lag is intended,
retain behavior and disclose it in modeled housing outcomes.

## Checks and limits

Actual command:

```sh
bun test test/city-systems.test.js test/city-seed-replay-sweep.test.js test/future-machine-data.test.js test/future-machine-boundaries.test.js test/future-machine-scrub-identity.test.js
```

**29 pass, 0 fail, 391 assertions, 22.50s**. Includes reverse system registration,
independent replay, immutable Month 0, boundary seeds 0/4294967295, SQLite-backed
create/reopen, invalid manifests, abort/retry, absent capital ledgers, and reverse
scrub/Canvas mapping. Small probe suite: 4 pass, 0 fail, 79ms. No configured
lint/type-check script exists. No application behavior changed; Playwright was
not run. Existing tests cover real API/worker persistence, not just mocks.

Confirmed observations that are not findings: cityMetrics.meanTravelMinutes is
mean link time; transport.meanMinutes is mean experienced trip time. In the
flood fixture they are 90 and 0 respectively (zero trips). Future Machine labels
minutes/link explicitly; these different denominators are not a demonstrated
cross-page disagreement. Event IDs are arm/month local by documented contract.
No Math.random/Date.now use was found in monthly City source.

Untested: browser rendering under concurrent simulation and backend switches;
full 106-case rerun on this HEAD; deployment/multi-process persistence races;
long-horizon population/budget invariants beyond retained tests; empirical seed
distribution quality; all non-City simulation models. No confirmed same-seed
nondeterminism, hidden simulation global state, or impossible budget/population
transition was found in the tested scope. Exact replay does not establish
scientific validity. Synthetic assumptions and illustrative equations remain
uncalibrated. Next work is the small F1/F2 repairs with replay version handling,
then F3 rollback and the explicit F4 timing decision; none is silently applied.
