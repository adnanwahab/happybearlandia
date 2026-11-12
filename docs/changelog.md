# Public release changelog

Open `/tools/` and choose **Release changelog**. The static page loads
`/data/changelog.json` without credentials, API writes or a deployment worker.
The checked-in manifest is intentionally empty: current production-to-Git
proof is insufficient. PR25/26, issue completion and sprint merges are not
release evidence.

## Contract and review

Schema version 1 has exactly `schemaVersion` and `entries` (maximum 100).
The UTF-8 manifest is bounded to 65,536 bytes, including streamed responses.
Each entry has exactly `title` (1–120 characters), `summary` (1–600), `pr`,
and `deployment`. Text must be nonblank with no control characters; rendering
uses textContent. No arbitrary HTML or external URL hosts are accepted.

`pr` has `number` (positive integer, at most 1,000,000,000), `mergedAt`
(canonical UTC timestamp, seconds precision), `mergeCommit` (40 lowercase hex),
and `url` (exact repository `/pull/<number>` URL).

`deployment` has `version`, `commit`, `deployedAt`, `versionUrl`, `evidenceUrl`,
and `verified: true`. Version is the exact full deployed commit SHA, equal to
both commit and PR mergeCommit. The version URL is the exact repository
`/commit/<sha>` URL. Evidence must be a repository `/actions/runs/<positive id>`
URL without query, fragment, userinfo or arbitrary redirects in its stored URL.
Deployment time must be at or after merge time. Dates must exist on the calendar.
Unknown fields are rejected. Entries are newest first; duplicate valid versions
invalidate the manifest. Malformed envelope/JSON or load failure shows unavailable;
invalid/unverified individual entries are excluded and zero accepted entries
shows the honest empty state.

A host reviewer adds real records only after independently checking:

1. The linked PR is merged and its actual merge commit equals mergeCommit.
2. The linked successful deployment run deployed that exact SHA to the public
   production application, with a durable public record identifying environment,
   artifact and timestamp. A green test/build job alone is insufficient.
3. The public deployed application/version evidence agrees with that exact SHA.
4. All links are readable by reviewers, contain no credentials or private data,
   and the note describes only the change in that PR.
5. Review the manifest diff and rerun unit/browser checks before publication.

The validator checks structure and consistency, not GitHub or production truth.
`verified` records a human review assertion; it cannot manufacture verification.
This first slice deliberately accepts only deployments of the exact merge SHA;
ancestry, batched releases and other evidence providers need a reviewed contract
extension. No production network lookup occurs in the page. Synthetic records
exist only in tests and must never be copied into the production manifest.

## Implementation and verification

The pure API `ops/changelog.js` exports MAX_BYTES, verifiedEntry and
parseChangelog from the browser-safe Tools module. This keeps one validator
without opening a new server route: existing routing serves Tools/data, not ops.
Shared server, release docs, gameplay and implementation plan are untouched.

Commands from repository root (Bun must be on PATH):

```
bun test test/changelog.test.js
bunx playwright test -c test/changelog.browser.config.js
```

The focused browser config starts the normal application on port 31921. Tests
cover the actual Tools link, empty manifest, responsive layout/focus, safe text,
exact synthetic evidence links, rejected records, HTTP/network/JSON/schema/size
failure states. The empty-state screenshot target is
`docs/images/she121-changelog.png`.

Initial sandbox execution could not launch Chromium: macOS denied the
MachPortRendezvousServer bootstrap. The worker preserved its source and parked
without a commit or publication claim. Trusted-host verification on November 11,
2026 then ran the unchanged suite with `HBL_CHANGELOG_PORT=41995`:
all seven checks passed in 2.6 seconds. The six unit tests passed with 27
assertions. The generated empty-state screenshot was visually inspected: clear
heading, normal Tools navigation, honest no-release message, no clipping or
sensitive data. The suite also checked 320px width and keyboard focus, safe text,
exact evidence links and five unavailable-data paths. The production manifest
remains empty; all populated records are synthetic test fixtures.

This host verification does not weaken the model sandbox, claim deployment,
or establish that future unattended Chromium runs can launch inside that
sandbox. Draft publication remains a separate trusted-host action after current
base synchronization, clean commit and approval checks. No main merge/deploy.
