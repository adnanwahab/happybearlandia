# Replay expansion: tickets 113 and 131

## Scope and acceptance

Deliver versioned, bounded serialized housing checkpoints and nested forks using the existing 1.2.0 monthly stock-flow model and building lifecycle. Preserve exact random stream, queue, balances, progress, events and prefix. Reject absent/corrupt/incompatible checkpoints and invalid interventions. Never assign housing authority to CityState or Population.

Implemented adapter: `world/decision/backlog-replay/index.js`. Shared hooks are delivered as `world/decision/backlog-replay/integration.patch`, NOT applied to shared production files under this track's ownership rules. No model coefficients or numerical rules change. Patch exposes existing closure state and lifecycle internals; it does not create another simulator. Frozen 1.0/1.1 engines stay untouched.

## Coordinator integration (required)

1. Apply `git apply world/decision/backlog-replay/integration.patch` from repository root. Review only `world/models/housing/index.js` and `world/buildings/lifecycle.js` hooks. The hook argument is internal; never pass request-controlled `replay` state directly to the engine.
2. Existing decision store/API owner imports:

```js
import { createHousingCheckpointAdapter } from './backlog-replay/index.js';
import { simulateHousingRun } from '../models/housing/index.js';
const replay = createHousingCheckpointAdapter({ simulateRun: simulateHousingRun });
```

3. On a selected completed run, use its recorded effective sampled parameters, exact uint32 seed, original inputProjects, years and scheduledStress. Require recorded modelVersion 1.2.0. Do not pass final run.projects as input projects. `await replay.start({parameters,seed,years,projects,scheduledStress}, selectedMonth)` returns `{checkpoint,serialized,result,source,empiricalCalibration}`. This initial creation recomputes from retained inputs; compare its numerical prefix against the independently stored run before claiming recorded equivalence. Never relabel recomputation as an observed snapshot.
4. Persist `serialized` immutably keyed by checkpoint.id AND digest, under the existing experiment/run authorization and retention boundary. Reject overwrites with different content. `restore(serialized,{id,digest,recipeDigest})` pins expected identities; digest is integrity, not authentication. Treat saved server data as the authority, not a client-supplied envelope. Enforce HTTP body limits before JSON parsing. Internally captured state includes private lifecycle fields; do not render them as geographic entities.
5. `await replay.resume(serialized,targetMonth)` advances only after the captured month. `await replay.fork(serialized,approvedOperations,targetMonth)` applies existing validated operations before captured month+1. Call only after existing preview/approval checks. Store returned lineage, immediate parent digest/id, child checkpoint and output together. Parent remains immutable. Require target > branch month; branches limited to 16 ancestors, operations to existing 32, horizon to existing 600 months, envelope to 8 MiB. Over-limit checkpoints fail explicitly; do not silently reduce horizon.
6. Preserve lineage separately from legacy result.fork: a resume result contains numerical history without old singular fork metadata. The checkpoint.lineage is authoritative for multi-generation ancestry. ParentDigest links resume checkpoints as well; branch lineage records only interventions. Do not promote a nested child through the old single-fork scenario contract without a separately versioned recipe/contract.
7. Existing API/UI owner must add save/load/fork entrypoints and explicit unavailable/corrupt/version/oversize states; errors must never fall back to another model/run/seed. This track changes no route, server, store or browser UI. Re-run production journey/browser evidence after wiring.

## Evidence

`test/backlog-replay.test.js` copies existing model/building source into a temporary directory, applies the exact integration patch, and imports that actual engine. No replacement dynamics or fabricated outcomes. It verifies all numerical/history output against the unmodified normal engine, restart at months13/37/120 for seed0/42/uint32-max, frozen parent state, nested intervention prefixes, deterministic repeated branches, matched no-op branch, added project clock and forward cancellation, stock conservation, missing/corrupt/oversize/version/identity rejection, time reversal and prohibited stock rewrite. Bare unpatched engine fails explicitly.

