# Recorded policy demonstration catalog

Open `/world/policy-preview-demos/index.html` on the ordinary HBL server.
The catalog displays exact immutable legal diffs for housing, drainage, transit
and an unsupported constitutional draft. These are public illustrative drafts
in a synthetic jurisdiction, without enacted-law status or a new legal-review
claim. “Reviewed” refers only to the existing software mapping registry.
Human review must establish applicability before a real proposal is submitted.

`housing.json` exactly reuses `../policy-preview-demo.json`. Baseline text is
empty because each draft adds one clause; each baseline version is an explicit
prior proposal without that clause. This does not reconstruct a real legal corpus.
All inputs use `policy-impact-preview.v1`, 100 pairs, 24 months and seed 42.
No favorable tuning or new mechanisms are used.

## Create local recorded previews

Run this from the repository root with Bun. Use a new disposable directory and
keep a single writer; never point the harness at a live server's storage.

```sh
bun --no-env-file world/policy-preview-demos/record.js \
  /private/tmp/SHE1043-preview-store /private/tmp/SHE1043-demo-output \
  http://localhost:3000
```

The harness creates an ephemeral token internally, invokes the **existing**
authenticated handler and runtime, polls terminal status, verifies identical
creation requests, reads actual summary distributions and checkpoint states,
and verifies terminal results across handler restarts. It exercises the viewer's
real `ImpactData` summary-first loading/validation path for all checkpoint months
and first/last pairs. It does not start a server, bypass authentication or ship
credentials to the browser. Partial/failed outcomes remain missing; the command
can produce an honest partial receipt and never invents successful samples.
The default wait limit is four minutes per fixture; a timeout is an error,
not a completed receipt. Interrupting a run leaves disposable storage to inspect.

After the harness exits, start one local HBL server against that disposable store:

```sh
HBL_POLICY_PREVIEW_DIR=/private/tmp/SHE1043-preview-store \
  bun --no-env-file run server.js
```

For server startup, supply any other local storage isolation settings required
by your environment; see `test/support/browser-environment.js`. Writes to the
preview API stay disabled without a configured server integration token; public
reads work for these explicitly public fixtures. Do not use a production store.
Import `/private/tmp/SHE1043-demo-output/receipt.json` on the catalog page. Only
after the page verifies the created preview, exact frozen input and pinned model
on the current server does it display a same-origin viewer link. The receipt's
origin is informational; no arbitrary imported URL is followed. A fixture name
or a receipt from an absent store is not a working preview link.

Alternatively submit each exact JSON from an authenticated server-side client
using the existing API documented in `../../docs/policy-impact-preview.md`.
Never put its token in client JavaScript or a URL. No public browser creation
endpoint has been added.

## Results and limits

The recorder retains full bulk run records in disposable storage and writes a
machine-readable receipt outside the checkout. The receipt contains exact input,
model, runtime-manifest, initial-state and output hashes; all derived seeds;
per-pair output/event/checkpoint hashes; state-derived metrics and mechanism
state at months 0/12/24; actual summary distributions; status and missing counts.
These are **modeled results under synthetic assumptions**, not observations.
The seed spread is not calibrated uncertainty. Events are retained engine
context, not proof of causal attribution; the existing runtime caps event history.

- Housing: the `h_lots` mapping permits four additional homes per modeled parcel.
  Permitted parcel capacity differs from completed housing inventory. No guaranteed
  construction, rent savings or household benefit.
- Drainage: `f_drainage` adds 0.12 synthetic resilience per district on completion,
  capped by the engine. It is not hydraulic calibration, structures saved or
  avoided financial loss. No flood shock is added to favor this demonstration.
- Transit: `t_brt` selects one deterministic synthetic hub, adds 30 capacity units
  per incident transit link and multiplies free time by 0.8 on completion. The
  summary's mean travel metric averages district links, not real commuters,
  corridor ridership or experienced trip time. Operating costs can increase.
- Unsupported constitutional text: **Not Modeled**; the exact diff remains,
  while legal validity and constitutional effects are **Not Available**. Equal
  synthetic arms are not evidence that a constitutional proposal has no effect.

The existing handler uses three synthetic households, a common seed-42 initial
city, matched derived seeds per pair, and an illustrative $1000 local capital
budget per mechanism. The integration's existing constraints govern realization.
There is no guaranteed benefit and no inference of appropriations from legal text.
Entity IDs belong to Monthly City and are not Population IDs or real residents.

## Independent Civic handoff and verification

`civic-handoff.json` is a compact review artifact derived from actual local runs.
It contains exact fixture payloads/text/clause IDs/canonical hashes, frozen model
and mapping IDs, metric definitions/distributions, derived seeds and per-pair
output hashes, sampled checkpoint hashes and aggregate evidence hashes. Bulk
states remain outside git. Local preview IDs identify actual creations, with no
production URL claim. Civic must submit these exact payloads independently and
verify its own server response. The HBL wire schema is unchanged; this local
handoff/receipt format is not an alternate cross-service protocol.

```sh
bun --no-env-file world/policy-preview-demos/handoff.js \
  /private/tmp/SHE1043-demo-output/receipt.json /private/tmp/civic-handoff.json
bun --no-env-file test test/policy-preview-demos.test.js
bun --no-env-file x playwright test --config test/policy-preview-demos.browser.config.js
```

Golden result hashes detect changes to recorded behavior; a model change requires
independent review and new source/version provenance. Never update hashes merely
to make a changed model pass. The isolated browser suite creates real previews,
imports their identities, opens the normal summary-first viewer, checks all three
recorded months and selects/reopens pair 100. It does not establish native GPU or
physical-device acceptance. Current verification and sandbox blockers are recorded
in `../../docs/reviews/SHE-1043.md`. SHE-1038 remains open; SHE-1044 remains held on
SHE-1032 and human acceptance of SHE-1043. No merge or deployment is authorized.
