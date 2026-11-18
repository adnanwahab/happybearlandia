# School-run authored crossing toy — ODD

## 1. Purpose and patterns

An educational queue puzzle at `/world/challenges.html`, independent of City and
Population. Reduce executed queue delay and finish all eight trips by second 65.
It is synthetic and uncalibrated: no surveyed school times, traffic observations,
collision physics or real-world safety inference. “Chaotic morning” is scripted
flavor, not an observed incident.

## 2. Entities, state and scales

`world/school-run/model.js` pins `school-run.v1`, fixture
`synthetic-maple-morning.v1`, seed 702. Eight IDs `pupil-1` through `pupil-8` and two
crossing resources (`main`, `garden`) exist only in this authority. Time is integer
seconds after a synthetic 08:00; it has no date/timezone or mapping to another
model's clock or residents. Each trip records departure, walk, service duration,
deadline, assigned crossing, ready/start/end, delay, lateness, event ID and causal
predecessor. Runs retain the complete source, rule version, seed, plan and trips.

## 3. Process overview and scheduling

Process pupils in authored ID order, which also resolves simultaneous arrivals.
Each starts at second zero, walks 20 seconds, and reserves one crossing for 10
seconds. Garden adds a fixed synthetic 5-second approach. Set start to the maximum
of arrival and prior reservation end; update that crossing's next-free time.
There is no interaction between the two resources. Record predecessor event ID
within each crossing. All three plans execute to completion before scoring.

## 4. Design concepts

Congestion emerges from exclusive queue service; there is no adaptation,
learning, sensing, stochastic behavior, negotiation or empirical route choice.
Only three authored safe toy adjustments exist: all main, alternate garden, all
garden. “Safe” means exclusive non-overlapping crossing reservations within these
rules; roads, vehicles, conflicts outside each crossing and physical injuries are
not modeled. Seed 702 is retained and matched between arms but consumes no random
draws. These are deterministic comparisons, not statistical uncertainty estimates.

## 5. Initialization

`DEMO` is deeply frozen and includes all eight identical departure/walk/service/
deadline inputs. Both arms start with empty crossing queues from the same source.
Every executed checkpoint is a deeply frozen clone; a later run never mutates its
parent. Initialization is authored, with no generated or inferred missing pupils.

## 6. Input data

All inputs are authored synthetic constants in `model.js`. No external observations
are available. The bounded v1 executor accepts only the exact pinned fixture and
known plans. Missing/empty source fails without a score; changed source, seed,
version or trip order fails as a replay mismatch. Cancellation discards UI results
and late loader completions. No caller-submitted aggregate score is trusted.

## 7. Submodels, scoring and invariants

Queue delay = start − ready, not the total trip duration. Lateness = end > deadline
(the exact deadline is allowed). Sum delays over the actual completed trip
records; count late records. Win requires strictly smaller delay than the executed
all-main baseline and zero late arrivals. Baseline: 280 seconds queue delay, four
late; split: 120 seconds, zero late; all-garden: 280 seconds, four late.

`replay` re-executes the retained source/plan and compares every record and total
against the checkpoint; it checks session-record equivalence, not independent
empirical validation. Source validation is deliberately strict JSON equality;
there is no general import or migration contract. Unsupported versions fail closed.

`test/school-run.test.js` checks unique preserved identities, start ≥ ready,
service duration, exclusive non-overlapping reservations, causal predecessor
chains, lateness and scored sums across every permitted plan; matched seeds,
immutable parent, winning/losing integration paths, cancelled/missing source and
altered replay/score rejection. `test/e2e/school-run.e2e.js` covers normal page
navigation, keyboard selection, mobile width, verified replay and missing,
cancelled and incompatible-source UI states. Browser execution status is in the
[issue evidence](../reviews/SHE-702.md); test existence alone is not acceptance.
