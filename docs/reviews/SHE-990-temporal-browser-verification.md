# SHE-990 temporal recovery browser verification

Verified against freshly fetched `origin/main` at
`c3ec93c5719c04bb596f2958d499a1c767da61a4` in an isolated worktree on November 17,
2026. The initial runs used Playwright’s default Chromium headless shell.
No runtime or vendor code changed. The new integration tests retain strict
uncaught JavaScript error checks; renderer errors remain failures.

The reusable config now selects `channel: 'chromium'`, matching the full
Chromium backend used by the startup checks. It retains the complete uncaught
JavaScript error assertion and additionally asserts that GPU console errors
are empty using the startup suite’s detector. Browser backend selection does
not suppress or filter the earlier failures.

The normal-entry cases open the issue's exact canonical `/world` URL, click
**Time → Open Time Machine**, and use the rendered controls. Historical HTTP
responses are controlled verification fixtures, not live Overpass observations.
The existing module fixtures remain separate from normal-entry acceptance.

| Check | Initial headless-shell run | Quiet headless-shell recheck | Full Chromium |
| --- | --- | --- | --- |
| Canonical World: failed fetch → retry → loaded evidence → later HTTP failure retaining snapshot → successful retry | Failed: three uncaught GPU errors after all flow assertions completed | Failed: three uncaught GPU errors after all flow assertions completed | Passed; zero JavaScript and GPU console errors |
| Canonical World: close aborts actual pending request → reopen → successful retry | Passed, no JavaScript errors | Failed: one uncaught GPU error after all flow assertions completed | Passed; zero JavaScript and GPU console errors |
| Existing module recovery/evidence/control fixture | Passed | Not rerun | Passed |
| Existing empty-state/cancellation module fixture | Passed | Not rerun | Passed |
| Browser API 404, non-JSON 502, malformed JSON and invalid payload; visible retries | Passed, no JavaScript errors | Not rerun | Passed; zero JavaScript and GPU console errors |
| Object-history network failure and visible retry; snapshot retained | Passed, no JavaScript errors | Not rerun | Passed; zero JavaScript and GPU console errors |

Initial browser run: **5 passed, 1 failed**, 6.0 seconds. Quiet headless-shell
recheck: **0 passed, 2 failed**, 4.6 seconds. The full Chromium run passed **all
six cases in 8.2 seconds**, with zero retries, skipped or flaky cases. Both
normal-entry cases and the two new error fixtures assert empty JavaScript and
GPU-console error arrays separately. The original two module fixtures remain
unchanged. All 27 focused temporal Bun tests passed with 102 assertions.
No error suppression, assertion weakening, app monkeypatches or vendor patches
were used. The browser backend was corrected to full Chromium; the earlier
headless-shell failures are retained as distinct results.

The failing traces record a WebGPU warning, “A valid external Instance reference
no longer exists,” then Three's “WebGPU Device Lost” console error with reason
`unknown`, followed by native `OperationError` page errors, “Instance dropped in
popErrorScope.” Native errors have empty call stacks and source locations.
Three's local `WebGPUPipelineUtils.js` lines 266 and 423 use
`device.popErrorScope().then(...)` without a rejection handler. The trace is
consistent with a renderer/device-loss rejection escaping from that path; an
exact originating JavaScript call is not established by the empty native stack.
It does not identify a temporal fetch failure. Full Chromium passes the same
normal-entry checks with both error assertions enabled. The headless-shell
renderer/device failure remains recorded and was not repaired or suppressed by
an application change.

Screenshots visually confirm meaningful failed-fetch guidance and the prior
snapshot plus selected-object evidence retained after a later source error.
Original results and traces are preserved locally in
`/private/tmp/hbl-temporal-main-evidence-initial`; the strict recheck is in
`/private/tmp/hbl-temporal-main-evidence-recheck`. The full Chromium result is in
`/private/tmp/hbl-temporal-main-evidence-full-chromium`. These runtime artifacts
are not committed. Public historical-source uptime and empirical geographic completeness
were not tested.

Reproduce with installed locked dependencies and Playwright Chromium:

```sh
bun --no-env-file scripts/verify-temporal-recovery.mjs
# Only the two normal-entry cases:
bun --no-env-file scripts/verify-temporal-recovery.mjs --grep 'normal World'
```

The runner binds the app itself on OS-assigned port 0 at `127.0.0.1`, discovers
the actual announced port, and passes that URL explicitly to Playwright workers.
It uses disposable stores, stops only its owned server/test processes, and
cleans its temporary store after completion. Actual port discovery and store
removal were verified through both `--list` and the completed full Chromium run. Artifacts default to
`test-results/temporal-recovery`; set `HBL_TEMPORAL_ARTIFACT_DIR` to retain them
elsewhere. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is optional. The runner performs
no source mutation, push, deployment or production-data write.
