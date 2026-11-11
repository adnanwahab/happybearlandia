# Methodology track handoff

Owned module: world/decision/backlog-methodology/report.js. No dependencies or shared contracts changed.

Integration: import { mountMethodology } from './decision/backlog-methodology/report.js' in the decision page entrypoint (adjust relative path). Add a dedicated methodology navigation target and container, then call mountMethodology(container, existingBacktestResult) after the existing uploaded backtest or published diagnostic completes. This consumes the same result, never reruns or recalibrates it. methodologyReport(result) also supplies a structured export. Coordinator owns route and navigation wiring.

Ready-to-apply status: 160 and 161 have reusable combined methodology/limitations content and safe mount; standalone route/navigation remains pending integration. 162 retains existing cutoff-safe uploaded evaluation and source-backed Houston diagnostic, with fit/holdout separately reported; verified blind empirical default remains unsupported. 163 preserves observed values, errors and simulated ensemble ranges from existing results, with explicit non-forecast-band language. 164 exposes existing calibration audit, parameters and fit metadata without inventing missing fields or empirical validity. All five remain Partial until route integration and any unmet historical acceptance evidence are resolved.

Evidence: inspected existing backtest adapter and Houston history lineage. Houston uses published ACS five-year estimates with overlapping periods; its cutoff follows the indexed target period, so it remains retrospective. No new observations added. Missing model version, evaluation count or calibration audit stays null rather than inferred. No claim of empirical calibration or policy validity.

Verification: bun test ./test/backlog-methodology.test.js: 2 passed, 9 assertions. Actual published diagnostic generated with three runs and seed 72 checks source retention, classification, metric identity and unknown metadata. Synthetic markup case checks safe rendering only. Browser acceptance/screenshots pending shared entrypoint wiring; no browser behavior claimed. No global backlog or implementation plan changed by ownership rule. No architecture.md exists in baseline.

Scope/limits: fit metadata and per-metric coverage/errors are presented directly; no aggregate cross-unit RMSE, interval calibration, or hidden fitting. Coordinator should mount and smoke-test through normal navigation. Original checkout untouched.
