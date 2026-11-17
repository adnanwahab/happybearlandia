# SHE-134 station inspection readiness

Audit date: 2026-11-12. Checkout: `b963dd353538294cb0fbf5d34d5283fad6e10e68`,
branch `mini/SHE-134`. This is a dispatch review artifact, not a delivered
station simulation or measured 1000x replay result.

## Observed prerequisites and overlap

[SHE-134](https://linear.app/shel-bernstein/issue/SHE-134) remains Backlog and
explicitly requires dispatch review. Its blocking dependency
[SHE-145 / HBL-1M-018](https://linear.app/shel-bernstein/issue/SHE-145) is Todo.
That spike must establish spatial event ordering, cross-tile invariants and
queue instrumentation. Its own prerequisites include SHE-141, SHE-142 and
SHE-171. No approval or issue state was changed by this audit.

Related ownership boundaries:

- SHE-132 owns event-specific map hotspots; reuse its eventual event selection
  interface rather than creating a second generic hotspot ledger.
- SHE-156 owns executed-trip flow ribbons; station inspection should consume
  the same trip records and avoid independently estimating OD totals.
- SHE-149 owns spatial lookup benchmarks, including concentrated transit hubs.
- Existing monthly Living City commute comparisons change district capacity;
  they do not establish station identities or a minute-level timetable.

GitHub audit: a repository transit issue search returned no matches. The open
PR API returned fewer than its 100-entry page limit; none of their titles
identified SHE-134, SHE-145 or a station timetable implementation. Related open
PRs include #63 (Living City Engine), #103 (emergence feasibility audit), and
#86 (Simulation Benchmark Arena). This is title-level overlap screening, not
a review of all PR diffs or a guarantee that unrelated branches contain no work.

## Current source evidence

- `world/population/behavior.js`, `modeAlternatives`: bus/rail duration includes
  an access-dependent wait formula and a district straight-line route. It does
  not schedule vehicle departures at stations.
- `world/population/model.js`, aggregation: `odFlows` describes current
  in-progress trips, with raw and represented counts. It is not an arrivals or
  departures ledger over a selected interval.
- `world/population/hotspots.js`: eligible locations are parks, food venues and
  plazas; contacts use nontravelling visitors, at most eight candidates per
  location per 30-minute bucket, and retain the latest 120 encounter records.
  These cannot supply station interaction frequency or complete history.
- `world/population/DATA_FORMATS.md`: transit imports include headway and
  capacity, but remain reference data until an explicit adapter exists.
- `world/population/MODEL_CARD.md`: visible actors are a render sample; omitted
  history cannot be recovered by checkpoint restore. Seed alone does not rewind
  a runtime to an arbitrary prior state.
- `world/LIVING_CITY_COVERAGE.md` explicitly discloses the absent microscopic
  queue, timetable and timetable-driven vehicle renderer.

## Proposed first integrated slice after dependency review

Prerequisite: SHE-145 supplies a versioned, deterministically ordered event
source. A timetable producer must also supply stable station, service, trip,
actor and event identities, executed arrival/departure/queue transitions and
contact records. Architecture C's queue instrumentation alone is insufficient.
Do not substitute decorative vehicles or imported reference headways.

Proposed exclusive ownership for this worker: station projection module,
station inspector UI and focused station tests. The event producer and shared
trip/event interfaces remain owned by the dependency coordinator. Existing
runtime, hotspot and ribbon interfaces require coordinated ownership before
edits. Use the isolated issue checkout; no parallel implementation is needed
until the shared interface is available.

1. Define a station read contract with run ID, model/rules versions, seed,
   scenario inputs, station identity, clock units, retained interval and event
   ordering. Use one immutable run dataset in all station views.
2. Project one selected station over a half-open interval `[start,end)`.
   Reconcile queue opening stock plus entries minus exits to closing stock;
   distinguish boarding, abandonment and transfers. Count interaction events
   once and show frequency with the actual observed-time denominator.
3. Add selection through the existing transit what-if entry point once its
   station identity mapping is verified. Label full aggregate counts, retained
   individual events and display sampling separately. Show represented weights
   separately from raw actors; missing retention is unavailable, never zero.
4. Scrub recorded time without consuming RNG or advancing simulation. A 1000x
   playback setting changes presentation cadence only. Compare direct seek,
   sequential playback, rewind and reload at identical timestamps using event
   IDs, queue stock, counts and ordering hash. Do not claim throughput from a
   speed-control label.

Acceptance evidence must include deterministic equal-time ordering, seed-matched
baseline/treatment, empty station, unknown station, missing history, interval
boundaries, duplicate events, abandoned queues and cross-tile transfer. Add a
browser journey selecting the node, inspecting event IDs, changing the interval
and repeating the 1000x scrub. Record scenario, seed, versions, timestamps,
sampling/retention policy and actual check results.

## Decision and limits

Verification: `bun test --timeout 15000 test/population-model.test.js
test/population-hotspots.test.js` passed 19 tests with 216 assertions. The first
run at the default 5-second timeout had 18 passes and one timeout; the unchanged
test passed with the explicit 15-second allowance. These checks verify existing
behavior only. `git diff --check` passed. Playwright was skipped because this
slice changes documentation only.

Hold production feature implementation for dependency and dispatch review.
Inventing a timetable here would broaden the issue into a new transport model
and bypass the recorded blocker. No station UI, timetable, queue mechanism,
million-agent performance or 1000x repeatability is claimed by this slice.
Next action: coordinator reviews this contract, resolves the producer ownership
and confirms the dependency interface before dispatching implementation.
