# Open PR browser and on-demand previews

Routes: `/github`, `/github/pulls/:number`, `/github/previews/:id`.
Only **open PRs** are requested: GitHub REST `state=open`,25records/page. Draft
is shown separately. Closed/merged filtering from the original task is deferred
by the user's explicit open-only scope. Detail may honestly report a PR that closed
between requests; closed PRs cannot be admitted. No metadata GET, hover, scroll,
search or status poll fetches source/builds/starts a runtime. Search is page-local.
Checks remain unknown unless verified; no green CI is inferred.

## Boundaries and authority

No existing maintainer web session/authentication was found in the inspected server.
Creation therefore defaults disabled. Configure a real operator bearer capability
(at least32characters) and enter it in the maintainer field for explicit requests.
The capability remains only in page memory (no URL/storage); transport it only over
loopback or HTTPS. Do not use a GitHub/Fly token as this capability. Same-origin and
CSRF checks precede costly POSTs. The web service forwards only to a configured
trusted runner using a different controller capability. Neither secret reaches the
guest or status response. Metadata uses public read-only GitHub access by default,
`HBL_GITHUB_READ_TOKEN` server-side optionally, or `HBL_GITHUB_TRANSPORT=gh` on the
local host to reuse its existing authenticated gh login without extracting a token.
Rate-limit/auth/unavailable errors are visible. Production need not install gh.

The runner is a separate persistent process with private SQLite WAL jobs, a held OS
process lock and durable SHA/recipe identity. Production Fly idling cannot terminate
it. On Fly, run it on a separate always-on controller with persistent private state,
never the production database Machine. Shared main-app/runner state is not required:
the web app proxies admission/status over an operator-configured HTTPS service. The
loopback server deliberately has no unauthenticated remote listener; a reviewed
TLS/reverse-proxy boundary is required for a remote controller. No scheduler or
system service is installed by this change.

Default limits:1preparation,2active runtimes,8pending jobs,6newrevisions/hour per
configured operator,15minute preparation deadline,20minute idle and1hour maximum
lifetime. Failed cleanup reserves capacity and is retried; unknown resources are
never deleted. Same-SHA clicks reuse the durable job. Explicit retry rechecks the PR
head, authentication and cleanup; stale revisions require another deliberate click.
Idle means time since explicit entry/touch, not observed gameplay activity. Long
sessions must re-enter/touch before20minutes; the UI states the limit. There is no
claim of transparent active-session protection beyond the documented limit.

## Local setup

Docker Desktop/Engine must be running; Bun, Python3 and a current browser are
required. Use one private state directory outside the repository and primary data.
Set these variables through the host's secret management (values intentionally not
included):

```
HBL_PREVIEW_STATE_DIR=<absolute mode0700 private directory>
HBL_PREVIEW_RUNNER_TOKEN=<new controller capability, minimum32characters>
HBL_GITHUB_TRANSPORT=gh
```

Run from the feature checkout:

```
python3 ops/previews/run-host.py
```

This starts the separate controller on127.0.0.1:4399. In the primary application
process configure:

```
HBL_PREVIEW_RUNNER_URL=http://127.0.0.1:4399/
HBL_PREVIEW_RUNNER_TOKEN=<same controller capability>
HBL_PREVIEW_OPERATOR_TOKEN=<different maintainer capability>
HBL_GITHUB_TRANSPORT=gh
```

Restart only your owned application process as appropriate; do not restart Symphony.
Open `/github`, select a PR/detail, enter the maintainer capability and click
**Try this version**. The runner freshly resolves the exact current head and returns
409if it changed from the displayed SHA. Preview IDs bind repository+fullSHA+trusted
recipe; moving a branch never replaces another revision.

The provider fetches one exact public codeload archive, with no credentials or
redirects, then retrieves only locked registry package archives. It rejects unsafe
paths, links, special files, duplicate entries, unsupported nested/custom dependency
sources, missing integrity, excessive counts/downloads/expansion. All selected
code and lifecycle/install scripts are prohibited on the host. Dependencies are
integrity-checked data; lifecycle scripts are never executed. Some revisions with
native postinstall requirements are intentionally unavailable under this recipe.
Private-repository source transport is not implemented. Current source/dependency
payload is bounded768MiB; live source cache1GiB and individual bundle800MiB; caches
are removed after transfer or owned cleanup. Docker's shared trusted runtime image
cache remains operator-managed, not per-revision built images locally.

The runtime is digest-pinned Bun with network=none, UID1000,read-only root,
no capabilities/new privileges, CPU1,RAM2GiB,PID128 and boundedtmpfs/logs.
It mounts no host paths, socket, home, credentials, production data or repository.
A trusted HTTP/WebSocket relay uses fixed dockerexec code to connect to the guest's
loopback server. It never falls back to a host port. Each preview has its own
`<identity>.localhost` origin with strict Host checks and a persisted gatewayport;
all cookies/authorization are stripped in both directions. CSP prevents browser
fetches/forms/frames to production/control origins. Existing browser CDNs are
allowlisted for scripts only. External backend integrations fail due to denied
network; the selected backend and assets/worker/WebSocket requests share the guest.
The gateway reserves `/__hbl_preview` for controller identity. Readiness verifies
source marker, exact backend buildID, `/api/ready` and real HTML; this is explicitly
separate from browser graphical rendering proof.

Host admission requires normal macOS pressure and≥2GiB estimated headroom (Linux:
MemAvailable≥2GiB), plus≥3GiB disk. There is no unsandboxed/resource-guard fallback.
For cleanup, authenticated `POST /api/github/previews/:id/stop` with JSON `{}`
marks the durable owned job; the controller removes its exact labelled container
and source cache. Status GETs do not clean or rebuild. Do not manually delete
unknown Docker containers. Stop/restart only the preview controller you own;
containers and durable jobs are retained and reconciled without a new identity.

## Verification and limits

See `docs/github-preview-evidence.md` for actual commands/results and limitations.
Provider tests are not live rendering proof. Browser UI smoke uses mocked metadata
and verifies navigation/XSS/mobile/one-click behavior independently. Fly setup and
pending activation are in `docs/github-fly-previews.md`. No Symphony assignment,
approval, worker configuration or publisher system is changed by this feature.
