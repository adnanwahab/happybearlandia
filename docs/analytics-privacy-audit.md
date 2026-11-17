# Analytics privacy audit — SHE-56

Audited 2026-11-12 on `mini/SHE-56`, baseline `b963dd3`. This is a
current-source audit, not a production privacy certification. No collection,
simulation, retention implementation, or UI was changed.

## Readiness and ownership

The issue depends on HBL-W1-002 (SHE-7) and HBL-W1-003 (SHE-8). Live Linear
inspection found SHE-7 Done and SHE-8 Backlog. However,
`world/first-play-events.js`, `test/first-play-events.test.js`, and
`docs/first-play-event-contract.md` are absent from this checkout. SHE-7's
coordinator decision explicitly holds downstream SHE-56 pending dependencies.
Tracker completion does not demonstrate that its contract is integrated here.

This audit owns only this new report. It does not claim ownership of the
first-play schema, shared UI, feedback intake, or the implementation plan.
The next implementation slice requires coordinator ownership and integration
of the prerequisite schema and actual funnel instrumentation. Do not mark the
full issue complete from this report alone. No deployment or merge is authorized.

## Observed inventory and overlap

| Surface / source | Events or data | Destination and existing controls |
| --- | --- | --- |
| `world/decision/onboarding.js` | `tour-started`, `tour-step`, `tour-completed`, `stress-sequence-started`, `stress-sequence-completed`, `demo-saved-loaded`, `demo-fresh-requested`, `demo-manifest-exported`, `pilot-brief-exported` | LocalStorage `hbl.local-demo-activity.v1`; fixed event allowlist, ISO `at`, optional integer `step`, `runs`, `scenarioCount` in 0–100000, optional `modelVersion` matching 1–24 digits/dots. No session ID or network transport in this recorder. An allowed event name does not prove an emitter is wired. |
| `world/decision/guided-tour.js` | Tour start, step and completion; explicit activity export | Local JSON download, with browser-only scope label. Tour navigation records activity automatically once invoked. |
| `world/decision/robustness.js` | Stress sequence start/completion with run/scenario counts and model version | Same local recorder; does not export simulation inputs or resident identities. |
| `mountPilotRequest` in onboarding | Organization, decision, alternatives, evidence, date, context | Separate explicit local brief download. Form text is not passed to activity recording; the event has empty detail. The downloaded brief intentionally contains entered text and must be reviewed before sharing. |
| `world/decision/diagnostics.js` | Experiment ID/status/version, run counts/timing, heap size, browser and supplied API error messages | Local DOM and memory, disclosed as local session only; latest 50 browser messages truncated to 2000 characters each. API error array has no corresponding bound. Raw error messages are not redacted. |
| `server.js` | Connection/disconnection notices, fixed invalid-JSON notice, startup/provider and bundle failure diagnostics | Server console, separate from browser activity. Provider URLs use `publicProviderOrigin`; bundle logs remain a free-form diagnostic boundary. Host access logs and retention are outside this source audit. |

Existing `test/demo-fallback.test.js` already tests contact-field omission,
the 200-record cap and rejection of unsupported events. Reuse this behavior;
do not replace it with a competing analytics system. `ops/improvement/README.md`
also identifies local activity as distinct from consent-backed player collection.

## Minimization, retention and consent findings

- **Activity redaction:** writes construct a fresh allowlisted record rather
  than copying arbitrary detail. Prompts, names, contact fields, credentials,
  URLs, resident IDs and scenario text have no allowed field. This is omission,
  not a general-purpose secret scrubber. Small integers and numeric model
  versions are accepted metadata, not proof of trustworthy model provenance.
- **Retention default:** latest 200 local activity records, with no age expiry.
  LocalStorage can survive browser restart until cleared or evicted. Precise
  timestamps can describe one browser's interaction history, so local-only does
  not mean anonymous aggregate analytics. Downloads remain until their owner
  deletes them. No server telemetry TTL can be certified from these modules.
- **Consent and opt-out:** no consent preference or persistent recording opt-out
  exists in the recorder. `clearLocalDemoActivity(window)` removes its key but
  subsequent activity writes again; this is deletion, not opt-out. Users can
  delete that key in browser site storage or clear site data (the latter can
  also remove unrelated saved state). Blocking storage causes writes to fail
  without breaking recording callers; this is not an application consent UI.
- **Read/export trust:** `getLocalDemoActivity` parses and returns the latest
  200 stored array entries without revalidating fields. Previously modified
  storage can therefore appear in an export. The clean-write guarantee must
  not be advertised as validation of arbitrary imported or tampered storage.
- **Diagnostics:** error messages can include user input, URL tokens or secrets.
  No remote telemetry path was found in these modules, but raw local errors
  must not be forwarded to future telemetry or support exports unchanged.
  A blanket claim that all diagnostic output is secret-free is unsupported.

## Required contract before remote analytics

These are recommendations for the prerequisite owners, not implemented defaults:

1. Disclose purpose, exact fields, destination, retention and control before
   enabling collection. Default optional collection off; provide a persistent
   opt-out that prevents subsequent writes/emissions and clears queued activity.
   Explicit export should show what will be shared.
2. Validate the integrated versioned schema at emission and ingestion/export.
   Reject unknown fields and free text; exclude full URLs, query strings,
   prompts, errors, credentials, IP-derived profiles and real person identifiers.
   If session correlation is needed, use an ephemeral random session ID with no
   account or cross-session linkage. Do not build individual behavior profiles.
3. Adopt an explicit bounded age as well as count limit. Proposed initial
   ceiling: seven days for raw optional activity, then deletion; retain only
   reviewed non-identifying aggregates for at most 30 days. These values require
   owner agreement and executable expiry tests; they are not current behavior.
   Document any separate operational-log and backup retention.
4. Add tests for consent refusal/revocation, expiry boundaries, secret-bearing
   errors and URLs, malformed/tampered stored records, blocked storage, and
   duplicate-free real funnel transitions. Re-audit actual transport and host
   logging after integration. Keep feedback consent separate from analytics.

Simulation event provenance, seeds, model versions, saved runs and synthetic
data disclosures are separate source-of-truth records. Do not purge or rewrite
them through an analytics retention function or treat synthetic residents as
tracked real people. This audit changes none of those records.

## Verification and unresolved work

`bun test test/demo-fallback.test.js` — **3 passed, 0 failed, 136 assertions**,
Bun 1.4.2. This includes field omission and bounded activity storage as well as
exact pinned-model replay and saved-output labeling. It does not establish
consent, expiry, diagnostic redaction or the absent first-play contract.

`git diff --check` — passed. Documentation-only change: no browser behavior
changed, so Playwright and screenshots are inapplicable. No lint/type-check
script is defined in the root package. No production traffic, hosting settings,
external dashboards or secrets were inspected. No PR was created.

Next action: the coordinator must reconcile the Done schema with the checkout,
assign SHE-8 integration and privacy control ownership, then request a follow-up
review against the actual integrated event contract. The current code supports
only a local-demo minimization finding, not full consent/retention sign-off.
