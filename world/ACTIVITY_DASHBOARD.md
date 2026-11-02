# Activity dashboard verification

Product/QA owns this document and `test/e2e/activity-dashboard*.e2e.js`. Production model/runtime/dashboard/render files belong to their respective owners.

## Acceptance requirements

Both legacy `/world?business_mode=true` and the Living10k mode must expose a dashboard using actual model observations. It must distinguish current activity counts, activity starts/completions and accumulated person-minutes where supported. Historical charts must label their source, modeled time, run/revision, population denominator and sampling/retention limits. Bounded recent detail must not be treated as an exact all-time aggregate.

Tests will advance actual model time and compare dashboard/export data to model snapshots. Pause must hold counts, needs and actor positions while camera controls continue working. Resume/manual step must add actual observations. Population reset or mode change must not silently combine incompatible histories. Filters must disclose whether they cover the population, retained recent details or a selected person. Export should preserve this scope and dropped-detail metadata. Selecting a real retained person must inspect that person; filtered empty states must not invent rows.

Suggested stable UI affordances for owner coordination: a clearly named Activity dashboard button, a dashboard test ID, labeled activity/district/person filters, readable chart/empty-state labels and an explicit export button. Final tests will use the owner's published API rather than presume data-field names.

## Reproduced pre-change bugs

1. Living urgent needs are ignored by the fixed work schedule. In actual population1.0.0, seed42/population100/single synthetic district, advance600modeled minutes, choose an employed person and initialize food+energy to2. After another45minutes the person remainsWORK while both needs reach0, with no explaining break decision. Production path: `world/population/behavior.js` activityAt/work precedence. Reproducer used actual model calls, not DOM values. This is a controlled initial-condition regression, not an empirical observation.
2. Existing `recordTrace` retention truncates per-actor rows after12 and evicts actor traces after1024 without a dropped-detail counter; existing event retention similarly truncates rows while preserving eventCounts. The new dashboard must expose exact aggregate totals independently and explicitly disclose omitted detail. This is a source-level retention gap; its new regression will exercise the final contract once published.

## Verification status

The connected **Activity dashboard** button works in neighborhood/business and Living modes. It queries actual model observations without advancing time. Activity time budgets, need trends, completed trips and modes, event summaries, person routines, searchable detail and CSV/JSON exports identify their scope. Exports retain the queried mode, population, run and filters.

Lifetime counters survive bounded recent-event and bucket eviction. Hour/day charts cover retained buckets. Time filters include whole overlapping aggregate buckets; selected routine durations are clipped exactly. Neighborhood mode retains up to 96 actual bouts per person from the beginning of the run. Living personal detail is tracked for a bounded selected set; previously untracked history remains unavailable. The dashboard clearly distinguishes those limits.

Focused checks cover conservation, fractional arrival timing, need-driven choices, event weighting, query purity, resets, exports, and seeded replay. Browser acceptance uses controlled map geometry with actual model/runtime/worker execution; demographic and behavioral results are not stubbed. Screenshot paths and final browser results are recorded below when checks complete.

The critical weekday-shift regression is fixed: food below 12 or energy below 8 permits a short onsite meal/rest break, recorded with its reason. Controlled tests initializing both needs at 2 recover both over 45 modeled minutes without teleporting. Thresholds and rates are illustrative assumptions, not employment or health policy claims.

Browser dashboard acceptance passed for both neighborhood/business mode and Living 10k: 5,400 added person-minutes for 30 people over 180 minutes; approximately 6,000,000 for 10,000 people over 600 minutes (floating-point tolerance), 50,701 dropped recent event records explicitly disclosed, followed by a clean 20,000-person reset. Browser screenshots: `/private/tmp/hbl-legacy-activity-dashboard.png` and `/private/tmp/hbl-living10k-activity-dashboard.png`.

Final verification: 89 focused tests across 12 files passed (633 assertions), the browser bundle built, and all eight connected dashboard/playback/needs/controls browser acceptance cases passed. Browser runs use local headless software WebGL; their timings do not establish interactive hardware FPS. Both user-facing local world URLs on ports 3000 and 3217 returned HTTP 200.
