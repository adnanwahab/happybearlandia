# WorldRuntime migration audit

The migration is incremental. Legacy `/world` remains authoritative unless an explicit, tested domain cutover says otherwise. A shadow population is a separate synthetic comparison, never a second writer of visible residents' money, employment, housing or movement. Constitution City's monthly coupled engine, frozen public-plan handoffs and replay catalog remain separate; this work does not replace them.

## Ownership and acceptance gates

| Domain | Compatibility authority | Shadow role | Required cutover evidence |
|---|---|---|---|
| Visible clock and pause | Existing committed simulation clock | Advance only to committed clock targets; no autonomous wall-clock timer | No paused advance or resume catch-up; reset generation rejects stale worker results |
| Residents, schedules, needs, positions | Legacy simulator for legacy mode; existing population runtime for explicit Living mode | Independent population-engine residents | Stable identity mapping, inspector/selection/render parity, needs and schedule tests |
| Employment and wages | Existing mode's model | Observe population employment and income | No duplicate wage credit; job-capacity/hiring/layoff parity; explicit ownership flag |
| Household cash | Legacy household compatibility ledger when enabled | Independent population household ledger | Shared member spending, one voucher per household, conserved transfers, no legacy/population double write |
| Commute | Legacy travel behavior in legacy mode | Population model mode choice | Fixed pedestrian speed independent of transit service; documented units and comparable trip windows |
| Businesses | Existing business simulation | Population economy is comparison-only | Job and cash ledger reconciliation; closure/opening and customer-demand definitions |
| Policies/environment | Existing mode and reviewed adapters | Change supported model inputs | Provenance, parameter diff and unsupported-policy disclosure; no metric offsets |
| Rendering | Visual consumer; existing compatibility smoothing may persist | No visible shadow writes | All authoritative mutations removed before claiming full snapshot-only rendering |

Do not compare different metric names as if they were the same measurement. Legacy mood and population utility, individual budget stress and household housing stress, and walking minutes and total commute burden require explicit definitions and units. Same seed family and approximate resident count do not imply identical households, ages, jobs or trajectories.

## Fifteen-step plan audit

These rows describe acceptance requirements, not a claim that all steps have shipped. Implementation evidence and verification results are recorded below as modules land.

| Step | Scope | Gate / current migration limit |
|---|---|---|
| 1 | Canonical WorldRuntime | Wrap the existing population engine; version state, clock, snapshots and authority metadata. A wrapper alone does not unify all city state. |
| 2 | Population authority | Population engine owns its own residents. Legacy visible residents remain legacy-owned until an explicit cutover. |
| 3 | Compatibility adapter | Detached snapshots and stable entity IDs; reading must not advance or mutate either model. |
| 4 | Shadow comparison | Opt-in, off by default; same location, clock target, seed family, approximate population. Disclose incompatible metric definitions. |
| 5 | Domain migration | Employment, budgets, travel, businesses, housing, schedules, needs, rendering each require separate capability/parity gates. No whole-world cutover inferred from shadow success. |
| 6 | Unified economy | Deferred until wages, purchases, jobs and business cash have one writer and reconciled ledgers. Running two economies is not unification. |
| 7 | Parameter policies | Supported policies alter causal inputs; unsupported mechanisms stay explicit. Outcome deltas are observations, never policy inputs. |
| 8 | System interfaces | Version assumptions, step, observe and serialization contracts. Do not claim complete restore from an observational snapshot. |
| 9 | Events | Define bounded retention, entity IDs, model time, reason codes and ordering. Existing model events do not imply a complete cross-system event bus. |
| 10 | History persistence | SQLite event/snapshot reconstruction remains deferred unless durable schema and restore/replay checks exist. In-memory snapshots are not durable history. |
| 11 | Determinism | Same config/context/seed/committed steps must repeat. Counter-based population draws do not automatically make legacy sequential RNG counter-based. |
| 12 | Unified visualization snapshot | Legacy, Living and Constitution views remain explicitly scoped until migrated. No claim that every dashboard consumes one state. |
| 13 | Explanations | Expose actual recorded mechanism/reason data; do not manufacture causal explanations from metric differences. |
| 14 | Causal trace | Every arrow needs a measured intermediate and implemented mechanism. Full policy-to-outcome causal graph remains deferred. |
| 15 | Retirement sequence | Preserve legacy until domain parity passes; deleting `sim.js` and duplicate logic remains deferred. |

## Legacy realism compatibility requirements

Annual longitudinal experiments sample representative periods rather than every minute of ten calendar years. Carry household cash/stress, homes after moves, needs, commute history and relevant store/fridge state between samples. Reset transient flood flags deliberately. Derive deterministic per-year seeds without regenerating residents. Disclose representative duration in UI and exports.

Household wages, spending, recurring costs and benefits must use the same household ledger. Multiple residents sharing a household receive one eligible voucher, including the representative-period payment convention. Household stress is a bounded synthetic measure, not a complete tax/debt/insurance model.

Transit service changes wait/in-vehicle time or mode inputs. Walking remains the user-approved 40 metres/minute (2.4 km/h); the attachment's 55 metres/minute is superseded. Separate walking, waiting, transit and total travel observations. No transit multiplier may accelerate pedestrians.

## Verification ledger

`test/e2e/world-runtime-shadow.e2e.js` currently has two independently executed passing browser cases:

