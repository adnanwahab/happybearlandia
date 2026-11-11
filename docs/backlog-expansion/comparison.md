# Housing comparison track — tickets 87, 117, 119

## Slice and acceptance

Implement a stored-record adapter and simultaneous schematic housing views for the selected Decision Studio future and its exact same-seed baseline. Preserve model identity/version and month; distinguish missing snapshots from zero; use the same stock/height/vacancy scales on both sides. Reuse `storedMetricSnapshot` and `buildingDimensions` from the existing building renderer. Do not infer Population parcels or empirical vacancy. Shared Advanced Studio edits are coordinator-owned, so normal-entrypoint wiring remains an explicit integration dependency.

Owned files: `world/decision/backlog-comparison/model.js`, `world/decision/backlog-comparison/view.js`, `test/backlog-comparison.test.js`, this document. Base `1b19358`. Worktree `/Users/wahabma/.codex/worktrees/backlog-comparison/happybearlandia`.

## Delivered interfaces

`pairedHousingScene({results,selectedRun,month})` reads existing full Decision results. Returns availability/reason, exact arm records with provenance, common whole-history supply maximum, vacancy domain 0–100 percent, and selected-minus-baseline supply difference. Only housing.v1 versions 1.0.0/1.1.0/1.2.0 and completed runs are supported. It never simulates or mutates the input. Missing exact months are unavailable, even if an earlier snapshot exists. Trace-summary-only results must first be hydrated through the existing selected-run trace path; otherwise the view displays missing records.

`mountHousingComparison(container,{onMonthChange,onInspect})` returns `{update(context),destroy()}`. Context is `{results,selectedRun,month?}`. One SVG viewBox contains both arms; no independent cameras or render loops. Aggregate stock is a homes bar, vacancy a percent bar, and recorded construction appears in stable project-ID slots. Exact recorded floors determine construction height on a shared physical height scale. Shapes are schematic, not geographic buildings. First 12 lexicographically sorted project IDs are displayed; aggregate metrics still include all projects and the bound is disclosed. Project click/Enter/Space emits `{runId,projectId,month,state}`. Identity remains scoped to that housing run. The UI labels the model as exploratory and explicitly disclaims parcel vacancy and empirical calibration.

## Exact coordinator integration

In `world/decision/advanced-studio.js`:

```js
import { mountHousingComparison } from './backlog-comparison/view.js';
```

Add `<section data-as-housing-comparison></section>` after the median details in `root.innerHTML`. After constructing robustness/intelligence/exploration:

```js
const housingComparison = mountHousingComparison(find('[data-as-housing-comparison]'));
```

At the end of `update(next)` after `renderShortcuts()`:

```js
housingComparison.update({results: currentResults(), selectedRun: currentRun()});
```

In `destroy()` call `housingComparison.destroy()` alongside the existing sibling destruction. This uses stored experiment scenarios, never pending input scenarios. Its own month control synchronizes both halves. To synchronize with another host timeline, pass `onMonthChange` and update with an explicit month; do not map a Population or City clock into it. Optional onInspect must open exact run/project/month evidence rather than a cross-model inspector.

## Ready-to-apply status section

| Historical ticket | Implemented | Verified | Remaining |
| --- | --- | --- | --- |
| 87 Scenario overlays | Paired simultaneous schematic housing scenes, same stored seed/month and fixed viewBox/scales | Actual housing-engine zero/nonzero and reverse data tests; browser bundle | Coordinator wires Advanced Studio, then actual browser acceptance/screenshots |
| 117 Housing supply reflected in buildings | Recorded aggregate stock displayed separately from exact recorded project construction; no illustrative stock-to-context-building inflation | Exact supply and construction state assertions at months 0/120, stable scale on reverse | Normal-entrypoint browser check; geographic building stock unavailable in this model |
| 119 Vacancy represented visually | Exact recorded aggregate vacancy percent bar, common 0–100 scale, missing neutral | Zero versus missing assertions and missing-month test | Normal-entrypoint browser check; parcel vacancy remains unsupported |

Verification: `bun test test/backlog-comparison.test.js test/housing-model.test.js test/housing-fork.test.js test/advanced-studio.test.js`: **39 pass, 0 fail, 2520 assertions**. `bun build world/decision/backlog-comparison/view.js --target browser --external /vendor/three/three.module.js --outfile /tmp/backlog-comparison-view.js`: **pass**, 4 modules. Vendor import is served by the existing app; a bundle without that external flag cannot resolve its absolute browser URL. `git diff --check`: pass. No new dependencies. Tests use generated synthetic housing scenarios to validate mechanics, not empirical calibration.

No screenshots or browser acceptance are claimed: shared normal-entrypoint wiring is deliberately left to the integration owner. Coordinator should run actual stored experiment → selected plan → comparison at month 0/120 → reverse 0, keyboard project inspection, missing trace path, and narrow viewport inspection. This track does not alter Future Machine, global plans/backlogs, server, or original checkout.
