# SHE-43 static asset caching and CDN readiness audit

Status: local audit implemented; **staging acceptance remains blocked**. No CDN,
production configuration, application response policy, or simulation data changed.

## Ownership, source and dependency reconciliation

The release coordinator assigned this issue only this report,
`ops/static-asset-cache-audit.mjs`, `test/static-asset-cache-audit.test.js`, and
`docs/evidence/she43-local-headers.json`. The persistent Linear workpad is
`e90e3b64-15dc-44a8-a3b2-c379242a0a35`. Original source baseline was remote sprint
`f1174eb9a5cead6892370d25af97167a0babb54b`; the independent issue branch is
`codex/she-43-static-cache-audit`. Shared `server.js`, CI, the implementation plan,
and browser/renderer contracts remain coordinator-owned. The coordinator checked
open PR files and retained U03 review/R13/R14 repair claims; these paths do not
intersect. Symphony had zero running/retrying issues at preflight; no execution
label was added by this work.

[PR #21](https://github.com/adnanwahab/happybearlandia/pull/21) adds ballot HTML and
voting API routes in `server.js`, plus private voting storage. Its inspected diff
does not modify `serveFile`/`serveStatic` caching. The original audit did not incorporate
those then-unmerged routes. The current-base refresh below adds their local header
coverage; it does not certify their privacy/CDN behavior. The broad `/data`,
`/game`, `/tools`, `/visualizations`, `/world` serving roots remain an exposure
boundary: never place credentials, user saves, or private operational records in
them. Existing deny rules are route-specific, not a general public-file manifest.
The test verifies one existing private-source denial; it is not a comprehensive
security scan or proof that every server-only module is denied.

## Reproduce without touching existing stores

Install the repository's locked dependencies beforehand. From an isolated issue
checkout run:

```sh
env -u LINEAR_API_KEY -u GH_TOKEN -u GITHUB_TOKEN -u GH_ENTERPRISE_TOKEN -u GITHUB_ENTERPRISE_TOKEN bun test test/static-asset-cache-audit.test.js test/server.test.js test/release-health.test.js
env -u LINEAR_API_KEY -u GH_TOKEN -u GITHUB_TOKEN -u GH_ENTERPRISE_TOKEN -u GITHUB_ENTERPRISE_TOKEN bun ops/static-asset-cache-audit.mjs > /tmp/she43-local-headers.json
git diff --check
```

The audit exports committed `HEAD` to a new temporary directory, excludes `.env*`
files, reuses installed dependencies, then starts the real `server.js` with
`--no-env-file`, a credential-free environment allowlist, port zero and disposable
stores. Exporting source also isolates legacy module-relative `.data` paths that
ignore environment overrides. It stops only its own subprocess and removes only
its own temporary export. No production or staging request is made. A test checks
that existing source-directory City History store metadata is unchanged.

Only fixed loopback GET/HEAD routes are measured. The collector rejects remote
origins, credentials, redirects and arbitrary URL paths, uses 10-second per-request
timeouts and a 32 MiB streamed body limit, and stores selected header fields,
status, byte length and SHA-256 only. It does not retain bodies, cookies or
authorization headers. Exit zero means collection completed with expected status
and required dynamic `no-store`, **not CDN readiness or zero findings**. Missing
freshness headers are retained as findings rather than silently repaired.

The evidence records source SHA, audit tool SHA-256, UTC observation time and
Bun/OS/architecture. Inventory is tracked candidate files under public-root
source directories, excluding dependencies/untracked state. Counts describe files,
not confirmed URL reachability. Imported modules or dependency contents served via
curated vendor routes are measured separately by HTTP.

## Local observations

The committed evidence is **local non-production** on macOS arm64, Bun 1.4.2.
Sixteen paths were requested with both GET and HEAD (32 measurements). All expected
statuses completed. GET observations:

| Response | Observed policy | Interpretation |
| --- | --- | --- |
| `/` | No explicit Cache-Control | HTML freshness is unspecified; do not put a long shared TTL on this entry point. |
| `/world/future-machine.html`, `/world/future-machine/main.js` | `no-cache` | Retain revalidation for these stable URLs. |
| Curated Three and Jolt vendor JS | No explicit Cache-Control | Stable URLs are not safe immutable candidates. Jolt's compat JS embeds its WASM. |
| `/tools/lumen/addons/libs/basis/basis_transcoder.wasm` | No explicit Cache-Control; GET `application/wasm` | Standalone WASM exists and is served, distinct from Jolt's embedded WASM. |
| `/data/screenshots/1.gif`, `/data/glb/poker_chair.glb` | No explicit Cache-Control | No verified content hash in these names; do not assume immutable. |
| `/game/main.js` | `no-store` | Runtime-generated bundle remains fresh. |
| `/api/health`, `/api/ready`, `/api/config`, `/api/world-experiments` | `no-store` | Sampled mutable/health JSON is not cacheable. No claim about every API. |
| Known source denial, malformed encoding, missing route | 404, no explicit Cache-Control | Keep negative caching disabled or very short at any future edge. |

HEAD bodies were empty. Some Bun file HEAD responses omit metadata present on
GET; saved experiment collection HEAD returns the existing 405 with `no-store`.
The audit records those actual contracts rather than treating HEAD as complete
substitute evidence. Sampled responses had no ETag, Last-Modified, Age, Via or
Content-Encoding header. This does not prove edge validator/compression behavior.

Tracked candidate inventory at the refreshed candidate (see revalidation below):

| Category | Files | Bytes |
| --- | ---: | ---: |
| JavaScript / MJS | 1,045 | 18,602,572 |
| Images | 27 | 39,157,767 |
| Standalone WASM | 2 | 719,753 |
| GLB/GLTF/OBJ models | 67 | 93,720,256 |
| JSON data (not all model assets) | 307 | 35,330,341 |

No fingerprinted publication manifest was established. A UUID/date/version-like
filename is not evidence that its content is hashed or cannot be overwritten.
The inventory and sampled URLs provide a starting set, not an exhaustive dependency
or deployed Docker-image manifest. JSON event files are inventoried by metadata;
the audit does not fetch their contents or classify them as authoritative saves.

## Safe remediation proposal (requires shared-file ownership)

1. Give root and other unversioned HTML an explicit revalidation policy consistent
   with World HTML. Preserve `no-store` for generated bundles and mutable APIs.
   Do not turn a passing local probe into authorization to edit `server.js` here.
2. Add a reviewed content-hashed asset publication step and manifest. Verify each
   filename hash against emitted content, publish new objects before referencing
   them in HTML, and keep prior assets available through the rollback window.
   Only then consider `public, max-age=31536000, immutable` for that exact static
   manifest allowlist. Do not match arbitrary hash-looking paths or all `/data`.
3. Keep HTML, errors, runtime configuration and mutable API routes outside that
   immutable allowlist. Review query-string variation, encodings, range requests,
   content type and authorization/cookie behavior before enabling shared caching.
4. Existing saved date-media image API emits an immutable header under a
   record-identity URL. That separate API contract was observed in source, not
   exercised with user media and not generalized into this static proposal;
   privacy/access and immutability review stays with that API owner.

`no-cache` permits storage but requires validation before reuse; `no-store`
prohibits storage. Neither a missing header nor an absent Age proves caching is
off. See [MDN Cache-Control documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
for these directive semantics and immutable versioned-resource guidance.

## Staging gate still open

Coordinator read-only discovery found no GitHub environments and Fly apps
`dear-congress`, `digital-pensieve`, and `happybearlandia`, none established as an
approved HBL staging target. **Do not use production as staging or provision an
app/volume to close this ticket.** This issue remains In Progress, not In Review,
until the operator supplies:

- An approved staging origin and app identity, candidate build SHA and authorization
  for read-only HTTP checks, with no production data requirements.
- The actual edge/CDN configuration or confirmation of which layer caches each
  route; perform GET/HEAD and repeated/conditional requests there.
- Build/header evidence showing HTML and mutable API freshness, static MIME types,
  stale-response exclusion, and any proposed immutable manifest's content integrity.

The local collector intentionally refuses remote origins. After approval, use a
separately reviewed bounded staging procedure rather than bypassing that guard.
No formal dependency on another issue was invented merely to represent missing
external staging approval.

## Validation

The actual command above passed **13 tests, 0 failures**, including existing
server/release-health contracts, source-store non-modification, dynamic `no-store`,
World revalidation, expected errors and HEAD behavior, remote-target rejection,
secret/body omission, oversized-body rejection, and missing-header diagnostics.
The command initially failed under restricted loopback binding (both the existing
server smoke and the new server), then passed with authorized local server
permissions. The added saved-collection HEAD probe first exposed 405 rather than
an assumed 200; the test now verifies that existing method contract without
altering the server. The final receipt is regenerated after tool changes.

`git diff --check` passed. No lint/typecheck script is defined in package.json.
An attempted `node --check` was unavailable on this shell PATH; Bun tests parse
and execute both new modules. Playwright was skipped because no UI/browser code
or serving behavior changed; real HTTP integration checks cover this audit scope.
No production response policy was corrected under another owner's reservation.


## Fresh-base integration revalidation

Before publication the coordinator's freshness guard detected that remote sprint
advanced to `f794ba25e89ee1db9c1ee3a6bdc562e404ca1965`. It includes reviewed
replay/manifest and saved-World/browser assertion repairs from another owner.
The coordinator merged that base losslessly into this issue branch as
`59d2e6546421732b41c137d0d8d114fb22c89ce9`, retaining the original SHE-43
implementation commit `bb469f0fbb822fa494f12f1b882158919bbfd7f1`. None of
this issue's owned audit paths overlapped the new base; this worker changed only
this report and its evidence receipt during revalidation.

On that exact merged candidate the credential-stripped test command above
passed again: **13 tests, 0 failures, 207 assertions, 2.13 seconds**. The CLI
exited zero; refreshed receipt observation time is `2026-11-12T03:26:16.968Z`,
with `sourceSha=59d2e6546421732b41c137d0d8d114fb22c89ce9`. All 32 GET/HEAD
measurements matched expected statuses, sampled policies were unchanged, and
the receipt's auditToolSha256 matched the unchanged collector's SHA-256.
The artifact pins the application source exported before this report/evidence
commit; it cannot self-reference the commit containing its own bytes.

Current tracked source inventory adds one JavaScript file and 2,885 bytes.
The first audit on f1174eb observed 1,044 JS/MJS files / 18,599,687 bytes;
those earlier passing tests remain historical evidence, not substituted for
this refreshed run. All other inventory category counts/bytes remain unchanged.
`git diff --check` passed again. Staging acceptance remains unverified and no
publication, merge into sprint, production request, or deployment was executed
by this issue worker.


## Current-base ballot route coverage refresh (2026-11-11)

PR #21 is now merged (merge `bd2943e48053f0aa99b97a2d28e1d58a26f99fea`);
PR #29 containing the original SHE-43 audit is also merged (merge
`3fb9652f83d49e2d39d55aee7b31b6593f8c5849`). On current source
`0d5a529290773d66f293e624bdbf408d07970d2a`, the fixed probe list omitted
the new ballot page and supported read-only voting endpoint. This scoped refresh
adds `/vote-on-patch` and `/api/patch-votes` to the collector and regressions,
without changing voting, server policies, CDN, CI, or runtime configuration.

The regenerated receipt is the current local evidence. At
`2026-11-12T04:26:55.673Z`, **36 GET/HEAD measurements** matched their expected
statuses with no request errors. `/vote-on-patch` returns 200 and `no-cache` for
both methods. `/api/patch-votes` returns GET 200 and HEAD 404, both `no-store`;
HEAD 404 is the existing handler contract, not an assumed successful method.
The collector records selected headers and body hashes, never cookie/token values
or response bodies. Tests confirm neither the source city store nor the source
private voting store changes; all new local stores live in the disposable export.

The credential-stripped scoped command above passed **13 tests, 0 failures,
235 assertions, 2.37 seconds**, including real server/release-health integration.
The standalone local collector exited zero, and its SHA-256 matches the receipt's
`auditToolSha256`. The receipt exports application source at the base SHA above;
it cannot self-reference the commit containing its own bytes. Earlier 32-request
receipts and PR-overlap notes above are historical evidence. Existing missing
static/error cache-policy findings remain observations, not fixes in this scope.

**Staging remains blocked:** no approved staging origin/app or candidate build
was supplied. No staging/production measurement, deploy, runtime ownership change,
or external publication was performed by this worker. The next external action
is operator approval of the staging target/build and the bounded checks described
above; this local refresh does not close staging acceptance.


## Coordinator current-base verification before draft publication

The host publisher stopped before push when the remote sprint advanced to
`33e84c3bba954173dcf3f08c17ac6721a6f141dc`. The dedicated issue branch incorporated
that base through a lossless local merge `0d126fa5b619fe7b038c04db1c710da4ba6855b9`;
original candidate `3491cd152d7eb78f71014b7624a5c1afbdea275e` is retained.
The incoming scheduler/workpad paths do not overlap the four audit-owned files.
No PR or integration branch was merged by this coordinator.

On the combined source, the independent seven-file release/health/dependency/
backend/cache/server/voting-server command passed **35 tests, 0 failures, one
existing opt-in browser skip, 349 assertions**, 2.34 seconds. Exact command:
`bun test test/release-operations-dry-run.test.js test/release-health.test.js test/dependency-browser-audit.test.js test/future-machine-backend.test.js test/static-asset-cache-audit.test.js test/server.test.js test/patch-voting-server.test.js`.
The refreshed collector exited0 at `2026-11-12T04:29:48.331Z` with36 expected-status
local measurements and a matching tool hash. The committed receipt records the
exported source merge SHA above. Staging remains explicitly unverified; no
production, CDN, live runtime or approval-label changes occurred.

## SHE-43 workspace reinspection — 2026-11-12

Reinspected source `b963dd353538294cb0fbf5d34d5283fad6e10e68` on
`mini/SHE-43`. Existing inventory, bounded collector, ballot probes and immutable
publication proposal already cover the implementation scope; no duplicate feature
or response-policy change is needed. Shared server/plan ownership remains intact.
Previous PRs #29 and #39 and the committed HTTP receipt are historical evidence,
not measurements of this checkout. Source still gives World HTML `no-cache`,
generated game JS and sampled mutable APIs `no-store`, and root/static assets no
explicit general cache policy. No verified content-hashed publication manifest
was established, so the immutable allowlist proposal remains conditional.

Current exact verification commands (credentials stripped as above):

```sh
bun test test/release-operations-dry-run.test.js test/release-health.test.js test/dependency-browser-audit.test.js test/future-machine-backend.test.js test/static-asset-cache-audit.test.js test/server.test.js test/patch-voting-server.test.js
bun test test/static-asset-cache-audit.test.js test/server.test.js test/release-health.test.js
git diff --check
```

The seven-file run returned **32 pass, 1 skip, 3 fail** (236 assertions).
The audit integration initially failed because this workspace has no local
`node_modules`; the other failures were server startup checks. Temporarily linking
the already installed parent dependencies resolved the audit export/dependency
failure. The focused rerun then returned **11 pass, 2 fail** (130 assertions),
with both failures at server startup. A standalone `Bun.serve` probe using
`hostname: '127.0.0.1', port: 0` also failed with `EADDRINUSE`. Local HTTP
revalidation is therefore blocked in this execution environment; no claim of a
new successful header run is made. The temporary dependency link was removed.
`git diff --check` passed. No lint/typecheck script is defined. Playwright was
skipped because this documentation-only refresh changes no browser behavior.

Staging origin/app, candidate SHA and edge identity remain unspecified in the
available issue and repository evidence. Requested those details from the user
along with authorization for read-only staging checks. Until supplied, retain
In Progress and the staging gate above; no production fallback, deployment,
merge, external message or issue-state mutation was performed. Next action is to
run the bounded staging procedure on the approved build from an environment
that permits HTTP checks. The existing receipt is deliberately unchanged.
