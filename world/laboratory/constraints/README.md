# Constraint Detective

Open `/world/laboratory/constraints/` after recording a city run. The optional `runId` and `month` query parameters select a completed monthly City run and a retained checkpoint. With no month specified, the page selects the latest retained checkpoint with a matching event, if one exists.

The classifier uses only the source event types, systems and reasons that the monthly model retains. It recognizes construction resource, material, weather, permit, utility, and financing delays, administrative staffing and capital funding delays, utility shortfalls, and unreachable jobs. It keeps construction delays with unsupported reasons under “Unclassified delay” and links them to their source. Other event types and aggregate metrics supply no inferred findings.

Counts are counts of records in the selected month. Zero means no matching retained record. A missing run, checkpoint, or event feed is unavailable. Several records can describe different consequences of the same underlying condition. The page does not infer relative importance, a citywide dominant constraint, or causal effects from frequency. Links open the exact event in the causal inspector and Time Machine.
