# Synthetic city culture

Culture is a local, deterministic simulation layer. Its scenes, festivals, incidents and rare absurd events are synthetic stories and explicit effect assumptions, not measurements of real communities or predictions about a neighborhood.

The active simulation owns time. Culture observes committed model minutes; opening its panel, rendering another frame or waiting while paused must not create an incident or advance culture. Legacy and Living mode instances remain separate. Culture must not write a second household, employment or business ledger.

The population effects adapter accepts explicit district IDs and bounded event intervals. It projects supported road, transit and demand multipliers into existing population event inputs; it does not advance the population or economy. Service multipliers and other unsupported mechanisms are reported rather than replaced by a different effect. Events use hard `[startMinute,endMinute)` intervals, with no invented recovery tail. Hosts must resynchronize at boundaries before stepping across them.

The panel reads detached snapshots and offers explicit frequency, cultural change and absurd-event controls plus manual scheduling from the authoritative catalog. The panel displays at most24 returned records per event section and discloses omitted detail; this display limit is separate from engine retention.

## Engine API

`createCultureSimulation({seed,initialMinute,context,population,parameters})` returns `stepTo(minute)`, `snapshot()`, `configure(patch)`, `scheduleEvent({type,startMinute?,districtId?})`, `serialize()`, `restore(state)` and the detached `eventTypes` catalog. The schema/version is `culture.v1`.

Time is a nonnegative integer simulation minute. `stepTo` rejects backwards time and catch-up greater than366days in one call. It processes hour boundaries and actual event start/end boundaries, so irregular chunking gives the same state as a single jump. There is no autonomous timer or separate pause method: a paused host supplies no newer minute. An initial6am offset does not run an overnight warmup. Snapshots and saves are detached copies.

Parameters are `eventFrequency`0–3, `culturalChangeRate`0–3, and boolean `absurdEventsEnabled`. Defaults are1,1,true. Frequency0 stops new automatic planning and hourly generation; it does not cancel already scheduled events. Change rate0 freezes scene-strength evolution. Disabling absurd events prevents spontaneous absurd generation and removes queued automatic absurd events; explicit manual scenarios remain available and active events finish normally.

The eight scenes are music, fashion, slang, food, sports, architecture and nightlife, plus local traditions. Strength is a bounded0–1 synthetic index, not a resident percentage. Venue tags, available modeled age mix, declared interests and active-event exposure affect hourly movement toward an illustrative target. Styles are deterministic labels derived from state. Architecture describes aesthetic preference and does not rebuild buildings. No ethnicity-to-style inference occurs. If a host supplies only a population count rather than modeled ages/interests, age and interest influences are unavailable and are not invented.

The catalog contains25 event types: festivals and public gatherings, temporary incidents, and three absurd scenarios (inflatable bear, monolith, cowboy-hat craze). Automatic absurd events use an illustrative0.025% per simulated hour chance at frequency1. This is an assumption, not an empirical frequency. Manual scheduling bypasses the random-generation gate and retains `source:manual`. Incidents have no invented permanent damage, medical outcomes or legal effects.

`cultureEffectsForDistrict(snapshot,districtId)` multiplies currently active local road, transit, service and demand effects; unrelated districts receive neutral1 multipliers. Hosts decide which of those inputs their actual mechanisms support. The population adapter currently supports reduced roads/transit, increased transit and increased demand within declared ranges. Decreased demand and standalone service limits remain explicitly unsupported there.

## Retention and restoration

The engine retains at most128 pending plus active events,256 start/end history records, and dropped-record counters. A full manual event queue rejects scheduling explicitly. Snapshot upcoming events show at most24 records; full pending state is in `serialize()`. Bounded history is not a complete event archive or durable storage. Restore requires the matching schema and validates the bounded state; successful save/restore continues event IDs, calendar, scene strengths and seed streams. Backwards time requires restoring a checkpoint rather than mutating the clock.

## Verification

`bun test test/culture-simulation.test.js`:11tests passed,90assertions. Checks cover actual seeded60day runs, irregular chunk invariance, snapshot detachment, unchanged-time pause, serialized continuation, exact event expiry and district scoping, bounded queues/history, disabled spontaneous absurd events over four365day advances, institutions/age/interests, zero change rate and invalid inputs.

Integration checks use the actual Living clock binding and actual population model/effect adapter. Repeated committed frames do not advance culture, inactive frames do not advance it, and a revision change creates a fresh culture instance. Concert inputs change only the mapped district, repeat projection is idempotent, expiry removes all three projected inputs, and unsupported outage effects are disclosed. Projection leaves population minute, resident state and business economy unchanged; it does not run a second economy. These are local semantic tests, not a claim of completed browser/3D acceptance or empirical calibration.

Additional browser check in `test/e2e/world-runtime-shadow.e2e.js` passed (30.8seconds) against the actual legacy `/world` integration: eight visible scene cards, unchanged serialized culture state during main pause, disabled automatic absurd events, and manual inflatable-bear scheduling with its explicit90minute duration and0.7road multiplier. Opening and configuring the panel did not advance model time.