- Legacy `/world`, 30 synthetic residents: no `runtime/shadow.worker.js` is created by default, no comparison panel appears, and a main pause holds model minute, resident positions, needs and money (14.7 seconds).
- Actual imported WorldRuntime, 30 synthetic residents, two synthetic districts, seed42, initial minute360: repeated default snapshots/observations preserve serialized state; mutating a detached metric cannot alter the model; two 60-minute runs serialize identically; paused explicit stepping preserves state; rentMultiplier1.5 changes parameters without immediate metric offsets or clock advance; an arbitrary averageCommute outcome patch is rejected. Shadow ownership explicitly reports legacyWrites=false and parityGatePassed=false (82 ms browser case).

These cases ran on an isolated QA server at port3146, which Playwright closed afterward. No paid API calls, deployments or user-server restarts occurred. The integrated opt-in worker check and actual legacy shared-cash/voucher/longitudinal semantic checks subsequently ran as recorded below.

Canonical observations, including selected-person snapshots and inspections, now preserve serialized state. The runtime isolates the population helper’s tracking bookkeeping; an explicit tracking command starts future retained personal detail without advancing time. Population helpers outside the canonical wrapper retain their original tracking behavior. Focused runtime tests cover untracked selection and a full tracking-retention window.

### Integrated shadow browser check

The optional `/world?demo=1&people=80&shadow=1&living=0&renderer=webgl` path now creates one actual `runtime/shadow.worker.js`. Browser checks reached aligned legacy/canonical clocks,80residents in each model, explicit no-cutover metadata, withheld mood/utility deltas and frozen visible/shadow snapshots during main pause. A preliminary version also passed resumed-clock convergence.

The stronger immediate snapshot-isolation assertion initially exposed a cached-reference defect: changing `getSnapshot().metrics.syntheticPopulation` to−999 changed subsequent public reads. Root fixed snapshot/report getters and normal report publications to return structured clones. The integrated browser rerun then passed actual worker count, exact visible-context building/district equality, clock alignment, frozen pause state, immediate snapshot isolation and resumed committed-clock convergence (approximately1.2minutes). The test restores its probe mutation and does not modify production code. No cutover is authorized by this check.

### Legacy compatibility semantic browser evidence

The actual production modules passed a browser semantic fixture with four residents sharing one household (2.1seconds). Spending through one resident changes the same cash seen by all members; one20-unit voucher raises cash65→85, and a repeated period pays nothing. A restored sample preserves cash10000 and energy37. Two actual year1 five-day samples from the same saved state serialize identically and retain greater terminal cash than a fresh initialization. Metadata declares7200modeled minutes, no annualization and seed `42:year:1`. An actual forced walking trip moves40metres in one model minute with transit service multiplier3. These are synthetic compatibility semantics, not an empirically validated decade or migration cutover.

### Law and weather acceptance

The actual legacy `/world` law panel browser case passed after explicitly selecting each overlay mode:90 supplied law records, exact text copied to Plan idea, supported law21 paired outputs, potential home-institution scope, recorded-change mode, unsupported law26 with no invented numerical result, and byte-equivalent paused resident state before/after the detached comparison. The test collapses the main toolbar through its normal summary control before opening the panel. The earlier click overlap and default-overlay assumption are not treated as model failures.

The final strengthened shadow rerun passed both immediate snapshot and report getter isolation, actual worker use, matching context and committed clock/pause behavior (54seconds). No parity gate or economic-authority cutover was enabled.

`test/weather-gameplay.test.js` passed7tests/116assertions against the actual weather engine and legacy/population integrations. Rain changes mode scores and actual same-seed population trip mode counts; heat changes a legacy park decision to relaxing at home and raises modeled electricity load; storms reduce existing service/transit/road access inputs. Committed-time no-op, detached snapshots, chunk-independent automatic conditions, deterministic restore/manual overrides and invalid-input rejection are covered. This is synthetic load/access behavior, not measured weather, grid power flow or a calibrated forecast.

### Living weather worker acceptance

The actual browser worker test `actual Living worker accepts paused weather inputs without reset, updates mechanisms and replays weather history` passed in952ms (3.3seconds including isolated server startup). It used120 synthetic residents, two explicit synthetic districts and seed42. Three weather commands at committed minute0 set a clear baseline, temperature42C, then rain1. Hot/rain configuration preserved minute, tick, runtime ID/revision, visible IDs/positions and all resident needs; hot conditions raised actual `metrics.electricityDemandKw`, and inspected walk utilities contained the weather penalty. Waiting while paused preserved the same state. Explicit advancement to minute495 produced actual trips and changed resident state.

A real future worker ran one day, exported all three command records in `manifest.weatherTimeline`, and replayed to exactly matching terminal metrics. Replayed weather remained42C/rain1 and a separately reconstructed future-person inspection retained the weather utility penalty. These are actual worker/model results, not a UI-side weather simulation or outcome offsets. The runtime was destroyed and isolated port3146 closed after the check.

### Follow-up observation probe

After WorldRuntime inspection began passing `{track:false}`, a direct serialization probe still found that a first `inspectPerson(29)` initializes `core.population.social` from absent to `{ties:{}}` in a30-person fixture. This is lazy bookkeeping rather than a clock/needs/cash change, but strict serialization equality remains unresolved for that first read. A selected-person snapshot after that inspection introduced no further difference in the same probe. This finding is separate from the passing Reality Compiler paired-worker and replay acceptance cases.
