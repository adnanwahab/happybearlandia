# Worker runtime (Living City)

`getWorkerRegistry()` from `worker-registry.js` observes actual registered Workers.
Its `subscribe`, `getSnapshot` / `snapshot`, and `exportDiagnostics` functions are
read-only. Portable per-worker memory/CPU is explicitly unavailable. Legacy
adapters have no fabricated heartbeat. Protocol Workers send real heartbeats.

`createTrackedWorker(url, options, metadata)` preserves the Worker's normal
message handlers. GeometryCache and the business futures UI use it. Renderer
experiment/cycle creation is owned by visualization; central registration only
covers instrumented Workers in the same JavaScript context, not remote server
processes. Diagnostics do not expose full task payloads or private records.

`createWorkerPool` provides a bounded priority queue, stable FIFO within priority,
maximum twelve workers, pause/resume/drain/resize and cancellation. Only explicitly
deterministic tasks without detached input buffers may retry after a worker
crash; retry/restart counts and deadlines are bounded. Pool actions through the
registry require explicit developer authorization. A task error is not silently
retried as a crash. Normal inspector controls remain read-only.

Future initialization enforces the model validation gate. Rejected targets produce
failed rows with the actual validation errors, not fabricated forecasts. Live
state remains inspectable with its gate warnings.

The live population uses **one authoritative Worker**, because housing and jobs
share capacities. Independent seeded futures use the scalable pool. Stable range
partition helpers are available but are **not** a distributed model implementation.
The clock is timer-driven and fixed-step, never RAF-dependent; speed is0.25–32.
`updateConfig` resets/reseeds explicitly, clears stale visible frames, and records
previous config/metrics/timeSeries. Visible snapshots cap at500; positions and
activities transfer as typed buffers; bounded metadata accompanies that sample.

`runExperiments({configs,seeds,runs,horizonDays,onProgress})` returns
`{ready,cancel,getProgress}`. Limits:1–4configs,1–1000 paired runs,1–365days,
20million actual agent-steps, one experiment per runtime, and at most200000
simultaneous independent-future model agents. Default2runs×7days. Summary rows
retain immutable model/config/seed/world manifests, aggregate results and up to64
actual trajectory samples (maximum100000points total); unsampled ticks and omitted
person/log detail are explicit. No old housing model outputs substitute for people.

`inspectFutureEntity(row,manifest,{kind,id})` recreates a selected person/household
without touching live state. Selection is set before stepping for retained traces.
`replayFuture(row,manifest)` explicitly resets the live model and advances inside
one Worker task to the stored horizon. Version/seed/index/world-context checks
reject mismatched replay rather than reinterpret it. `stepToTime(minutes)` requires
fixed-step alignment. Continuation forks and coordinated live-state sharding are
not implemented.

`benchmarkPopulationScaling()` in `benchmark.js` measures independent futures.
A local Bun1.4.2 /10logical-core run of12futures ×1000people ×1day measured:

| Future workers | Wall ms | Tasks/sec |
|---:|---:|---:|
|1|621.69|19.3|
|2|415.37|28.89|
|4|303.65|39.52|
|8|321.22|37.36|
|12|240.71|49.85|

Startup and messaging overhead is included. These small synthetic workload
measurements are not a browser frame-rate,100000-person, or production guarantee.
Rerun on the target device; more workers are not automatically faster.
