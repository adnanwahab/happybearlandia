# Operations Observatory (SHE-202)

Open `/tools/operations-observatory/` through the homepage or Simulation Health.
The read-only `/api/operations-observatory` projects sanitized local evidence.
The browser independently requests `/api/ready`. Refresh runs on demand and every
minute while visible. No credentials or direct Linear/GitHub/Symphony network
access are added to the serving process. No dispatch or release action exists.

## Connect evidence

Configure these paths in the existing server environment, outside public roots:

- `HBL_OPERATIONS_COORDINATOR_PATH`: the existing SHE-180 coordinator's complete
  JSON report (`scannedAt` in Unix seconds, `issues` with `identifier`, `eligible`,
  and `reasons`). Reuse the existing host-owned dry-run/observer output. Do not
  start another dispatcher. Scanned/eligible/held counts describe that report;
  holds include approval/ownership/readiness and are not all dependency blocks.
- `HBL_OPERATIONS_EVIDENCE_PATH`: an operator-reviewed version-1 JSON document
  following [the synthetic contract fixture](../test/fixtures/operations-observatory.json).
  This file is a schema example, not an actual operational measurement. Never
  install it as live evidence. Each panel requires `source` and `observedAt`.

These feeds are optional. With no configuration, each feed displays unavailable
and links to its owning issue; no empty inventory is invented. Hosting this page
does not activate collection. The existing host owner must supply fresh reports
before the dashboard can establish operational health. Missing, unreadable,
malformed, unsupported-version and over-1-MiB files fail to unavailable states.
Update reports atomically; the reader opens each file once. Feeds are separate
observations, not a transactional cross-service snapshot.

Only documented fields are returned. Raw reports, leases, descriptions, paths,
API tokens and comments are not returned. **The selected fields are public**:
report producers must scrub task reasons, metric names and source URLs before
export. Never include player-level data. Links accept HTTPS Linear issue and
GitHub PR/actions-run URLs without credentials, queries or fragments. This is
structural validation, not proof that a source or assertion is true.

## Evidence semantics

All panel observations use ISO timestamps. Older than 15 minutes is stale;
missing/invalid timestamps or timestamps over one minute in the future are
unavailable. Stale values remain visible with their timestamp. The browser's local
storage check is live and separate from the recorded release-gate timestamp.

Symphony supplies nonnegative integer `running`, `retrying`, `blocked`, `capacity`.
Unknown counters are null, never zero. CI lists the supplied run inventory with
`success`, `failure`, `pending`, or `cancelled`. A count describes only that
inventory, not all repository CI. Each run links directly to its evidence.

Costs are USD receipts for **unique verified features** in the panel's observation
window. Each receipt has a stable `id`, `verified: true`, `costUSD`, and a source
issue/run. Include every attempt, retry and verification cost attributable to that
feature. The panel divides total supplied feature cost by the number of unique
verified receipts, not closed tickets or PRs. Empty, duplicate, unverified or
incomplete receipts yield unavailable cost per feature. This is a scoped average;
it excludes unattributed spend and unfinished features and is not organization
unit economics. Producers own completeness and window selection.

Release evidence must name the exact public build ID and the complete applicable
set of gates (e.g. CI, normal journeys, backup/restore, human review). Every gate
requires a source, name and `passed`, `failed`, or `pending` status. A missing or
malformed gate invalidates the set. The dashboard says recorded gates passed only
when all gates pass, the feed is fresh, the build matches the current `/api/ready`
build, and required storage reports ready. Development/unknown builds cannot
satisfy this condition. This is an observation, not approval to deploy. Storage
health alone does not verify backup, player enjoyment or complete release gates.

Product outcomes are separate from throughput and cost: a name, finite value,
unit, source and explicit `observed`, `modeled`, or `synthetic` kind. No outcome
or fun score is derived from tickets, worker occupancy or spending. Producers
must link methodology, sample/window, uncertainty and consent scope in the source
issue/run. No player collection or experiment system is introduced here.

## Verification

`bun test test/operations-observatory.test.js test/release-health.test.js`

`bunx playwright test --config test/operations-observatory.browser.config.js`

The browser suite starts the normal server with isolated synthetic evidence and
checks homepage navigation, source links, mobile width, failure/recovery and stale
release behavior. These synthetic tests do not prove live service connectivity.
