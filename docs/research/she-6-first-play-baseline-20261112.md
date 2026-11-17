# SHE-6 — first-play baseline, 2026-11-12

Issue: https://linear.app/shel-bernstein/issue/SHE-6/hbl-w1-001-record-an-honest-baseline-of-the-live-first-play-journey

Status: source/test baseline complete; deployed browser journey **unverified** because the browser host and network access were unavailable. This is a partial research result, not evidence that production is broken or acceptance is complete. No application code, deployment, production data, simulation contracts or Linear dispatch gates were changed.

## Scope and identity

This manually requested audit owns only this new report. Initial working tree was clean and the report path was unused. Existing implementation-plan and coordinator files remain untouched to avoid shared ownership. No agents or scheduler jobs were dispatched. Read product design, affected Future Machine documentation, implementation-plan context, source and tests; no `docs/architecture.md` exists in this checkout.

Recorded at 2026-11-12T20:09:21Z, environment Darwin arm64, Bun 1.4.2 (744846f84). No actual browser/version, viewport, device emulation or physical device could be established. Do not substitute historical browser metadata for this run.

| Surface | Revision / verification boundary |
| --- | --- |
| Audited checkout `mini/SHE-6` | `b963dd353538294cb0fbf5d34d5283fad6e10e68` |
| Local sprint `sprint/one-city-two-futures-20261111` | Same SHA as audited checkout |
| Local main | `bb3b1588c2e5b78d92a34f117b52704bcc2ade84` |
| Cached origin/main | `dfb88332f15260b05af5bc434e6d9c79fbff3c69`; not freshly fetched |
| Deployed `https://happybearlandia.fly.dev/` | Application revision and release not established in this audit |

Main and sprint are distinct. `git diff main --stat -- index.html world/future-machine test/e2e/future-machine-share-reliability.e2e.js` reports eight changed paths, 140 insertions and 116 deletions. No inference about live deployment follows from either branch. No commit or PR was created for this report.

## Annotated journey

These are reproducible next browser steps derived from current source, **not completed live interactions**. Live step durations are unavailable, not zero.

| Step | Exact action / source expectation | Current observation and evidence |
| --- | --- | --- |
| 1. Homepage | Open `https://happybearlandia.fly.dev/` | Browser tool returned `The browser access host is unavailable` (tool wall time 4.436s). Web open returned inaccessible. Curl DNS failure below. No rendered homepage observed. |
| 2. Play Demo | Click `Play Demo`; source `index.html:71` targets `/world/future-machine.html?demo=1` | `main.js` dispatches `playDemo()` for `demo=1`, runs the default pair, then starts the guided director. Live navigation, loading time and tour unverified. |
| 3. Policy | Inspect Plan and seed controls; run housing proposal with `Fork City`; select Months 0, 16 and 120 | Source recipe is seed 42, 30 households, 120 months, housing in `d1`, amount 24, cost 1,000,000 illustrative USD, delay 0, compliance 1. Local tests confirm matched Month 0, first physical divergence at 16 and +24 homes. Live control responsiveness and disclosures unverified. |
| 4. Inspect/reverse | Inspect a changed building/WHY, scrub 16→0→120 | Local reverse-scrub tests pass for inventory, exact IDs and camera/scale. This does not establish rendered inspector freshness in production. |
| 5. Share/replay | At Month 120 choose `Share comparison`, open `Open comparison link`, refresh; retain `fm`, experiment and month from actual generated URL | Source retains versioned recipe, saved experiment and selected month; clipboard failure leaves a copyable link. Local recipe roundtrip and regenerated histories pass. No real live URL, run ID, saved record, clipboard result or replay duration obtained. |
| 6. Failure paths | On isolated test data, exercise missing saved record, malformed recipe/model and a no-intervention control | Existing browser tests cover disclosed recomputation, explicit invalid/mismatched links, retry and boundary seeds 0/4294967295. Inspected only; not rerun here. Do not delete production records to test fallback. |

The attempted default seed is **42 by source**, not an observed live seed. No new live simulation result was produced. The local model is `city-systems.1.0.0`, recipe schema `future-machine.v1`. Synthetic scenario assumptions include zero private capacity, utility capacity 200 and zero annual growth. Expected 36 baseline / 60 plan homes and 1,000,000 illustrative USD spending are model outcomes, not forecasts or real-parcel observations. Replay recomputes history from a manifest; it does not independently prove stored-checkpoint equivalence.

## Actual commands and results

Executed from repository root:

```sh
curl --max-time 20 -sS -L -o /private/tmp/she6-home.html -w 'status=%{http_code} total=%{time_total} remote=%{remote_ip}\n' https://happybearlandia.fly.dev/
```

Result: curl error 6, `Could not resolve host: happybearlandia.fly.dev`; `status=000 total=0.001311 remote=`. This is a failed request, not an HTTP status or site load timing. No homepage response or screenshot was captured.

```sh
bun test test/future-machine-share.test.js test/future-machine-data.test.js test/future-machine-diff.test.js test/two-futures-demo-controller.test.js test/future-machine-scrub-identity.test.js
```

Result: **27 passed, 0 failed, 393 assertions, five files, 5.07s**, exit 0. Actual local instrumentation printed 258ms for a preset pair, 17,060,382 JSON bytes and 970ms for a persisted API pair plus replay. These are local test timings, not browser/network performance. Tests exercise a real monthly engine and local API adapter; they do not verify deployed services.

No app code changed, so lint/typecheck and a full repository test run were not required. Package scripts define no lint/typecheck command. Playwright was skipped because browser setup was unavailable; a local-server rehearsal would not satisfy the live baseline. Final `git diff --check` is recorded in the delivery response.

## Existing work and overlap

- `test/e2e/demo-followup.e2e.js` already checks homepage Play Demo, matched start, physical Month 16 and browser/backend diagnostics.
- `test/e2e/future-machine.e2e.js` already covers fork/run/scrub/inspect/share/refresh, invalid URLs, missing records/replay, narrow viewport, no-WebGL fallback and mismatched recipes.
- `test/e2e/future-machine-share-reliability.e2e.js` adds actual saved replay identity/history, disclosed fallback, corruption/model mismatch, ordinary retry and boundary-seed zero-control shares.
- `docs/reviews/demo-proof-audit-20261111.md` records earlier browser artifacts and an initially stale reverse inspector. Its coordinator-resolution section says the defect was fixed and final evidence recorded. Treat that as historical reported evidence, not a newly reproduced defect or a fresh pass.
- `docs/future-machine.md` and `docs/demo-evidence-manifest.json` already describe prior local verification/artifacts. This report does not relabel those artifacts as production evidence.

## Remaining work

No application defect was reproduced live. The only newly observed broken steps are audit infrastructure access failures before the homepage could be viewed. Acceptance remains incomplete until an accessible browser performs the table above against the deployed site. Record UTC time, exact browser/version, OS/device/viewport, live revision if exposed, generated seed/recipe/run identity, per-step timings, screenshots and errors. Compare current live asset identity with the sprint and freshly verified main before assigning fixes. Preserve generated run evidence and clearly label recomputation. Retest share in a fresh context and record whether it loads a saved pair or falls back to a new run. No dispatch label, Done transition, merge or deploy is implied by this report.

## Follow-up verification — 2026-11-12T20:20:05Z

This report already existed as an untracked file when this follow-up began; its earlier observations above were preserved, not independently reattributed. The full SHE-6 description was retrieved from Linear and still reports Backlog. No issue status, label, dispatch gate or external message was changed. This follow-up owns only this appended evidence; application source and the shared implementation plan remain untouched.

Rechecked branch `mini/SHE-6`, HEAD, local main and cached origin/main: all identities remain as recorded above. Origin/main was not fetched and the deployed revision remains unknown. Source inspection confirms the homepage Play Demo route and main controller's `demo=1` entry, clipboard fallback, and explicit saved-record recomputation disclosure. Existing share-reliability browser tests already cover saved replay, missing records, malformed recipes and boundary seeds; those browser tests were inspected, not executed.

- `cua.createBrowserTab("iab", "https://happybearlandia.fly.dev/", { visible: true })` returned `The browser access host is unavailable` in 1.3221s. No browser/version, viewport, device, screenshot or live seed was established.
- Repeated the curl command above with output `/private/tmp/she6-home-recheck.html`: exit 6, `Could not resolve host: happybearlandia.fly.dev`; `status=000 total=0.000035 remote=`. This cannot establish a production outage or page latency.
- Repeated the exact five-file Bun command above: **27 passed, 0 failed, 393 assertions, 4.99s**, exit 0, Bun 1.4.2 (744846f84). Local instrumentation reported 243ms preset pair, 17,060,382 JSON bytes, and 939ms persisted API pair plus replay. These remain local synthetic-model measurements.

The acceptance gap is unchanged: the annotated live homepage → Play Demo → policy → share/replay journey requires a functioning browser host and network access. No new live defect or live success is claimed. No commit, PR, deployment or main merge was performed.
