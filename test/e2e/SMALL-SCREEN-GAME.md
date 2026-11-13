# Small-screen flagship visual pack (SHE-122)

Run from the repository root with installed dependencies and Playwright Chromium:

```sh
bunx playwright test --config test/small-screen-game.browser.config.js
```

The first baseline generation requires an explicit review:

```sh
bunx playwright test --config test/small-screen-game.browser.config.js --update-snapshots
```

Review all twelve images before committing generated baselines. Keep the same OS,
fonts and Playwright browser build for updates and comparisons. Baselines are
platform-qualified and comparisons allow zero changed pixels. Missing baselines
fail the normal command; do not treat an update run as regression verification.
Set `HBL_BUN_EXECUTABLE` for a Bun installation outside `~/.bun/bin/bun`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an alternate browser, or
`HBL_SMALL_SCREEN_PORT` if the default isolated port 39978 is occupied.

Three touch-enabled sizes (320×640, 390×844, 768×1024) follow the homepage Play
Demo entry, pause the actual seed-42 run, and select Month 16. Region snapshots
cover configuration selectors, timeline, the WHY inspector and share actions.
The existing flagship uses inline regions and native selectors rather than
custom menu/share dialogs. Pointer actionability, viewport bounds, minimum
24 CSS-pixel targets (checkbox label included), and center-point hit tests check
for blocked controls. The saved share URL is opened and its month and measured
outcomes are compared. Real model/version/recipe/run provenance is attached to
each test. Canvas rendering and reduced motion avoid GPU-dependent pixel noise;
this does not certify native GPU rendering or physical-device touch behavior.

Current status: spec discovery succeeds (3 tests). Browser execution is blocked
at server startup in this workspace: Bun reports EADDRINUSE on both 39931 and
39978. No baselines have been generated or visually approved. Zero blocked
controls and screenshot acceptance remain unverified until the update, image
review and normal comparison run complete on a host that permits the server.

SHE-263 extends this config with `world-hud.e2e.js`: `/world?renderer=webgl`
at 320×640, 390×844, 768×1024, 1280×784, 1520×784 and 1920×1080. It dismisses
the initial Start here sheet, checks launcher hit targets and measured viewport
bounds, exercises both numbered explorer actions, asserts pill/dismiss behavior,
and checks Storm preserves the World controls scroll offset. Each test attaches
actual measured HUD rectangles. Screenshots cover the expanded and collapsed
explorer; the scene and volatile playback/status outputs are masked. This does
not substitute Canvas2D for the main World integration. No new World baselines
are generated or approved in this workspace: server startup fails with
EADDRINUSE before browser launch. Run with `--grep 'World HUD' --update-snapshots`,
review all twelve images, then run without snapshot updates to verify.
