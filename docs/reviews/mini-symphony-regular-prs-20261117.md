# Mini Symphony regular PR publication — November 17

Slice: preserve new regular PR creation and make a recovered, exact owned draft
ready for review after existing branch/base/clean-tree/remote-head checks. No bulk
conversion, merge action, production authorization or repository policy change.
Own publication.ts, its recovery/artifact tests and interface notes in Mini README.
Isolated branch from7204f5d0; preserve unrelated root changes and active workers.

Audit: current source and installed Dear Congress bundle3483bb49 both already
create PRs without `--draft`. The bundle predates recent source (November15), but
its create behavior is regular. The shared function's old `publishDraft` name is
kept for callers. Both implementations omitted isDraft from existing-PR lookup,
so recovering a matching draft returned delivery success while leaving it draft.

Acceptance: new PR creation remains regular; exact owned open drafts become
ready only after all guards; clean regular/merged receipts remain idempotent;
closed, dirty, divergent and unknown-draft-status records cannot become ready;
ready failures stay failures and retry safely even after a lost success response.
No model/ODD or application/browser behavior changes; no Playwright required.

Runtime installation must preserve CAS backups and never interrupt active HBL or
SHE-269 workers. Updating a bundle on disk does not hot-reload a running coordinator;
recovered-draft behavior takes effect on its next normal safe restart. New PRs are
already regular in current running code. CI, required reviews and merge protections
still determine actual merge eligibility. Auto-merge is not globally enabled.

## Verification and installation receipt

- `bun test tools/symphony/mini-bun/recovery.test.ts tools/symphony/mini-bun/artifact-publication.test.ts`: **30passed,0failed,136assertions,1.99s**. Includes
  real temporary Git remotes and new ready/recovery/fork/fresh-head regressions.
- `bun test tools/symphony/mini-bun/project.test.ts tools/symphony/mini-bun/follow-up.test.ts tools/symphony/mini-bun/integration-queue.test.ts`: **30passed,1failed**
  in33.78s. The screenshot normal-entry fixture failed because this isolated clone
  initially lacked node_modules; a host rerun before linking dependencies also
  failed. Linked the already-installed repository dependencies, with no install
  or lockfile changes. Focused host rerun of `configured normal entry screenshots`:
  **1passed,0failed,24assertions,6.84s**. Original failing observations retained;
  no test or threshold was weakened.
- Existing installed gh accepts the exact `state,isDraft,headRefName,baseRefName,headRefOid,isCrossRepository` read fields (read-only PR408 check).
- `bun build tools/symphony/mini-bun/run.ts --target=bun --outfile /private/tmp/hbl-mini-regular-pr-runner-20261117.js` succeeds,12modules. Staged bundle
  SHA256 `b835c4d50ffeb3f6ae3ce19ce5d67263803b106a0d6e7f3ad49986c7378fc1cf`.
- Whitespace/diff checks pass. No browser-facing code or model state changed.

Existing publication guards now additionally bind PR headRefOid to local HEAD and
reject cross-repository records. A draft's same-repository/branch/base/head/open
identity is fetched again immediately before `gh pr ready`; unknown or changed
identity remains a failure. GitHub has no ready-operation head CAS, so this fresh
check narrows races; marking ready still grants no CI/review/merge exemption.

No active coordinator is restarted by this change. Current running code already
creates regular PRs; updated draft recovery loads on the next normal safe restart.
Runtime on-disk installation evidence follows if approved.
