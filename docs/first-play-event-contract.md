# First-play events v1 (SHE-7)

Status: implemented pure contract; UI integration belongs to SHE-8. This slice
owns only this document, `world/first-play-events.js` and
`test/first-play-events.test.js`, per the issue coordinator's exclusive assignment.
No changes to the shared implementation plan, entry points, simulation or recorder.

## Audit and scope

Baseline `b963dd3`, branch `mini/SHE-7`. The checkout was clean before work.
Registered worktrees contained none of these three assigned paths; no local
handoff directory or conflicting ownership was found. Existing
`world/decision/onboarding.js` records nine local demo/tour activities, bounds
storage to 200 entries and drops contact fields. Its tests already cover privacy
and deterministic saved-demo replay. It has no first-play session contract;
this module neither replaces it nor changes its behavior.

The product design requires versioned, truthful synthetic results. The existing
Future Machine interfaces and City contracts remain authoritative. This event
contract is a small measurement envelope, not a replay recipe or evidence store.

## Envelope and API

Import `FIRST_PLAY_SCHEMA_VERSION`, `FIRST_PLAY_EVENT_TYPES`,
`MAX_FIRST_PLAY_EVENT_BYTES`, `validateFirstPlayEvent` and
`createFirstPlaySessionId` from `world/first-play-events.js`.
Every event requires exactly:

| Field | Allowed value |
| --- | --- |
| schemaVersion | `hbl.first-play.v1` |
| type | One of the seven names below |
| sessionId | `fps_` followed by 32 lowercase hexadecimal digits |
| elapsedMs | Integer 0–86,400,000, relative to session start; no wall-clock date |
| payload | Exact per-type fields below; none optional |

`validateFirstPlayEvent(value)` returns `{ok:true}` or `{ok:false,code}`.
Fixed codes are `INVALID_ENVELOPE`, `INVALID_PAYLOAD`, `EVENT_TOO_LARGE`,
`INVALID_EVENT`; errors never include rejected data. Maximum encoded event size
is 1,024 UTF-8 bytes. Strict enums and numeric bounds already keep valid events
below that cap. Additional fields, symbols, accessors, custom prototypes,
missing fields, wrong versions and invalid values fail closed. No coercion or
silent stripping. Use plain data objects (not hostile proxies).

## Events and meaning

| type | Exact payload | When the integrator should emit |
| --- | --- | --- |
| landing | `{entry: 'direct' \| 'shared' \| 'internal'}` | Landing surface ready; classify locally, discard URL/referrer |
| demo_start | `{mode: 'fresh' \| 'saved'}` | Demo actually starts or a saved demo is opened |
| first_input | `{control: 'policy' \| 'timeline' \| 'scenario' \| 'playback'}` | First accepted user control interaction; never input text/value |
| first_divergence | `{facts: {...}}` as below | First recorded divergence becomes visible; never infer one from elapsed time |
| why_opened | `{target: 'recorded-event' \| 'recorded-divergence'}` | Evidence panel actually opens |
| share | `{method: 'copy' \| 'native' \| 'download', result: 'succeeded' \| 'canceled' \| 'failed'}` | Share operation settles; never include link or destination |
| return | `{entry: 'shared' \| 'internal' \| 'resume'}` | Explicit return entry or resume; not inferred cross-session identity |

`first_divergence.payload.facts` requires exactly:

| Field | Allowed value |
| --- | --- |
| source | `recorded-paired-history` |
| modelVersion | `city-systems.1.0.0` (existing City version) |
| dataVersion | `future-machine.v1` (existing history/recipe contract) |
| seed | uint32 integer 0–4,294,967,295 copied from history |
| month | Integer 1–120 copied from the first recorded differing checkpoint |
| scenario | `plan`, compared with the matched `baseline` |
| synthetic | `true` |

Facts are isolated under `facts`; other payloads describe UI interactions only.
No metric amounts, causal stories, resident IDs, run IDs or arbitrary scenario
strings are accepted. The seed/model/data versions and month are an intentionally
minimal history reference, not sufficient alone to reconstruct a run. Keep the
full recipe and evidence in their existing authoritative store. Seed must be a
model-generated simulation seed, never derived from personal data.

## Session and privacy expectations

Generate an ID once per page session with cryptographic random bytes; keep it in
memory, discard it on reload/close, and rotate before exceeding 24 hours. Generation
throws if secure randomness is unavailable; never fall back to personal data or
Math.random. Validation can enforce format, not prove random origin.

No cookies, persistent identity, fingerprint, previous-session ID, free text,
contact data, raw URLs, credentials, tokens, location or arbitrary metadata.
Closed enums prevent sensitive values even under otherwise allowed keys.
Do not log rejected values. This module performs no storage, transmission,
collection, vendor initialization or automatic instrumentation. No retention
store exists in this slice. A later collection proposal must define consent,
access/deletion and bounded retention before enabling any collection.

```js
import { FIRST_PLAY_SCHEMA_VERSION, createFirstPlaySessionId,
  validateFirstPlayEvent } from './world/first-play-events.js';
const sessionId = createFirstPlaySessionId(); // retain only in page memory
const event = {
  schemaVersion: FIRST_PLAY_SCHEMA_VERSION,
  type: 'landing', sessionId, elapsedMs: 0,
  payload: { entry: 'direct' },
};
const result = validateFirstPlayEvent(event); // {ok: true}; no recording occurs
```

## Limits, versioning and next slice

SHE-8 must connect normal UI entry points, use monotonic elapsed time, enforce
first-only/session ordering, distinguish share success from attempts, verify
facts against the same versioned recorded paired history and preserve visible
synthetic/uncalibrated-model disclaimers. Missing history means no divergence
event. Schema validation does not establish that a fact happened or verify causal
claims. Return carries no proof of a prior visit and cannot measure repeat people.
No model computation or state authority changes here.

Payload, model or data-contract changes require a reviewed new schema version;
unknown versions are rejected rather than silently upgraded. Future evidence
adapters must separately verify provenance. The contract is not browser-facing,
so no UI screenshots or Playwright run are applicable.

## Acceptance evidence

- `bun test test/first-play-events.test.js`: 11 pass, 0 fail.
- `bun test test/first-play-events.test.js test/demo-fallback.test.js`:
  14 pass, 0 fail, 417 assertions.
- `git diff --check`: clean; new files also checked with `git diff --no-index --check /dev/null <path>`.
- Tests cover all seven positive variants, missing/extra/sensitive values and
  keys, oversized payloads, version mismatch, anonymous IDs, model bounds and
  malformed objects. Existing saved-demo replay/privacy tests pass unchanged.
- No commit or PR created: this workspace permits source edits but Git metadata
  is read-only. The host publisher must publish these three files as a scoped
  draft PR against `sprint/one-city-two-futures-20261111`; no merge or deploy.

## Current City compatibility (integration, November 12, 2026)

The merged City model is `city-systems.1.1.0`. Current instrumentation emits
`hbl.first-play.v2` through `FIRST_PLAY_CURRENT_SCHEMA_VERSION`, with the same
closed envelope and payload fields. Its divergence facts require that exact
1.1.0 model. The existing `FIRST_PLAY_SCHEMA_VERSION` continues to identify
legacy v1, whose divergence facts still require 1.0.0. Validation accepts both
explicit schema/model pairs and rejects cross-version combinations; old records
are never relabeled. New model versions need another explicit contract update.
Neither version stores or transmits events; all privacy and size bounds above
remain in force.
