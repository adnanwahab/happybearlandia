# Policy Impact Explorer integration contract

The Policy Impact Explorer freezes public proposal versions and compares paired synthetic Monthly City scenarios. It reuses the Constitution City mapping registry, runtime and Three.js city views; it introduces no new simulation engine. All outcomes are synthetic scenario outputs, not verified real-world forecasts. A reviewed software mapping is not an empirical effect estimate or a legal determination.

## Create and share a preview

Configure these server environment variables:

| Variable | Purpose |
| --- | --- |
| `HBL_POLICY_PREVIEW_TOKEN` | Shared server-to-server integration token. Writes are unavailable when unset. |
| `HBL_POLICY_PREVIEW_DIR` | Persistent storage directory; default `.data/policy-previews`. Retain it across restarts. |
| `HBL_POLICY_PREVIEW_ORIGIN` | Canonical public HBL origin; development default `http://localhost:${PORT}`. |
| `HBL_POLICY_EMBED_ORIGINS` | Comma-separated approved exact HTTPS origins, including the deployed Civic Synthesis origin. Wildcards are rejected. |

The viewer at `/world/impact?preview=PREVIEW_ID` allows framing by itself and `https://dear-congress.fly.dev`, plus explicitly configured approved origins. This exception applies only to the impact viewer; it does not relax framing on other pages. No integration token belongs in an iframe URL, browser JavaScript or `postMessage`. The viewer does not require a messaging integration.

Run a local server with a locally chosen integration token. Then submit the complete [housing fixture](../world/policy-preview-demo.json) from a server or terminal:

```sh
curl --fail-with-body http://localhost:3000/api/policy-previews \
  -H "Authorization: Bearer $HBL_POLICY_PREVIEW_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @world/policy-preview-demo.json
```

The POST persists the snapshot and returns HTTP 202 immediately, before simulation completion. Its response contains:

```json
{
  "id": "<stable preview ID>",
  "url": "http://localhost:3000/world/impact?preview=<stable preview ID>",
  "supportStatus": "supported",
  "job": { "status": "queued" }
}
```

An identical repeat returns HTTP 200 and the same preview. The job object also reports execution progress; status may already be `running` when read. Poll `GET /api/policy-previews/:id` for the immutable manifest and current job state. Read `GET /api/policy-previews/:id/results` for recorded paired outcomes, events, checkpoint states and uncertainty. Optional `?runIndex=N` selects one zero-based pair. Public GET endpoints require no service credential because the initial workflow only accepts explicitly public content. Private or unlisted proposals are rejected rather than published.

## Versioned request

The executable schema is [policy-preview.schema.json](../world/policy-preview.schema.json). All fields below are required except `modelRunId`:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exact string `policy-impact-preview.v1`. |
| `source` | `{system, proposalId, versionId, contentHash, type, title, url, visibility}`; `type` is `bill` or `constitutional-amendment`; visibility must be `public`. |
| `legal` | `{baseVersionId, clauses}`; exact source text is preserved. |
| `legal.clauses[]` | `{clauseId, sourcePolicyId, operation, beforeText, afterText}`. Operations: `add`, `remove`, `modify`. |
| `baseline` | `{kind, versionId, label}`. Kinds: `current-law`, `prior-proposal-version`. Version must equal `legal.baseVersionId`. |
| `simulation` | `{seed, runs, months}`. Integer uint32 seed, 1–100 paired runs, 1–24 months. |
| `modelRunId` | Optional explicit new-run identifier. Omit for the ordinary frozen saved-version workflow. |

For `add`, `beforeText` is empty and `afterText` is nonempty. For `remove`, the reverse applies. For `modify`, both texts are nonempty. Clause IDs and mechanism IDs are distinct: the caller retains its own clause ID, while `sourcePolicyId` identifies an existing reviewed mechanism. Duplicate or conflicting mechanism declarations are rejected by validation. Use 1–32 clauses; exact clause text is bounded to 20,000 characters per side. Source URLs must be HTTP(S), have no embedded credentials, query or fragment. POST bodies are capped at 700,000 bytes. Unknown properties and invalid values are rejected; no coercion or natural-language parameter inference is performed.

`source.contentHash` is lowercase SHA-256 hex over canonical UTF-8 JSON of the complete `legal` object. Canonicalization recursively sorts object keys alphabetically, preserves array order and exact string contents, and uses compact JSON separators. The fixture hash is `bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e`.

Preview identity includes proposal identity, version hash, pinned model/runtime/mapping versions and simulation configuration. Repeating the same request resolves to the same frozen snapshot and URL. Mutating a saved proposal version is a conflict, not an update. An explicit `modelRunId` requests a separate run; it never rewrites the original preview or reinterprets old results under new model rules.

Existing identical inputs are resolved before calculating a new identity, including
after a model upgrade. A new model version alone never replaces a saved preview.

The baseline is a publisher declaration, not independent verification of enacted law. Prefer `prior-proposal-version` unless the publisher establishes the current-law basis. The baseline disclosure explicitly marks a current-law declaration as publisher-declared and unverified. The fixture uses a synthetic prior proposal; it makes no enacted-law claim. The baseline and proposal share a frozen initial CityState, model, seed pair, location, month and entity identities. They represent the submitted supported mechanism authorizations over that synthetic city, not a reconstruction of the entire baseline legal corpus. These synthetic Monthly City IDs are not real residents or daily Population IDs.

