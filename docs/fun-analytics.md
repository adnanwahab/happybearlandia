# Fun Analytics — SHE-186

## Reporting slice and dependencies

The homepage universe shell shows Player fun metrics and Engineering throughput
in separate named regions. The five definitions live in
`world/universe/fun-analytics.js`; each includes its numerator, denominator and
interpretation limits. All values remain **unavailable**. This is a reporting
contract, not a completed analytics pipeline or privacy approval.

Audit on November 12, 2026: SHE-8 is Backlog, SHE-66 is Todo, SHE-124 is In Review,
and SHE-56 is Todo. No first-play event schema, collector or cohort dashboard is
present in this checkout. The six opt-in journey counters are approximate local
action totals without timestamps, session identities or experiment receipts.
They cannot supply session rates, return cohorts or enjoyment. Existing Studio
local demo activity is separate diagnostic activity; do not ingest it as player
feedback or imply its collection received privacy approval.

## Common eligibility and periods

Future reporting must extend SHE-8 events and SHE-66/SHE-124 aggregation rather
than create a parallel store. Label a UTC half-open reporting interval [start,
end), source/schema versions, cohort eligibility and observation cutoff. Exclude
known bots, automated tests and internal engineering traffic using documented
rules; report exclusions and incomplete coverage. Event counts are not people.
Use consented anonymous sessions only; no account identity or fingerprinting.
Deduplicate versioned transition receipts within a session/experiment. A zero
or unobservable denominator yields unavailable, never a fabricated zero rate.

Activation, experiment-start and replay cohorts use the window of session entry
or explicit experiment start respectively. Completion measures started-in-window
experiments as of a labelled cutoff; report pending starts separately. Optional
feedback uses experiments completed in the window as of that cutoff. Replays
require an explicit player action after completion; autoplay and error recovery
are excluded. Seven-day return cohorts must mature through the end of their
seventh subsequent UTC day before entering the denominator. Report immature
cohorts separately. Lack of consent is outside the observed population and must
never be extrapolated to all visitors. Behavior is an engagement observation;
enjoyment requires an explicit optional response.

## Privacy acceptance gate

This slice adds no storage, feedback form, identity, timestamps, network sink or
analytics event bus. Existing local counters remain default off; disabling or
resetting removes their record and revokes consent. Their existing retention is
until reset/site-data deletion, with capped counts and no time history. That is
not a proposed retention policy for a future event pipeline.

Before collection is connected, SHE-56 must sign off on the actual event
allowlist, disclosure, explicit opt-in, retention TTL and deletion, cross-tab
revocation, bot handling and aggregation. Consent must cover cross-visit linking
separately and optional feedback must be skippable without blocking play. Keep
raw prompts, URLs/query strings, world/entity IDs, free text and secrets out of
telemetry. No audit sign-off is claimed by this change. The feedback prompt's
positive/neutral/negative choices and response-coverage denominator must be
reviewed with SHE-52/SHE-120 owners before adding another feedback surface.

## Verification

`bun test test/fun-analytics.test.js test/local-journeys.test.js test/universe-shell.test.js`
passes 9 tests. Browser bundle succeeds and whitespace checks pass. The added
Playwright test checks separate accessible regions, five missing-data states,
and unchanged opt-in/reset behavior through the homepage. Browser execution is
blocked locally: server startup reports EADDRINUSE on both 3197 and 3296. No
browser pass or screenshot is claimed. `HBL_UNIVERSE_TEST_PORT` permits an isolated
port when server startup is available.