- Focused final: `bun test test/backlog-replay.test.js`: 4 passed, 38 assertions.
- Regression before final extra lifecycle test: `bun test test/backlog-replay.test.js test/housing-fork.test.js test/housing-model.test.js test/building-lifecycle.test.js test/checkpoint-replay.test.js`: 53 passed, 2873 assertions.
- `git diff --check`: passed before final documentation; final check repeated at commit.
- Browser/screenshots: not run; no browser behavior wired. Production integration remains coordinator-owned.

The generated checks establish deterministic mechanics only. Model outputs remain synthetic, not empirical calibration. No external services, paid calls, production writes or deployment.

## Ready-to-apply global status

| Ticket | Implemented / verified | Remaining blocker |
| --- | --- | --- |
| 113 | Bounded serialized exact housing state and restart adapter implemented; actual patched-engine equality verified under three boundary seeds. Identity/version/hash errors reject. | Coordinator apply hooks, persist immutable envelopes and wire existing on-demand replay route; production browser acceptance unverified. Keep Partial until wired. |
| 131 | Nested forward forks implemented on actual restored lifecycle state with causal lineage, deterministic replay, immutable prefix and seed-matched no-op comparison tests. | Coordinator route/approval/store integration and versioned multi-fork scenario promotion; legacy singular-fork promotion cannot represent nested lineage. Keep Partial until wired. |

Owned files only: adapter, integration patch, unique test, this handoff. No shared implementation plan/backlog/entrypoint edits. Worktree `/Users/wahabma/.codex/worktrees/backlog-replay/happybearlandia`, baseline `1b19358`.

## Follow-up delivery: INTEGRATION-READY

This section supersedes the earlier envelope identity and persistence recommendations. `schemaVersion` is now `housing-checkpoint.v2`: the checkpoint ID includes immediate parentDigest so reaching the same recipe/month by direct execution versus restart cannot collide under immutable saves. Old v1 envelopes explicitly reject; none were exposed through a production route in this worktree. Restore now requires exact canonical JSON, rejecting duplicate-key JSON and alternate encodings; it validates complete monthly prefix, required balance/RNG/flag fields, unique lifecycle project IDs, matching lifecycle clocks and strictly increasing fork months.

### Disk persistence supplied

`world/decision/backlog-replay/repository.js` exports:

```js
const checkpoints = createHousingCheckpointRepository({
  directory: privateCheckpointDirectory,
  adapter: replay,
  publicRoots: actualServedRoots, // absolute, existing filesystem directories
});
const scope = {ownerId: authenticatedOwnerId, experimentId, runId};
await checkpoints.save(scope, output.serialized, {
  expiresAt, // absolute epoch milliseconds, > now and <= now+30 days
  parent: {id: parentCheckpoint.id, digest: parentCheckpoint.digest}, // omit for root
});
const saved = await checkpoints.load(scope, {id, digest, recipeDigest});
```

All three scope IDs must be 1–128 ASCII letters/digits/underscore/hyphen. Use the SOURCE run's stable scope throughout its checkpoint ancestry. A new experiment must resolve its authorized source scope explicitly; do not guess a mapping. The existing decision store can place this helper beside its private data directory. Configured publicRoots must enumerate every served root. Physical path resolution rejects private directories inside those roots. Files are mode0600 in a mode0700-created directory. Reads reject symlinks and bound allocation/read size. Atomic publication uses an exclusive hard link from a synced temporary file; concurrent identical save succeeds, conflicting content or expiry fails without overwrite. Existing corrupt data never silently falls back. Missing files throw ENOENT; expiry fails explicitly. The helper does not claim distributed filesystem durability or authenticate a caller.

Child save requires an existing digest-pinned parent in the same scope, unchanged recipe, monotonic clock, matching lineage and branch-parent identity, exact metric/event/accounting prefix, and unchanged project prefix/risk draws. Child retention cannot exceed the retained parent's expiry. Roots are held immutable; no implicit overwrite or eviction occurs. The API owner should enforce per-owner checkpoint count/bytes and request concurrency before invoking CPU or disk work. Retention cleanup is host-owned: expire an entire dependency tree (or reference-count ancestors), never delete a live ancestor independently. No cleanup daemon or production retention change is installed by this track.