## Reviewed mappings and review boundary

| Mechanism | Reviewed numerical assumption | Limits |
| --- | --- | --- |
| `h_lots` | Four additional permitted homes per modeled parcel at full compliance. | Capacity is not completed housing; no actual lot subdivision, parking-code interpretation or guaranteed construction. |
| `f_drainage` | Completed resilience project adds 0.12 to a synthetic district resilience index, capped by the engine. | No hydraulic protection or structures-saved forecast; avoided damage requires a recorded flood shock. |
| `t_brt` | One deterministic synthetic transit hub gains 30 rider-capacity units per incident transit link; completed projects multiply free travel time by 0.8. | No reconstruction of actual corridors, vehicle schedules, dedicated lanes or real ridership forecasts. |

Adding a mechanism activates its reviewed mapping only in the proposal arm. Removing it activates that authorization only in the baseline arm. This represents the presence/absence of the mechanism from the common initial city; it does not demolish built infrastructure or refund sunk costs. A wording-only modification leaves modeled effects unchanged because no reviewed numerical mapping changed. Unknown mechanisms retain the legal diff and an unavailable modeled effect. Speculative AI suggestions require an explicit future review and registry change before execution; they are never passed through the Experiment Lab's heuristic parameter-patch compiler.

Each `parameterDiff` identifies the source clause, before/after values, units, mapping version, support status, explanation, assumptions and limitations. The integration uses an explicit illustrative USD 1,000 capital envelope per mechanism (`costB = 0.01`, local scale `0.0001`); this is an analyst assumption, not a cost extracted from the bill. Ordinary engine authorization, funding, construction and market constraints govern realization. All source text remains separate from these model assumptions.

## Recorded results and failure behavior

Jobs use the existing bounded `RunJobManager`. A run pairs baseline and proposal with the same derived seed; successful pairs retain monthly metric observations and exact state checkpoints at month 0, month 12 when in range, and the requested horizon. A checkpoint is recorded state, not an interpolation or a browser-side rerun. The time slider selects those available checkpoint months; it does not fabricate states for intervening months.

Status distinguishes `queued`, `running`, `partial`, `completed`, `failed` and model-version `unavailable`. Completed outcomes remain available when another pair fails. Failed pairs have no fabricated values and are excluded from distributions. Counts and missing outcomes remain visible. Authenticated `POST /api/policy-previews/:id/retry` retries failed pairs with identical frozen inputs, up to three attempts per pair; it does not replace successful pairs. On handler initialization after restart, interrupted queued/running jobs resume unfinished work only when the pinned model/runtime versions remain compatible. A version mismatch reports `unavailable` while retaining readable completed results. Stored successful results survive restart.

Housing inventory, monthly mean rent, coarse commute minutes and recorded fiscal/household fields are model outputs with units. Unsupported metrics remain unavailable. A 100-dot landscape means 100 actual successful paired samples only when all 100 pairs completed; it is not a probability forecast. Spread across deterministic seeds captures the existing model's draws, not calibrated parameter, legal or real-world uncertainty. No unseen simulation is added to fill a missing dot.

The explanation inspector links legal source, reviewed mapping, declared parameter change, recorded events and outcomes. Declared mapping dependencies and observed paired differences are not proof that every later event was caused by one clause. Contextual event links and unsupported causal links must remain identified. Full-package comparisons do not isolate individual clause effects when several mechanisms are included.

## Synthetic demonstration and validation

The fixture adds one exact housing clause to a synthetic prior proposal and requests 100 seed-matched pairs through month 24. It supplies no empirical observations. The viewer shows exact source text, the housing mapping, recorded states and outcomes, uncertainty, and inspectable explanation nodes. Construction and rent changes depend on actual model execution; no fixed favorable result is promised.

See [the delivery record](reviews/POLICY-IMPACT.md) for code/description review scope and final acceptance evidence. The coordinator records the actual Bun and Playwright results and browser capture after integration. No deployment, production data modification or automatic merge is authorized by this contract.

The completed [100-future browser capture](images/policy-impact-100-futures.png)
shows the real synthetic fixture at month 24. Its frozen preview ID under the
shipped model is `pp_ce00b29fc0f2a37d6288b1d7b1e1065a490a5465f65a452a4e8d05b7adc1a020`.
After submitting the fixture, its development URL is
`http://localhost:3000/world/impact?preview=pp_ce00b29fc0f2a37d6288b1d7b1e1065a490a5465f65a452a4e8d05b7adc1a020`.
Submitting the fixture is required on each fresh storage installation; no test
results or public proposals are silently seeded into a running server.

The initial synthetic city has three households across three districts. In the
captured pair, the housing authorization adds 12 permitted capacity units but
does not add completed homes by month 24. Equal outcomes remain equal rather
than being adjusted to illustrate a benefit. Full results for 100 pairs occupy
about 25.3 MB; the results endpoint is bounded, with an optional per-pair filter,
but pagination and lighter distribution responses remain future work. Events
retain the runtime's latest 96 records per arm and disclose omissions; the graph
does not reconstruct a missing causal chain. WebGPU availability follows the
existing Constitution City renderer; an unsupported browser shows its renderer
unavailable state while the recorded text and metrics remain inspectable.

Storage is a single-server-process file-backed store. Run one writer process per
preview directory and retain that directory on durable storage; multi-process
queue coordination, archival and result pagination are outside this increment.
