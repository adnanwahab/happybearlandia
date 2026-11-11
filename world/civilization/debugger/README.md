# Reality Debugger

Open `/world/civilization/debugger/` to inspect a recorded monthly City checkpoint. The optional `runId` and `month` query parameters select a completed City run and an exact checkpoint. The default run is the seeded World demo. The default month is the latest compatible stored checkpoint.

The debugger uses the existing read-only causal endpoints. Replay verifies the checkpoint and may reject corrupt state before the debugger sees it. The page reports that rejection. For accepted state it reruns the CityState contract and inspects worker-to-household references, job-to-employer references, and resource-flow record versions, clocks and amounts. Each follows the monthly model’s creation and update rules.

Housing, employment and service shortages describe modeled outcomes. They can be present in a valid checkpoint. Service counts are omitted at month zero, before the corresponding model systems have run. The debugger covers the listed checks and a single checkpoint. It does not estimate causal effects or assert calibration, resource conservation across systems, or verified recomputation.