### Authentication and endpoint acceptance boundary

Authentication must come from the existing host session, not ownerId supplied in JSON. Before load/start/resume/fork, check read access to the source experiment/run and write/fork authority to the target. Preserve preview-hash approval and stale-input checks for each intervention. A share token granting read access must not grant fork/save authority. Bound incoming bytes before parsing, permit only supported model1.2.0 and exact envelope versions, and rate-limit checkpoint creation using existing workload controls. No client-supplied raw replay state enters simulateHousingRun. Responses distinguish not-found/unauthorized, expired, corrupt, conflicting immutable ID, incompatible version and over-limit records without exposing another owner's record existence.

Real-endpoint acceptance remains an explicit dependency: coordinator read-only audit at this follow-up found no checkpoint route or engine hooks in `backlog-integration` (HEAD observed `af061f3`). `git -C /Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia apply --check .../world/decision/backlog-replay/integration.patch` passed; no files were changed there. Once the coordinator publishes the route contract, endpoint harness must create an authenticated run, checkpoint month24, reload it, fork to48 and fork again to72, restart to120, compare actual numerical prefixes/digests, verify original parent unchanged, test foreign-owner/share-only access and missing/expired/corrupt/version/oversized payloads. No endpoint or browser acceptance is claimed before that wiring exists.

### Actual follow-up checks

- Final focused command `bun test test/backlog-replay.test.js`: **6 passed, 59 assertions**. Tests apply actual shared hooks in temporary source, round-trip to disk, reopen repository, execute two branch generations plus resume, verify immutable parent, concurrent identical saves, conflicting expiry save, owner separation, digest pinning, parent retention, altered causal prefix rejection, corrupted/oversized/missing/noncanonical/duplicate/version envelopes, incomplete rehashed state and publicly served-directory rejection.
- Five-file housing/lifecycle/replay regression command above: **56 passed, 2897 assertions** before the last two repository-prefix assertions. Final focused test covers those added assertions; full suite repeated in final verification below.
- No browser/screenshots: shared production API/UI remain unwired. Status **INTEGRATION-READY**, not DONE for historical tickets113/131. Concrete next action: coordinator cherry-picks this incremental commit and previous `dfc9224`, applies hooks, authorizes and wires API/store entrypoints, then supplies route contract for real-endpoint acceptance.

Final regression: `bun test --timeout 30000 test/backlog-replay.test.js test/housing-fork.test.js test/housing-model.test.js test/building-lifecycle.test.js test/checkpoint-replay.test.js` **56 passed, 2898 assertions, 5.03s**. Initial default-5-second run had two checkpoint test timeouts under concurrent host load (54 passed/2 timed out); the bounded30-second rerun passed without code changes. `git diff --check` passed. The repository reads at most8MiB+4097 bytes per file and bounds writes to8MiB+4096 envelope bytes.

## Actual endpoint and owned UI acceptance follow-up

Fixture setup fix is its own commit **52ce90c729910533dda7c46fc20d3397bddb436f**. It applies hooks only after successful forward `git apply --check`; otherwise exact reverse `--check` must succeed. Partial/incompatible patches reject. Set `HBL_REPLAY_SOURCE_ROOT` to exercise the coordinator's actual already-patched sources. Actual coordinator-source run: **6 passed, 59 assertions,14.37s**. The normal unpatched source fixture also passed6/59 earlier in this follow-up.

### Component integration interface

Owned browser module `world/decision/backlog-replay/ui.js` exports:

