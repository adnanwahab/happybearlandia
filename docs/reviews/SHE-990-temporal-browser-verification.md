# SHE-990 temporal recovery browser verification

Verified against freshly fetched `origin/main` at
`c3ec93c5719c04bb596f2958d499a1c767da61a4` in an isolated worktree on November 17,
2026. No runtime or vendor code changed. The new integration tests retain strict
uncaught JavaScript error checks; renderer errors remain failures.

The normal-entry cases open the issue's exact canonical `/world` URL, click
**Time → Open Time Machine**, and use the rendered controls. Historical HTTP
responses are controlled verification fixtures, not live Overpass observations.
The existing module fixtures remain separate from normal-entry acceptance.

| Check | First run | Quiet normal-entry recheck |
| --- | --- | --- |
| Canonical World: failed fetch → retry → loaded evidence → later HTTP failure retaining snapshot → successful retry | Failed: three uncaught GPU errors after all flow assertions completed | Failed: three uncaught GPU errors after all flow assertions completed |
| Canonical World: close aborts actual pending request → reopen → successful retry | Passed, no JavaScript errors | Failed: one uncaught GPU error after all flow assertions completed |
| Existing module recovery/evidence/control fixture | Passed | Not rerun |
| Existing empty-state/cancellation module fixture | Passed | Not rerun |
| Browser API 404, non-JSON 502, malformed JSON and invalid payload; visible retries | Passed, no JavaScript errors | Not rerun |
| Object-history network failure and visible retry; snapshot retained | Passed, no JavaScript errors | Not rerun |

First browser run: **5 passed, 1 failed**, 6.0 seconds. Quiet recheck: **0 passed,
2 failed**, approximately 4 seconds. All 27 focused temporal Bun tests passed
with 102 assertions. No retries, filters, assertion weakening, app monkeypatches
or vendor patches were used to turn these failures into passes.

The failing traces record a WebGPU warning, “A valid external Instance reference
no longer exists,” then Three's “WebGPU Device Lost” console error with reason
`unknown`, followed by native `OperationError` page errors, “Instance dropped in
popErrorScope.” Native errors have empty call stacks and source locations.
Three's local `WebGPUPipelineUtils.js` lines 266 and 423 use
`device.popErrorScope().then(...)` without a rejection handler. The trace is
consistent with a renderer/device-loss rejection escaping from that path; an
exact originating JavaScript call is not established by the empty native stack.
It does not identify a temporal fetch failure. The uncaught errors still block
clean normal-entry acceptance and require a separate renderer/device diagnosis.

Screenshots visually confirm meaningful failed-fetch guidance and the prior
snapshot plus selected-object evidence retained after a later source error.
Original results and traces are preserved locally in
`/private/tmp/hbl-temporal-main-evidence-initial`; the strict recheck is in
`/private/tmp/hbl-temporal-main-evidence-recheck`. These runtime artifacts are not
committed. Public historical-source uptime and empirical geographic completeness
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
cleans its temporary store after completion. Artifacts default to
`test-results/temporal-recovery`; set `HBL_TEMPORAL_ARTIFACT_DIR` to retain them
elsewhere. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is optional. The runner performs
no source mutation, push, deployment or production-data write.
