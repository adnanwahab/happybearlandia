# SHE-789 UI and resident-play status

## Delivered behavior

Normal `/world` has a progressive charcoal/slate shell, serif headings, sans-serif body text, pill buttons, desktop left navigation and a right inspector. Mobile navigation scrolls horizontally, retaining access to Tiles, Search, More tools and Session logs. Specialized embedded/business/living entry flows retain their existing roles.

The initial screen has21named primary buttons. Start here/Activity, mood/seed and FPS share a measured vertical status lane, so all3widget groups remain visible and clickable. Inspectors and command cards begin below that lane. Start here invokes the same working modern action as Get started; it does not open the suppressed legacy guide. Advanced law, Constitution diff, city diff radar, character-continuity, culture, weather, challenge and worker launchers are collected under More tools rather than independently overlapping the map.

- **Resident play:** select a real modeled resident, choose Play as resident, click ground to request an authoritative walking trip, or use WASD for bounded six-metre world-axis trip requests. Model validation, routing, time and refusal behavior remain authoritative. Existing Follow controls provide the camera behavior. Commands occupy a stable card outside the inspector's frequently replaced observation DOM.
- **People:** the panel opens even before the first population observation arrives and fills automatically on the existing one-second shell refresh. It reads the cheap current source frame, preserves search/focus, and only rebuilds changed displayed IDs/names/activities/query. It does not repeatedly clone the full activity snapshot. Closing the old sheet precedes resident selection, preserving the actual visible, non-inert needs/home/work inspector.
- **Dialogue:** four choices expose current activity/needs, actual home/work, an observation-derived help request and retained history. Missing facts are labelled missing; biography is not invented.
- **Quests:** food/hunger, energy, social or fun below30/100 can yield an explicit synthetic recovery objective of50. The tracker observes actual need changes, invalidates changed runs, and reports missing residents as unknown. It invents neither rewards nor simulation effects. Starter actions expose resident inspection, real activity history and paired weekly policy comparison.
- **Legends:** selected-person retained actor events include run identity and retention limits; missing earlier records are not reconstructed.
- **Keyboard/overlays:** Cmd/Ctrl-K searches actions, Escape dismisses sheets, Space pauses/resumes,1/2/4 set actual speed, and O cycles supported overlays. The active World supports none/flood/commute/journals/wellbeing. Rent/jobs/traffic are explicitly disabled with a missing-measure explanation rather than borrowing incompatible monthly-city outcomes.
- **Rendering/integration:** World requires WebGPU; fallback links and capability branches are removed. Tile view remains a2D presentation of the same active WebGPU world, using `hblWorldTileSource`. Parent-owned unified context, session recorder and tile-owned audio modules load through index.html. One shell Sound pill uses `createWorldAudio` from `launch-sound.js`; duplicate engines/controls are absent. Sound starts off and the shared engine owns movement observation, suspension and cleanup.

## Ownership and interfaces

UI-owned sources: `world/index.html`, `world/launch-shell.js`, `world/launch-shell.css`, `world/launch-gameplay.js`, `world/hud-status.js`, `world/people/person-command-menu.js`, their focused tests/configs, `test/e2e/world-hud.e2e.js` and its12goldens. Existing unrelated edits were preserved.

- `hblLaunchShell.open(action)`, `.close()`, `.getState()`.
- `hblPersonCommands.getActor()`, `.walkTo({x,z})`, `.getState().controlled`.
- `hbl:resident-dialogue` accepts `{person}` from actual observations.

Renderer, simulation, tile/context/recorder/audio implementations remain owned by their respective chats. Application source is frozen after the final widget/shortcut patch; subsequent changes here affected test setup and documentation only. All UI-owned browser processes have finished.

## Verification

