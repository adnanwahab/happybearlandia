# Local main / demo sprint divergence audit — 2026-11-11

Read-only source audit; no merge, rebase, branch mutation, production edit, browser run, or deployment. Only this report is added. The original coordinator checkout has unrelated uncommitted integration work; comparisons below use pinned committed objects, not its working tree.

## Exact comparison

- Local `main` and `origin/main`: `78c3c51` (no fetch or claim about current GitHub state).
- Sprint: `a8973b1` on `sprint/one-city-two-futures-20261111`.
- Merge base: `ac3f503987eb9b9c6474b7f2ccc535ad9dd38806`.
- `git rev-list --left-right --count main...sprint/one-city-two-futures-20261111`: **50 main-only / 33 sprint-only commits**. These counts include merge commits, not 83 independent features.
- Main changes 28 paths relative to the base; sprint changes 114. Nine paths changed on both sides: `docs/implementation-plan.md`, `index.html`, `world/first-run-guide.{css,js}`, `world/index.html`, `world/reality/studio.js`, `world/render.js`, `world/universe/{registry,shell}.js`.

## Changes to preserve or explicitly reconcile

| Priority | Main evidence / paths | Sprint difference and concrete integration risk |
| --- | --- | --- |
| High | `765791f`: `routes.html` imports `EXPERIENCES`, generates cards, filters and counts. | Sprint still has 23 hardcoded workspace cards. Preserve canonical generation while retaining flagship entry; homepage count tests alone miss `/routes`. |
| High | `da7422f`, `592ed3e`, `4390e43`: `world/bar/houston-catalog.js`, `world/bars/app.js`, `world/bars/index.html`, `world/bars/scene.js`, `server.js`, exported `queryOverpass` in `world/api.js`. | Sprint lacks venue endpoint, slash route and atlas files. Preserve existing `/api/houston-bars` and `/world/bars/` behavior if reconciling with main; this does not authorize expanding the demo. Copying only the registry entry creates a broken route; copying only handler without the Overpass export breaks imports. |
| High | `3eec503`, `8f0e16b`, `aeb138b`: `world/universe/connected-navigation.js` has an expandable bottom-right handle with hidden links and updated browser interaction. | Sprint retains always-visible bottom-left links at z-index 10000. Existing mobile Pause checks cover selected controls, not preservation of the compact navigation contract across all apps. Retain expand/collapse/context behavior and reconcile panel suppression CSS. |
| High | `1628ad3` through `cf94774`: `world/renderer-entry.js`, `world/canvas2d-world.js`, `world/index.html`. Entry accepts `canvas2d`, `lite`, `2d`, offers a visible mode switch, and can fall back after full renderer import rejection without importing Three in its CPU lane. | Sprint's `world/render/renderer/canvas-renderer.js` projects the same Three scene and preserves the normal runtime; it is an alternate implementation, not an equivalent file rename. Preserve explicit aliases/link and module-load failure handling where needed; do not run both startups. Main CPU mode also has a separately labeled simplified storm rule, so do not claim cross-backend outcome equivalence without testing. |
| High | `598b544`: `world/render.js`, `world/index.html` permit local presets once the scene is ready while optional remote plans load. | Sprint's startup restore still disables policy/run/demo controls while `policyPending`. Preserve nonblocking local play; frozen-reality ordering is a separate case and must remain frozen. |
| Medium | `46e8816`, `7b9db33`, `00dc2a9`: `world/activity-dashboard.js` exposes `isOpen()` and `world-activity-dashboard` ID; render button toggles an already open dashboard. | Sprint opens unconditionally and uses its one-sheet manager. Preserve toggle/accessibility behavior without losing manager ownership, loading feedback, real filtering or new seed export. |
| Medium | `5f9a3e2`, `17eadbb`, `bcbf243`: standalone `world/model-provenance-loader.js` runs independently of renderer import. | Sprint starts definitions before GPU initialization, but inside `render.js`; total module import failure has different behavior. Keep one metadata owner and explicit failure reporting; don't duplicate loaders that overwrite configured values. |
| Medium | `158021b`, `891ad67`: `world/reality/results-interpretation.js` identifies up to three common missed policy targets from actual test records. | Sprint's `outcome-feedback.js` explains nonpassing versus errors and adds disabled reasons, but drops the common-target interpretation. Combine useful recorded-test detail with current truthful summary rather than reverting either whole `studio.js`. |
| Medium | PR10 first-run changes and `.github/workflows/core-journeys.yml`: storage-safe guide, compact/minimized result feedback, unit/browser CI steps. `world/index.html` also has mood meter semantics and advanced-settings disclosure. | Sprint uses an independently integrated guide/controller API and different selectors. Main guide auto-mounts and listens for events; sprint imports a factory. Copying both mounts duplicates handlers/UI. Port relevant storage/accessibility behavior and reconcile CI with actual retained tests. |

Catalog check: both refs contain **31 unique IDs**, but they are different sets. Main-only ID is `houston-bars`; sprint-only ID is `future-machine`. Union is **32**, with `houston-map` shared. Do not preserve a literal count of 31 by removing an existing experience; derive counts across gallery, shell and `/routes` after an approved reconciliation.

## PR11 / PR12 duplication

`2ead54e` is the PR11 merge, parents `6dd2dd9` and `4390e43`; it already includes the first-run/routes/bars/lite series above. Do not apply that series again as new work merely because its SHAs are main-only.

`78c3c51` is the PR12 merge, parents `2ead54e` and **`ac3f503`**, the common base. Sprint descends from the Future Machine side and separately includes integration `6c3330f`, then the flagship sprint. PR12's merge resolution adds entry/integration/storage glue; it is not evidence that the advanced sprint is already merged. Exact object checks show `world/future-machine/contracts.js`, `fly.toml`, and `docs/future-machine-storage.md` identical between audited tips. `INTERFACES.md` differs; sprint also adds backup permission hardening in `scripts/backup-future-machine.js`. Preserve these rather than replaying older integration glue over the new flagship.

## Evidence and next action

Commands: `git log sprint..main`, `git log --left-right --cherry-mark main...sprint`, `git merge-base`, `git rev-list --left-right --count`, path-scoped `git diff main sprint`, `git show` of the cited commits/files, exact blob-ID comparisons, and registry-ID extraction. The differences are static source observations, not browser acceptance results or a conflict-resolution rehearsal. No production files were changed and no tests were necessary for this report.

Next: coordinator selects preservation decisions and a separately authorized integration approach; verify `/routes`, atlas route/API, compact navigation, Activity toggle/export, local-play readiness, explicit CPU aliases, import-failure behavior and canonical flagship journey together. No merge is performed or requested by this audit.
