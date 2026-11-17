# Native transition lifecycle bootstrap — November 17, 2026

Scope: isolated `codex/native-transition-repair-20261117`, stacked on Mini Symphony
PR #445 integration `19a6bbdd`. Owned changes: portal lifecycle bootstrap,
root/Future Machine script placement, focused browser regression and this record.
No simulation, rendering synchronization, performance threshold or assertion
retry changes.

## Diagnosis and bounded repair

The retained reliability matrix on the earlier #498 code recorded 6 passing and
2 failing profiles: bundled Chromium desktop and installed Chrome mobile emitted
`InvalidStateError: Transition was aborted because of invalid state.
ViewTransition opt-in disabled`. Browser launch succeeded; this was an application
navigation failure, not a startup crash. Integrated main already supplies early
inline opt-in in both documents. Its portal script still used `defer`, registering
native lifecycle handlers only when `document.readyState` was `interactive` and
the body existed.

[Chrome's cross-document transition guidance](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
requires registering `pagereveal` before the first rendering opportunity, using a
classic parser-blocking head script. Root and Future Machine now load portal.js
immediately after their inline opt-in, before external styles. Existing native
`ready`/`finished` cancellation observers therefore register while the document
is loading and before the body. DOM-dependent arrival target marking waits for
DOMContentLoaded. Native links, reduced-motion behavior, history and separate
navigation accessibility ownership remain intact. No global error suppression.

This proves a concrete lifecycle contract defect and repairs it. It does not
claim the previous intermittent error was caused exclusively by deferred
registration: main's earlier inline opt-in fix also changed that navigation path.

## Verification

Shared runner command:

```
bun scripts/run-symphony-browser-tests.mjs --config test/symphony-browser-runtime.config.js --engines chromium,installed-chrome,firefox,webkit --devices desktop,mobile --artifacts /private/tmp/hbl-native-transition-20261117
```

Result: **8/8 jobs passed, 16 tests passed, zero skipped, unexpected or flaky**.
Profiles: bundled Chromium, installed Google Chrome, Firefox and WebKit, each in
desktop and mobile emulation. Original normal-entry/keyboard/Fork City acceptance
remains unchanged. New regression delays the real portal.js network request,
asserts both lifecycle handlers register during head parsing, navigates by Enter,
exercises reduced-motion cancellation and Back, and requires zero page errors.

Artifacts: `/private/tmp/hbl-native-transition-20261117/run-zDvxBP/summary.json`.
Tests ran on the recorded base plus the four modified implementation/test files.

Negative control: restoring only `defer` in both documents makes the new test fail
on **both Chromium desktop and mobile** (0 pass, 2 fail). Actual registration was
`interactive`, body present, rather than `loading`, body absent. Fixed sources
were restored immediately. Artifacts:
`/private/tmp/hbl-native-transition-negative-control-20261117/run-gRj5Zz/summary.json`.
These expected negative-control failures are retained as failures, not acceptance.

Real iOS Safari and Android hardware remain untested; WebKit and mobile emulation
are not substitutes. No merge or deployment in this slice. Existing portal suite
results and final publication reference follow below.

Existing portal suite (Chromium desktop/mobile): **4 passed, 6 failed**, zero skips
or flaky tests. Both delayed-style launch/Back cases pass on both profiles. Three
cases per profile fail waiting for Future Machine's heading-focus marker after
navigation; the page renders, but the marker is not the active element. These are
real acceptance failures, retained without assertion changes. Artifacts:
`/private/tmp/hbl-native-portal-20261117/run-IsE3lU/summary.json`.

After the matrix, merged current #445 `dee3a44d` into this branch as `799309ab`;
that base adds startup wiring in World and integration evidence, with no portal
or Future Machine navigation changes. Combined latest-base verification belongs
to the coordinating agent. No claim that all release acceptance passes.

Baseline attribution: a separate clean checkout of `19a6bbdd` reproduced the same
unsupported-CSS heading-focus failure on Chromium desktop (0 pass, 1 fail,
30.3-second wait at portal.e2e.js:38). The working tree was clean; this failure
predates the bootstrap change. Baseline artifacts:
`/private/tmp/hbl-native-portal-baseline-20261117/run-TE5ekM/summary.json`.
Owner/next action: navigation accessibility owner must preserve or restore heading
focus after Future Machine replaces its boot DOM; coordinator must rerun portal
acceptance before release. The focused lifecycle repair can be reviewed separately.

Focused diagnostic establishes the focus mechanism, rather than a missed native
event: `window.hblNavigationAccessibility` is true; `pageshow` runs with `#boot`
present and correctly focuses its `h1[data-navigation-focus="heading"]`.
After `world/future-machine/main.js:66` calls `app.replaceChildren()`, that focused
heading is detached. Final active element is BODY, with no focus marker left,
while the status still says destination ready. The fix belongs to the asynchronous
application-ready/accessibility handoff, with recovery only when the heading was
detached and the user has not moved focus. Diagnostic artifacts:
`/private/tmp/hbl-native-focus-diagnostic/run-s25rmt/summary.json`. Temporary
instrumentation was removed; no production diagnostic hooks were added.

Published for review as [PR #503](https://github.com/adnanwahab/happybearlandia/pull/503),
stacked on #445. PR explicitly retains the focus acceptance blocker; no merge or
deployment performed.

## Follow-up: complete navigation lifecycle repair

The earlier blocker above is now implemented, retaining the failed attempts as
evidence. `navigation-accessibility.js` records the heading it focused, observes
subsequent focus changes, and accepts one explicit `hbl:document-ready` handoff.
It refocuses only when that original heading is detached, BODY is active, and no
other focus target intervened. There is no MutationObserver or polling loop.
Future Machine dispatches the handoff immediately after mounting its real UI;
its visible import-failure UI dispatches the same handoff. Active inputs and
subsequent user focus are preserved. Back also retains a unique portal ID as a
fallback when reconstructed links no longer have the runtime query parameters.

A separate native promise-identity diagnostic reproduced the opt-in error even
with early listeners: on reduced-motion Back, home `pagereveal` exposes no native
transition at 269.4ms, then rejects at 278.1ms. The rejection matches none of the
exposed `ready`, `finished` or `updateCallbackDone` promises. The portal's own
head-time `navigation:none` injection aborted incoming capture before the event
could expose it. Keeping opt-in stable and using existing CSS animation suppression
plus `skipTransition()` removes the error in the identical diagnostic (1 pass).
No error/rejection handler calls preventDefault and no global catch was added.
Failed diagnostic: `/private/tmp/hbl-native-promise-identity-20261117/run-SEHLZ9/summary.json`.
Fixed diagnostic: `/private/tmp/hbl-native-promise-fixed-20261117/run-Bo9ZOc/summary.json`.
Temporary diagnostic instrumentation was removed.

The original portal URL assertion exposed irrelevant context-key reordering.
It now checks exact origin, pathname and hash, plus every query key/value using
stable key sorting: duplicate values retain their order, extra/missing entries
still fail. Product URL serialization is unchanged. Focus, error-free navigation,
reduced motion, exact query values and Back assertions remain required.

New real-browser regression delays the actual application module, focuses a user
input during the boot screen, then confirms the input stays focused when the real
UI mounts. It also forces an actual module failure and requires visible error UI
and recovered heading focus. Unit/navigation contracts: **13 passed, 60 assertions**
with happy-dom explicitly enabled; no optional DOM tests skipped.
