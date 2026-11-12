# SHE-78 demo readiness verification

Local source verification, 2026-11-12; baseline b963dd3. No deployment.
GitHub search for SHE-78 returned no PR. Existing release-health implementation
and workspace integration audit confirm storage-only readiness was partial.

`GET /api/demo/ready` (also HEAD) reports `status`, safe `buildId`, and fixed
`checks`: demoAssets, scenarioFixtures, cityStorage, worldStorage,
decisionStorage. All must be `ok` for HTTP 200 / `ready`; otherwise HTTP 503 /
`unavailable`. Other methods return 405. Responses use no-store; internal probes
are cached for two seconds. Existing health and readiness contracts are preserved.

The bounded file inventory follows the homepage Play Demo into Future Machine.
Its fixture is the versioned synthetic recipe and City seed generator, not an
external dataset. The probe checks readable nonempty files without importing or
running the simulation. City storage is inspected through a read-only SQLite
connection and a bounded experiment-index query. Before lazy initialization, it
checks the existing directory ancestor without creating files or changing jobs.
World/Decision reuse existing probes. No URLs, paths, credentials, exception
messages or simulation records appear in the response.

Reproduce:

```sh
bun test test/release-health.test.js test/release-operations-dry-run.test.js
bun test test/server.test.js
git diff --check
```

Observed: focused suites passed 15 tests / 87 assertions / zero failures.
Whitespace check passed. The actual server smoke failed before listening;
direct startup reproduced Bun EADDRINUSE on port 0 in this sandbox. Its new
HTTP route assertion remains unverified here. Playwright skipped because local
server setup blocks it; no browser behavior changed.

Limits: availability is not end-to-end simulation correctness, full transitive
asset coverage, graphics support, disk capacity, backup integrity, or a write
transaction guarantee. No external AI/map calls are made: the synthetic demo
uses local City inputs. An uninitialized City directory is considered available
when its ancestor is accessible; first-write failures remain possible. Existing
World/Decision probes are included conservatively even though the homepage demo
primarily uses City storage. Public live readiness and hosted CI remain unverified.
No commit/PR created by this source-only workspace turn.
