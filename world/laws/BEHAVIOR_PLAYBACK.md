# Recorded law behavior playback

This is the first reviewed-model slice of **choose law → edit a modeled lever → rerun → watch recorded synthetic behavior → revise again**, on the /world/constitution-city.html law panel. It does not replace the separately authored Constitution City scenario editor or synthesize a forecast from legal prose.

## Data authority

The playback reads compareLaw results from world/laws/comparison.js through the existing disposable comparison.worker.js.

- Both branches start from the same frozen initial synthetic state and use the same seed, model version, population, and exact horizon.
- Population runs retain at most 100 real sampled simulation checkpoints. Each checkpoint includes a bounded observational read of the first 12 stable, synthetic actor IDs: activity, mode, commute, district, employment, and model-local x/z coordinates.
- Monthly city runs sample 12 stable synthetic household records: district, assigned unit, recorded income/rent/savings and housing availability. These are not real residents or cadastral records.
- The viewer uses recorded samples, never screenshots, invented movement, filled missing points, speculative beneficiaries or a second renderer-based source of truth. Both views share time and coordinate axes.
- The selected aggregate metric always comes from each scenario's recorded metrics timeline, computed using the full modeled population rather than the 12 displayed actors.
- pairedLawFrames rejects unsupported, unpaired, or known-incomparable outcomes. When no tracked actors change, it reports that honestly rather than claiming a policy had no effects in the broader model.

## Editing scope

Only supported laws with reviewed numeric parameterFactors expose the 0–100% slider (25% increments):

- Law 83: synthetic transit-service index (baseline factor 1.0 to 1.5).
- Law 22: synthetic construction cost (baseline factor 1.0 to 0.9).
- Law 23: synthetic permit processing capacity (baseline factor 1.0 to 2.0, rounded by the existing city engine).

0% uses the current-rule factor; 100% uses the original reviewed illustrative proxy. Intermediate values interpolate that factor only, not legal text, eligibility, spending, public uptake or empirical effect sizes. Unsupported laws remain unavailable. Laws with fixed/discrete model mappings can run their existing reviewed comparison but do not expose a pretend continuous control.

The original 100% paired comparison is retained in panel memory when a user edits the lever. When the chosen metric and exact checkpoint are comparable, its originally modeled result is shown alongside the new result. Rerunning cancels/invalidates outstanding requests and hides stale charts immediately.

## Verification and handoff

Focused test files: test/law-behavior-playback.test.js (factor edits, deterministic matching, actor identity/time, household frames and refusal paths), plus existing test/laws.test.js, test/law-impact.test.js, test/law-mechanism-contract.test.js, test/law-visuals.test.js.

Local command:

    bun test --timeout 60000 test/law-behavior-playback.test.js test/laws.test.js test/law-impact.test.js test/law-mechanism-contract.test.js test/law-visuals.test.js

Human browser acceptance: Open Constitution City, choose law 83, inspect initial paired run, drag 100% to 50%, verify the selected transit-service config changes to 1.25 and the baseline remains at 1.0, watch tracked residents and recorded metrics over the scrubber, and verify the original 100% sample is retained. Choose law 21 (fixed upzone) and law 31 (unmodeled) to confirm no invented slider/forecast. Test 320px viewport, keyboard and reduced-motion mode.

This slice does not yet bring the worker data into Civic Synthesis's native /synth screen. Its prior freeze/deeplink handoff remains; embedded screenshots and cross-origin views are not replaced in that separate app by this patch. Next integration should define a versioned, permission-safe read-only paired-run receipt/API and render the same model timeline natively in Civic Synthesis, plus an explicit amendment-to-reviewed-parameter compiler and provenance inspector. Reuse existing snapshot IDs, seeds and source policy identity rather than passing private journal content or creating an arbitrary effects model.

## Known limitations

- Only 12 tracked synthetic actor identities are recorded at sampled times; this is neither random nor representative. Other people may change even when these actors do not.
- The scrubber moves between actual saved sample times, not every model tick. Chart lines visually join recorded points; actor trajectories between samples are not inferred.
- Mechanism contract metadata remains the reviewed 100% assumption. The run manifest separately pins the effective factor and implementation strength. This is a sensitivity experiment, not evidence of a revised legal text.
- These synthetic observations are not calibrated predictions of real-life wellbeing, fiscal impact, health, rights, political outcomes, or individual people.
- No production deployment, migration, calibration, new actor decision rule or automatic PR merge occurs in this slice.