```js
import { mount as mountHousingCheckpoints } from './backlog-replay/ui.js';
const checkpoints = mountHousingCheckpoints(container, {
  getContext: () => supportedCompletedOriginalHousingRun ? {
    experimentId: state.experiment.id,
    runId: state.selectedRun.id,
    month: selectedCompletedMonth,
    years: state.experiment.years,
  } : null,
  fetch: window.fetch.bind(window), // optional; defaults to global fetch
});
checkpoints.update(); // after selected source/run/month changes or clearing selection
checkpoints.getReceipt(); // last accepted {id,digest}, or null after source change
checkpoints.destroy(); // abort, suppress late response and remove owned section
```

Coordinator alone owns the host container and normal selected-future mount callsite. Call update after selection/scrubbing and destroy when replacing the host. The component contains its own scoped styles, DOM labels, receipt field, target month and forward-operations JSON array. It supports root save at the source's selected month, load pinned receipt, resume to target, review fork and approve using the exact returned previewHash. It bootstraps `/api/local-capability` with actual same-origin fetch credentials and never reads/displays capability cookies. Source changes clear receipt/provenance and preview. Editing receipt, target or operations invalidates preview and aborts pending requests; approval also compares current source/form before sending. Generation checks discard late responses after cancellation/source update/disposal. Cancellation is explicitly local: an already accepted server write may finish. Provenance shows model/rules/recipe/engine versions, seed, exact month/digests, parent, lineage and expiry; synthetic-model caveat stays visible. No nested legacy scenario promotion exists.

### Real-browser harness and boundaries

`test/backlog-replay-browser.config.js` runs one Chromium worker against a real sourceRoot server on overridable port3489 with isolated temporary world/decision/workflow/checkpoint stores and signing key. SourceRoot is configurable, defaults to cwd, and is treated read-only by this track. It reuses installed sourceRoot Playwright dependencies; no package changes. Run from the replay worktree:

```sh
HBL_REPLAY_SOURCE_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia HBL_REPLAY_PORT=3489 bun /Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia/node_modules/@playwright/test/cli.js test --config test/backlog-replay-browser.config.js
```

The two journeys in `test/backlog-replay-endpoint.e2e.js` exercise:

1. Actual browser HttpOnly SameSiteStrict capability acquisition; completed actual API-created housing run selection; root24; pinned load; two nonempty exact-approved nested forks48/72; resume120; repeat/reload equality; immutable root; seed-matched control equals existing normal engine; foreign-owner access denial despite forged client ownerId; client ownerId ignored; forged capability rejection; cross-origin guards; false preview hash; missing/bad digest/corrupt/version-mismatch records and16KiB body limit. Private isolated test records are temporarily corrupted and restored; no production store is used. Provenance JSON records actual experiment/run/seed, root/final hashes, lineage, expiry and source commit. Actual Decision Studio screenshot reopens the API-created source.
2. Actual Decision Studio selectedRun binds getContext. The harness serves ONLY the owned UI module asset and mounts it in a dedicated test host; all API calls use the production server. Clicks save25/load/review/edit-invalidates/approve49/approve73/resume120, reload immutable root and show invalid receipt error. Actual endpoint responses are deliberately held AFTER fetch to deterministically test cancellation, source-change suppression and destruction. No API outcomes are mocked. UI screenshot and receipt provenance retained.

User-visible availability remains distinct: the component's real browser clicks are verified through the acceptance host; production host mounting is still coordinator-owned and not claimed by this track. API tests initially expected unsanitized version error text; coordinator now intentionally sanitizes it, so assertion checks rejection status/error without relying on private internal details. An early port3479 attempt could not bind; all actual accepted runs use isolated3489. No deployment or paid calls.

Final current evidence: actual production API + component browser suite **2 passed,16.9s**, against coordinator commit observed `aa01965b35d420ec6c8196474a662c432fdd219b`. Owned nested-resume screenshot addition then verified with focused component **1 passed,12.2s**. All assertions use actual browser cookies and normal production handlers; no fabricated run outcomes. Latest artifacts:

