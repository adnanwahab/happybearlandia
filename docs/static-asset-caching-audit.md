# SHE-43 static asset caching and CDN readiness audit

Status: local audit implemented; **staging acceptance remains blocked**. No CDN,
production configuration, application response policy, or simulation data changed.

## Ownership, source and dependency reconciliation

The release coordinator assigned this issue only this report,
`ops/static-asset-cache-audit.mjs`, `test/static-asset-cache-audit.test.js`, and
`docs/evidence/she43-local-headers.json`. The persistent Linear workpad is
`e90e3b64-15dc-44a8-a3b2-c379242a0a35`. Source baseline is remote sprint
`f1174eb9a5cead6892370d25af97167a0babb54b`; the independent issue branch is
`codex/she-43-static-cache-audit`. Shared `server.js`, CI, the implementation plan,
and browser/renderer contracts remain coordinator-owned. The coordinator checked
open PR files and retained U03 review/R13/R14 repair claims; these paths do not
intersect. Symphony had zero running/retrying issues at preflight; no execution
label was added by this work.

[PR #21](https://github.com/adnanwahab/happybearlandia/pull/21) adds ballot HTML and
voting API routes in `server.js`, plus private voting storage. Its inspected diff
does not modify `serveFile`/`serveStatic` caching. This audit does not incorporate
those unmerged routes or certify their privacy/CDN behavior. The broad `/data`,
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

Tracked candidate inventory at the baseline:

| Category | Files | Bytes |
| --- | ---: | ---: |
| JavaScript / MJS | 1,044 | 18,599,687 |
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
