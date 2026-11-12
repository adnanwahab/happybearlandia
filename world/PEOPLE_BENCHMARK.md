# Actual synthetic people benchmark

Open `/world/bench/people`, choose10k/50k/100k, then explicitly start. The benchmark uses the actual population model in one authoritative registered Web Worker, two explicit synthetic districts, seed42 and24hourly calls per modeled day (the model internally uses bounded smaller steps). Reports include normalized config, world context, model version and actual simulated minutes. It does not invoke an LLM.

The November2,2026 Chromium run below used population1.0.0 with needs and fitted employment marginals. Each row is one local run of one modeled day, not a statistical comparison or hardware guarantee.

| Synthetic people | Generation ms | Stepping ms | Snapshot ms | Modeled days/s | Typed-array bytes | Repaint callbacks |
|---:|---:|---:|---:|---:|---:|---:|
|10,000|28.5|599.2|1.1|1.669|1,574,000|30|
|50,000|59.0|2,030.1|0.9|0.493|7,870,000|126|
|100,000|83.2|3,327.1|0.9|0.301|15,740,000|206|

Repaint-probe median intervals were16.7ms; p95was approximately16.7–16.8ms. This measures a small Canvas2D callback probe while the worker executes, **not full-city renderer FPS**. Observed100k trip throughput was22,189.9trips/s and recorded-choice throughput22,192.9choices/s, derived from actual cumulative model counters. These are synthetic workload rates, not observed city demand. Wall time includes worker startup/message delivery; stepping time excludes generation and snapshot time.

Typed-array byte lengths are measurable hot-state storage only. Object overhead, full worker heap, portable CPU utilization and GPU memory are unavailable. Internal schedule/destination/mode/housing phase timings are not separately instrumented and are explicitly unavailable. More complex districts, horizons and policies may cost more. Live shared-capacity state remains single-worker; parallel independent futures are separate work, not population sharding.250k is unsupported by the current model schema and is not offered in the UI.

Days are bounded1–31; a120-second deadline or Cancel terminates the actual worker. Cancellation leaves no substituted result, and a fresh run is possible. The browser test verifies more than one repaint callback during each actual10k/50k/100k run and zero AI proposal/provider requests.

Actual reports:

- `/private/tmp/hbl-people-benchmark-10000.json`
- `/private/tmp/hbl-people-benchmark-50000.json`
- `/private/tmp/hbl-people-benchmark-100000.json`

Reproduce against an explicitly isolated local server (do not stop/reuse user servers):

```sh
node scripts/benchmark-people.js http://127.0.0.1:PORT 10000,50000,100000 1 /private/tmp/hbl-people-benchmark.json
```

Or run `living-city-world.e2e.js`'s benchmark case with `HBL_BENCH_POPULATIONS=10000,50000,100000` and an isolated Playwright webServer. Product's temporary config is `/private/tmp/hbl-living-product.config.mjs`; its server shuts down when tests finish.

## Interaction sensitivity research

The headless `bun scripts/benchmark-interaction-ablation.js` entry uses the same
synthetic geography and actual Population rules. It measures five transport
feedback arms with matched seeds, headline outcomes, sampled resource-incidence
graphs and paired 95% bands. See [E2 coverage and protocol](../docs/research/million-agent-architectures.md).
This first slice **does not** supply a complete no-interaction control and cannot
authorize an “interacting residents” claim. Runtime version and source hashes
in each report supersede the historical throughput table above.
