# Tipping Point Atlas

Open `/world/laboratory/atlas/` to sweep construction capacity and baseline annual population growth with the existing monthly City engine. The quick, detailed and extended worker sweeps use 75, 405 and 2,023 runs respectively. They use the same consecutive seeds across all cells and report the number of completed runs. Larger sweeps can take several minutes. Cancel terminates the worker and retains completed cells for inspection.

The versioned baseline starts with three synthetic districts and six already-financed housing projects. The construction multiplier changes contractor, labor, material, and equipment capacity. Utility reserve still gates completions. The City engine adjusts the annual growth input using jobs and vacancy. The starting geometry, project pipeline, and outcome thresholds are model assumptions.

A cell shows the final-month majority housing class across seeds or a mixed result when no class has a majority. The Atlas compares mean unhoused shares across horizontally or vertically adjacent cells. These are finite-grid contrasts. Open a seed within a cell to reproduce its exact deterministic recipe and inspect district outcomes at any month. A shared URL records both model versions, the seed, parameters and selected month. The snapshot is recomputed by the monthly City model and has no persisted run ID or mapping to the separate real-geometry World renderer.

The shared exports in `model.js` provide `normalizeAtlasRecipe`, `createAtlasStart`, `summarizeAtlasMonth`, and `runAtlasSample`. The work runs locally in the browser with no server writes. Reproduce the model checks with `bun test test/tipping-point-atlas.test.js`.