- API/source screenshot and full exact provenance: `/private/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-replay-browser-y1ZqCy/artifacts/backlog-replay-endpoint.e2-cda32-wo-approved-forks-→-restart/actual-checkpoint-provenance.json` and sibling `actual-decision-checkpoint-api-source.png`.
- Nested UI Month120 screenshot visually inspected: `/private/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-replay-browser-v1opUx/artifacts/backlog-replay-endpoint.e2-97e89-le-edits-cancel-and-dispose/actual-checkpoint-nested-resume.png`.
- Same directory `actual-checkpoint-component-provenance.json` records actual API experiment/run/seed/root/final receipts; `actual-checkpoint-component.png` captures stale-source controls before disposal.

Current ticket status:113/131 **INTEGRATION-READY** for normal-entrypoint UI mounting. Production engine hooks, real endpoint, browser capability, immutable persistence and two-generation replay are now actually verified, superseding the earlier “no endpoint” blocker. The remaining coordinator task is mount/update/destroy in normal selected-future host, plus its separately owned durable quota/tree-cleanup work. This track does not claim that a harness-mounted component is already available through the production page. Owned files remain only backlog-replay modules, uniquely named replay tests/config and this handoff. No shared source or global backlog edits. `git diff --check` passed.

## Final normal-page acceptance: DONE for bounded113/131

Coordinator's production Studio now mounts the owned component under `#physical-world`, updates it on selected source/scrub, and destroys it on pagehide. `test/backlog-replay-normal.e2e.js` is a separate normal-route regression: it does NOT inject a component, create a test host, intercept assets or mutate application state. Only read-only state polling and normal same-origin API setup/verification are used; all workflow actions use the actual saved-run selector, keyboard replay slider and production checkpoint buttons.

Final command:

```sh
HBL_REPLAY_SOURCE_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia HBL_REPLAY_PORT=3489 bun /Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia/node_modules/@playwright/test/cli.js test --config test/backlog-replay-browser.config.js --grep 'normal selected-future'
```

**1 passed,22.5s** (test21.5s). Earlier integer-month normal journey also passed13.2s; final adds explicit fractional24.9→recorded24 verification. First draft assumed integer slider steps and failed on actual0.1 playback step; test corrected to use actual keyboard PageUp and ArrowRight behavior, without changing production slider.

Actual completed API source selected using Construction future. Playback24.9 saves exactly recorded24, never a fractional model state. Save/load24 → review exact capacity edit → approve48 → review exact recession edit → approve72 → resume120 → reload final passes. Each approval request uses the exact preview hash visible in the UI; checkpoints retain exact model/recipe/parent hashes and two-generation lineage. Each child prefix equals its actual stored parent. Root serialized hash/content remains unchanged after both branches/resume. Changing playback to25 clears receipt and disables approval; selecting the second actual saved run clears receipt and invalidates the pending preview. **Zero unexpected page errors and zero console errors**.

Evidence root: `/private/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-replay-browser-Ze0drP/artifacts/backlog-replay-normal.e2e.-b5d30-nd-invalidates-stale-source/`.

- `normal-checkpoint-nested-resume.png`: actual normally mounted production checkpoint panel at resumed120; visually inspected.
- `normal-checkpoint-provenance.json`: actual source `decision_829e3420-be28-4495-9b51-f6844d36d12c`, run `baseline_0001`, seed110210400, exact root/final receipts, lineage, model1.2.0 and recipeDigest, recorded24 vs playback24.9, zero error arrays. Source HEAD observed at final evidence capture: `37877fbc763cf737a5ffab86024087b4a49ebe89` (coordinator checkout was active, not a frozen deployment).

Acceptance status supersedes earlier integration blockers: **DONE for the bounded local housing checkpoint/restart/nested-fork slice of historical113/131**. Coordinator owns broader release status and its quota/tree-cleanup verification. Local capability lifetime/key-loss recovery and synthetic model limitations remain as documented; no hosted multi-user ownership, cross-model authority, legacy nested promotion, deployment or empirical calibration is claimed. Framework harness tests remain separate from this normal-page proof. Only new unique test/config and this owned handoff changed in this final acceptance increment. `git diff --check` passed.
