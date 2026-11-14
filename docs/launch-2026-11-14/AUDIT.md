# Civic launch audit — November 14, 2026

Inspected existing engineering/product instructions, source, recent chats, worktrees, remote refs and merged PRs before implementation. Primary sprint checkout has unrelated uncommitted Symphony and documentation changes; preserved. Isolated HBL integration starts at current main `3faa2699655baed0e5550cd0aec450a132ef29f1`. Civic work uses a separate clean current-main clone; no third product created.

## Existing behavior and discrepancies

- Main contains PR316 law playback/API and the deterministic Future Machine. Existing law tests exercise actual paired results; initial baseline12 tests/93assertions passed.
- PR305 merged only to sprint, while PR316 merged to main. Main lacks its bounded /world Run lifecycle. Port only the necessary lifecycle, preserving other main behavior.
- Existing Civic PR120/121 are merged to main; the native explorer was gated behind frozen capture and its request origin was excluded by CSP. Source existence did not establish a usable first action.
- Existing housing golden scenario and replay/evidence/fallback infrastructure are reused; no new simulation rule or invented actor story is introduced.
- Existing participation, journal authorization and governance are preserved. No advisory or developer vote is cast.

## Read-only production observations

HBL `/api/health` returned `{"status":"ok","buildId":"unknown"}`. Civic `/version` returned null commit, demo mode, production environment and build time2026-11-14T04:44:45.154Z. HBL `/api/law-behavior` OPTIONS from the Civic production origin returned404. These observations block launch qualification: merged native API is not verified deployed. No production POST, deployment or data mutation performed.

No traffic, interview, contact delivery, conversion or satisfaction claims are made. Production SHA, approved image and rollback remain release-owner checks.

## Fly image inspection (read-only)

Confirmed app targets happybearlandia (release69,dfw,auto-stopped machine at inspection) and civic-synthesis (release11,iad,started). HBL image digest `sha256:bd65eea23eeffb3d2072d5815faabb9842ad9a96eac75d167cdfaadb0cfdb2e8`; Civic image digest `sha256:90f5574e4fc6aee72999a214a0960ab4fdfcffe33324df9974bac67ad53137f1`. OCI source/revision labels identify the inherited oven-sh/bun base image, not either application commit. They must not be reported as application release SHAs. No machine start/stop/restart was requested. Image digests give rollback references but not application-source parity or a tested rollback.