- `bun test test/launch-gameplay.test.js test/person-commands.test.js`: **6passed,0failed,42assertions**; actual walking/checkpoint continuation, rejected-command nonmutation, observed requests, run/missing-data behavior and grounded dialogue.
- Source-owned desktop/mobile shell browser flow: **2passed**. Subsequent desktop run on39972 also passed, including People selection with visible/non-inert needs/home/work, actual walking/dialogue, shared audio control, FPS, direct pause, speeds, overlays, tile/law/build/activity navigation. These earlier runs precede the final21-control status-lane change.
- Strengthened production-module/CSS widget checks: **4passed**,390px/1680px, classic and modern shell. Every3widget groups is required visible, with async FPS mounting, pointer hit targets, viewport bounds and panel clearance.
- Final installed-Chrome157 HUD golden generation: **6passed**,320/390/768/1280/1520/1920px,21accessible/enabled/actionable controls, People search/filtering/row clickability/panel bounds/dismissal, initial-shell and People-panel screenshots, **zero pageerrors**.12goldens generated under `test/e2e/world-hud.e2e.js-snapshots/`.
- Final installed-Chrome no-update golden comparison: **6passed,0failed (38.2seconds)**, all12images matched and zero pageerrors. The async initial-People observation regression is prepared for the parent's combined run; it delays only presentation of actual observations and checks automatic fill plus preserved search/focus.

### Browser setup reconciliation

Cached HeadlessChrome153.0.8010.12 initially produced `OperationError: Instance dropped in popErrorScope` in4/6HUD cases during live startup, before clicks/screenshots/teardown. The exact browser-supplied stack was empty; timing is preserved in `artifacts/she-789/hud-gpu-error-timing.json`. These errors were not filtered. They did not reproduce in installed Chrome157: the complete six-case run passed with zero pageerrors. Treat the earlier cached-browser evidence separately from installed-Chrome acceptance.

`test/launch-shell-local.config.js` now explicitly honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; merely setting the environment variable was previously insufficient. Installed executable: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; trace headers confirm HeadlessChrome157.0.0.0. Playwright1.63.0 on macOS, actual renderer backend`webgpu`.

The HUD matcher also now explicitly inserts/removes temporary screenshot CSS: `toHaveScreenshot` supports `stylePath`, not `page.screenshot`'s inline `style`. Only the live canvas/FPS/clock/loading observations are hidden or masked; controls remain visible. Playback pauses the actual model to freeze People observations. No forced click, broad error filter or weakened pointer/visibility assertion was used.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' HBL_LAUNCH_TEST_URL=http://127.0.0.1:39972 playwright test --config test/world-hud-local.config.js
```

## Primary-control audit

`artifacts/she-789/visible-button-inventory.json` records labels/actions/disabled state. Tests reject unnamed or unaudited initial buttons and assert actual effects. Advanced tools remain an optional larger inventory, not an exhaustively clicked set of every historical module.

| Controls | Actual response |
| --- | --- |
| Get started, Start here shortcut | Actual resident selected/followed; command card and inspector visible |
| World | Existing World controls expand |
| People | Live observed resident list, search and identity selection |
| Build | Existing building tools expand |
| Laws | Choose a law dialog opens |
| Time | Playback/Time Machine sheet opens |
| Activity nav, Activity shortcut | Actual Activity history dashboard opens |
| Quests | Observed need requests and starter objectives |
| Legends | Retained selected-actor history query |
| Search | Action search, also Cmd/Ctrl-K |
| Tile view | Same-current-world tile map |
| Sound | Shared engine enable/disable, default off |
| More tools | Advanced controls and collected launchers |
| Pause/resume | Actual playback state toggles |
|1×,2×,4× | Actual simulation speed changes/resumes |
| Overlay | Next supported output selected |
| FPS | Meter visibility/aria-pressed toggles |

The two initial links are Home and Session logs.

## Remaining acceptance limits

1. Parent owns combined native-WebGPU/browser acceptance and final soak evidence. Responsive Chromium emulation does not prove physical-phone, old-laptop or Safari performance.
2. Need objectives are grounded in current observations; rent/flood quest-forge tasks require supported source authority. Parent owns above-person quest-marker rendering; monthly-city quests are not silently substituted for daily World state.
3. Building-specific legends and full lifetime records need retained model events. This slice exposes selected-person retained records and explicit missing history.
4. WASD requests bounded trips rather than continuous controller physics. Population may reject a new trip while already traveling; actual refusal remains visible.
5. Rent/jobs/traffic spatial overlays remain unavailable, visibly disabled and explained.

No deployment or production-data change was performed.
