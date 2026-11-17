# Canonical monthly City run receipt

`world/future-machine/share/run-receipt.js` owns the new
`canonical-run-receipt.v1` interface. Existing evidence, City storage, replay, URL sharing and browser behavior are
unchanged. Checked-in [synthetic example receipts](../test/fixtures/example-receipts/README.md)
use this canonical contract and can be validated and regenerated without a server.
The examples directory also retains explicitly versioned historical receipts.
Those original bytes are evidence of their old model version, not inputs accepted
by the current model's strict replay validator.

```js
import {
  createRunReceipt, validateRunReceipt, replayRunReceipt, canonicalReceiptJSON
} from './world/future-machine/share/run-receipt.js';

const receipt = await createRunReceipt(history, {month: 16});
const json = canonicalReceiptJSON(receipt) + '\n';
const validated = await validateRunReceipt(JSON.parse(json));
const {history: reopened, month} = await replayRunReceipt(validated);
```

All three asynchronous functions return detached, recursively frozen records.
`createRunReceipt` accepts the existing complete 121-snapshot paired history.
The selected month defaults to 120. Validation accepts a parsed JSON object and
throws on errors. `replayRunReceipt` forwards `signal` and `onProgress` options
to the existing `loadExperiment`; it returns `{history, month, receipt}` only
when the recomputed receipt matches exactly. There is no fallback to another
experiment or recipe. Null/unsaved experiment identities can be exported and
validated, but cannot be reopened through the persisted replay loader.

The receipt contains:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exact `canonical-run-receipt.v1`; unsupported versions fail |
| `evidence` | Existing `createEvidenceReport` result, including actual seed, bounded recipe, model version, experiment identity, initial-state SHA-256, selected month, provenance, observations and limitations |
| `rulesRevision` | Actual recorded `provenance.modelManifest`; must equal the available engine manifest |
| `scenarioIds` | Existing ordered monthly City `baseline` and `plan` pair |
| `timeRange` | Months 0–120; illustrative January 2026–January 2036 |
| `units` | Existing `METRIC_UNITS`, including cumulative capital USD and minutes/link |
| `outcomeDigests` | SHA-256 of each normalized selected and terminal simulation snapshot, including all state, metrics and recorded events; the later-added top-level transport `identity` is validated separately |
| `checksum` | SHA-256 of every other receipt field, using existing `stateHash` canonicalization |

Canonical JSON sorts every object key lexicographically, preserves array order,
and uses JavaScript JSON primitive encoding. Only finite JSON data is allowed.
The checksum excludes only the top-level `checksum` field. It detects accidental
corruption; it is not a signature or proof of origin. Export serialization adds
one newline for CLI output. Receipt validation limits canonical text to 4.5 million
characters; the contained evidence retains its existing 4 million character limit.

Before any network/replay, validation rejects missing/extra contract fields,
unsupported schema/model/rules, invalid recipe/policy bounds, invalid identity or
month, invalid scenarios/time/units, absent digests, changed evidence contract,
checksum mismatch and initial digest mismatch with the versioned synthetic
generator. Housing retains the data adapter's stricter 120-home limit. Snapshot
outcome digests and saved identity are verified against the real replay after
loading. A missing saved record or a changed outcome fails explicitly.

Snapshot transport identity was added after this v1 contract. To preserve
existing City 1.1 receipts, only that top-level `identity` property is excluded
from snapshot outcome hashes. Any history containing identity tags must pass
the complete 121-month integrity check before export: matching experiment,
scenario, run index/run ID, month, seed and model. Untagged legacy or local
histories retain their original digest semantics. No state field, nested value,
metric, event, decision or causal record is excluded, and saved replay still
requires the strict City saved-outcome and complete regenerated-receipt checks.

Provenance is copied from the source history, never invented. A missing rules
manifest is an error. Synthetic assumptions and recomputation limits remain in
the evidence. Rules are illustrative and uncalibrated; a matched seed is not an
uncertainty distribution. Receipts do not carry independent retained checkpoints,
prove historical equivalence, establish real-world causality, or map City entities
to House/Population entities. Digests cover the selected and terminal snapshots,
not every intermediate month.

## CLI and reproducible disposable artifact

For an existing saved experiment on an explicitly chosen service:

```sh
bun scripts/export-run-receipt.js http://127.0.0.1:3000 city_EXAMPLE 16 > /tmp/run-receipt.json
```

The CLI loads through the real adapter and prints only canonical JSON on success
(exit 0). Errors print a diagnostic to stderr and exit 1, with no receipt on stdout.
It requires an HTTP origin without credentials/path/query/fragment, a valid saved
ID and an explicit integer month 0–120. It has no default production origin and
makes no writes. Run the CLI in its own process: its relative-URL fetch adapter
is process-global and restored on exit. The receipt library itself does not
replace fetch. Shell redirection may create an empty file on failure.

A fully disposable reproduction, requiring no existing server or saved data:

```sh
HBL_RECEIPT_ARTIFACT=/tmp/hbl-run-receipt.json bun test test/run-receipt.test.js
bun test test/run-receipt.test.js test/future-machine-share.test.js test/future-machine-data.test.js test/example-receipts.test.js
```

The CLI test starts a loopback City API backed by a temporary SQLite store,
creates the real persisted experiment through `createExperiment`, and invokes
`bun scripts/export-run-receipt.js <actual-loopback-origin> <actual-id> 16` in a
child process. It validates the output and optionally retains its exact bytes at
`HBL_RECEIPT_ARTIFACT`. It then invokes the same CLI with `city_missing`, month
121, and no arguments, asserting exit 1, empty stdout and a diagnostic. The
console records the actual ephemeral origin/identity. The database and server
are disposed afterward, so the artifact's saved identity is deliberately local
and no longer loadable after the test. Recipe, provenance, checksum and outcome
digests remain inspectable. No generated artifact or disposable database belongs
in the source handoff.

Tests additionally cover real persisted receipt-to-loader round trip, selected
month 16, re-signed outcome mismatch, uint32 seeds 0/4294967295, null identity,
canonical ordering, immutable detached export, incomplete histories and
pre-network rejection of malformed/tampered/version-mismatched inputs. There
is no browser-facing change or browser verification claim.

## Player inspection and copy

At `/world/future-machine.html`, complete a run, select a month, and expand
**Replay receipt**. **Inspect current receipt** produces readable JSON from the
existing canonical receipt library. **Copy receipt** copies those bytes; when
clipboard access fails the field selects its text for manual copying. Selecting
a different month or run clears the old export so a new inspection is explicit.
The receipt includes model/rules versions, seed, bounded policy inputs, selected
month events, causal records and decisions, provenance and synthetic limitations.
It excludes page/account data and uses the existing synthetic monthly City data.

Paste the JSON into **Paste replay receipt** and choose **Reopen receipt**.
Validation and strict saved-run recomputation must succeed before replacing the
comparison. Corrupt/unsupported metadata, unavailable saved records and changed
outcomes fail visibly. Reopening has no recipe fallback. The saved experiment
must still exist on this service. Receipt verification does not authenticate its
author or establish empirical causality. Existing share and download controls
keep their contracts.

Focused UI verification command:
`bunx playwright test --config test/future-machine.browser.config.js -g 'player inspects'`.
This session could not start the local browser server (bind `EADDRINUSE`);
no UI screenshot was produced.
