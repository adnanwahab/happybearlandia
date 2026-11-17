# Hundred-feature regression evidence

SHE-786's local integrated slice inventories HBL-FUN-101–200 and composes 20
existing risk-prioritized browser suites (44 tests). Linear titles identify
requirements; they do not establish implemented behavior. Unmapped features
retain null routes, missing screenshots/receipts and explicit audit gaps.
Mapped tests are supporting regressions, not full acceptance of the feature in
their title. The order in inventory.js prioritizes stale results, replay identity,
resource lifetime, navigation and accessible interaction.

From the repository root:

```sh
bun test test/regression-gallery.test.js
bunx playwright test --config test/regression-gallery.browser.config.js --list --reporter=list
HBL_STARTUP_SMOKE_PORT=39967 bunx playwright test --config test/regression-gallery.browser.config.js
```

Chromium and dependencies must be installed. The server uses disposable stores
and disables Bun's .env loading, rejects reuse of another server, and honors
HBL_BUN_EXECUTABLE and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. The installed user Bun
binary avoids an uninitialized node_modules Bun shim. Never point this suite at
production. Tests retain their existing native versus component fixture boundaries.
Some selected tests use deliberate synthetic source records or intercepted APIs;
their assertions do not prove production services or rights enforcement.

Open test-results/regression-gallery/index.html. Its receipts.json binds observations
to a Git revision and SHA-256 of actual implementation/test inputs, including
untracked code. Screenshot and existing JSON attachment bytes have hashes.
Expected assertion failures, launch failures, skips, missing screenshots,
changed source and incomplete test counts never satisfy the selected-path gate.
Filtered runs remain incomplete. Adding/removing tests requires reviewing
expectedTests as well as the inventory; never reduce counts to hide failures.
Feature acceptance remains unverified even when all selected assertions pass.

The wrapper registers additional hooks without changing the imported suites:
uncaught exceptions and console errors fail; expected HTTP failures stay in the
redacted error receipt. Ready Future Machine frames, scene and committed month
must agree. Canvas2D pixel samples must show drawn content. Blank WebGL/WebGPU
output, all leaked JS objects, device certification and all 100 feature interactions
are not certified by that check. Lifecycle/GPU/resize suites supply their own
specific assertions and receipts. A screenshot alone is not visual-diff approval.

No sharing, telemetry, invitation, publication or upload is added. Artifacts stay
local and use synthetic scenarios; remove test-results/regression-gallery to delete
them. Review screenshots before sharing them manually. Source redaction does not
make arbitrary screenshots safe for publication. Existing model data, seeds,
versions, provenance and assumptions are reused; there is no new model or ODD change.
Read docs/reviews/SHE-786.md for actual checks, remaining coverage and host blockers.
