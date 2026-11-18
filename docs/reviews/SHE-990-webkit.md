# SHE-990 WebKit and Safari compatibility evidence

Owned slice: shared sidewalk acceptance test helper, opt-in WebKit compatibility
configuration/test and exact SVG path click target in temporal integration tests.
Based on PR470 808897d1; isolated clone `/private/tmp/hbl-she990-webkit`.
Product, model, worker, thresholds and original Chromium assertions unchanged.
Root owns main integration, release gates and production workflow.

Acceptance: ordinary WebKit desktop/mobile can exercise supported routes and
non-GPU temporal controls; absent native WebGPU is explicitly recorded as blocked
resident acceptance rather than silently substituting a static geometry view.
Where a native adapter exists, the same complete sidewalk helper runs. The
Chromium mobile CDP gesture remains unchanged; WebKit mobile uses native touch
selection and keyboard camera pan because it lacks Chromium's CDP injection API.
That is not physical-device or WebKit touch-swipe validation.

Read docs/design.md, affected docs/implementation-plan.md section, existing
startup/sidewalk/temporal tests, world/renderer-entry.js, world/world-gpu.js and
World camera controls. Model/ODD behavior is unchanged: this slice moves test
code, adds coverage and aims native clicks at the painted SVG feature path.

## Capability and failure evidence

Installed Playwright WebKit2359 reports browser26.6. Secure-loopback probes on
both profiles show `isSecureContext:true`, `navigator.gpu:false`, adapter:false.
Ordinary World therefore follows its existing renderer-entry.js redirect to
`/world/static-city.html?...renderer=webgl2&viewReason=unavailable`. The UI says
"WebGL2 city view only · the simulation requires WebGPU" and explicitly states
there are no residents, simulation workers, time progression or gameplay here.
Both probes captured zero JavaScript/console errors. This is static compatibility,
not native resident acceptance or a WebGL simulation fallback.

Unchanged full-World startup tests were actually run in WebKit desktop/mobile:
**2 failed**,30.6s/30.5s. `#world-guide-button` was absent after the honest static
redirect. Original30s expectation retained. JSON receipt retained externally at
`/private/tmp/she990-webkit-native-startup-failures.json`; raw capability JSON and
screenshots in this clone's `test-results/webkit-capabilities.json` and
`test-results/webkit-{desktop,mobile}-world.png`.

Installed system Safari18.6 (20621.3.11.11.3) exists, but local safaridriver refused
one session with `session not created` and the exact message:
"Could not create a session: You must enable 'Allow remote automation' in the
Developer section of Safari Settings to control Safari via WebDriver."
No Safari preference changed. Owned safaridriver stopped. Receipt:
`/private/tmp/she990-safari-session-refusal.json`.

## Pointer target correction

Initial WebKit temporal integration found a real test action failure: the
authored fixture footprint has three vertices plus closure, a right triangle.
Its bounding-box center is exactly on the diagonal. WebKit pointer rounding
resolved that edge to the map background `<rect>`; normal `.click()` retried
until the120s test timeout on both desktop and mobile. Targeting the child
`<path>` alone was insufficient and that partial run was interrupted, not passed.

`clickPaintedFeature` now resolves an actual painted interior pixel using the
path's viewport bounds and `document.elementFromPoint`, then makes an ordinary
`.click({position})` on the same feature path. Integer viewport coordinates avoid
another roundoff onto the triangle boundary. No `force`, direct handler call,
fixture geometry change or removed assertions. Existing keyboard selection
coverage remains separate. This is a concrete pointer-target correction, not a
claim of a product interaction failure.

## Commands and final results

`HBL_WEBKIT_PORT=43205 bunx playwright test --config test/webkit-compat.browser.config.js`:
**20 passed,0 failed,0 skipped,10.6s.** This comprises five non-GPU startup routes,
four fixture temporal recovery cases and the explicit compatibility contract per
profile (desktop1440x1000/mobile390x844). Temporal integration pageerror/GPU arrays
empty; startup captures pageerrors only. The two compatibility reports explicitly
record `nativeResidentAcceptance:"blocked: native WebGPU unavailable"`,
`staticFallbackAcceptance:"passed; not resident acceptance"` and touch gesture
coverage not exercised. No full-World native WebKit acceptance pass is claimed.

For a WebKit environment that exposes a native adapter, the compatibility test
invokes the shared complete sidewalk acceptance helper. To also run unchanged
full-World startup/canonical temporal cases, use `HBL_WEBKIT_NATIVE=1` with the
same command; this does not reinterpret static fallback as native success. This
host's unchanged native startup result remains2failed, as recorded above.

Initial supported-route run before pointer correction:16passed,2failed,4.2min.
Receipts: `test-results/webkit-audit` and external
`/private/tmp/she990-webkit-temporal-initial-results.json`. Intermediate path-only
run:6passed,1interrupted,13notrun; retained at
`/private/tmp/she990-webkit-path-center-initial`. Final20case output and JSON:
`test-results/webkit-compat`. Syntax and `git diff --check` passed.

The root coordinator will rerun Chromium sidewalk and temporal acceptance after
integrating the shared-helper extraction. No product/model changes or thresholds
changed in this slice. No merge/deployment or native Safari/physical-mobile
acceptance claim is authorized by this compatibility record.

Remaining owners and next actions:

- WebKit native World: environment/browser owner must provide an exposed native
  WebGPU adapter, then rerun native mode and the same shared sidewalk assertions.
- Safari system browser: operator must explicitly enable remote automation before
  safaridriver coverage can run. Safari's WebGPU capability itself remains untested.
- Real desktop Safari/iOS/Android devices and WebKit mobile touch-swipe camera
  interaction remain release QA/device-owner work. Emulation is not device testing.
