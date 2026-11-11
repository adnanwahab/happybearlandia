# Future Machine controls

`createUI(container, callbacks)` implements the frozen v1 interface. Load `ui/styles.css` in the coordinator's page. Mount the scene into `ui.stageElement` and the story into `ui.storyElement`. Call `ui.update` with partial coordinator state and `ui.dispose` on navigation. Rendering and the playback timer belong to the coordinator. Native range keyboard controls select the same Month 0–120 for both arms. The calendar is illustrative January 2026–January 2036.

The City selector exposes the one bounded synthetic generator permitted by v1. Policy choices are the supplied intervention or a null intervention for a matched unchanged control. No additional policy parameters or geometry are fabricated. Cards consume the diff's `housingUnits`, `meanTravelMinutes`, and `capitalSpending` fields, preserving units and unavailable values. The Commute card explicitly explains that this engine measurement is link travel time, not household commute time. Household JSON uses exact monthly City IDs and shows missing arms as null. The evidence inspector reports comparison counts; recorded causal details belong to the mounted story inspector.

The optional `callbacks.onCancel()` extension exposes Cancel run during loading. Without it the button stays hidden: the frozen coordinator interface has no cancellation callback, and hiding it avoids falsely promising cancellation. The coordinator must abort its request and settle its own state when using this extension. Progress is indeterminate unless an actual bounded fractional measurement is supplied; the UI never estimates simulation completion. Error text is live-announced; Fork City retries and clears it. Share/export are disabled until a frame is available. Shared URLs are restricted to HTTP(S).

`mountFutureMachineUI` is the lower-level view with optional self-contained playback, useful for isolated embedding. The exported `createUI` always delegates playback to the coordinator. Both factories create DOM only when called and clean up listeners/timers on disposal.

## Acceptance and verification

- `bun test test/future-machine-ui.test.js`: calendar endpoints, input bounds, zero/missing/nonfinite measurements, signed and zero deltas.
- `HBL_FM_BROWSER=1 bun test test/future-machine-ui.test.js` runs the committed Chromium test (with installed `@playwright/test`); `HBL_PLAYWRIGHT_MODULE` can point to an existing module installation. The full run passed 5 tests / 28 assertions.
- Chromium smoke exercised native range End to Month 120, delegated play/blink/director/share/export, Fork City, loading disablement, error announcement, unsafe share URL rejection, disposal, and 390px/1440px layouts with no horizontal overflow. This smoke used injected recorded-shape fixtures; it did not exercise the unfinished combined application or real API runs.
- Browser import and DOM construction defer all simulation work to callbacks. No third-party UI dependency, network request, server change, or production write is introduced.

Integration owner must include the stylesheet, mount the scene/story, and verify the full API journey. Add `onCancel` to coordinator composition if user-visible request cancellation is required. No shared contracts or implementation plan were edited here.
