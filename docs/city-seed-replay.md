# Monthly City deterministic seed sweep

SHE-59 adds a distinct acceptance harness, not another simulation. Existing
`future-machine-data`, `future-machine-boundaries` (R03/R08), and
`future-machine-scrub-identity` tests already verify the canonical seed-42
journey, persisted uint32 boundary pairs, common Month 0 and replay/identity
failures. HBL-W1-004 / SHE-9 is complete per coordinator readiness. The existing
Living City 100-sample commute comparison is a different scenario; it does not
supply this independent Future Machine replay digest report.

Run from the repository root:

```sh
bun test test/city-seed-replay-sweep.test.js
bun scripts/verify-city-seed-replay.mjs
bun test test/future-machine-data.test.js test/future-machine-boundaries.test.js test/future-machine-scrub-identity.test.js
```

The acceptance command writes
[`evidence/city-seed-replay-100.json`](evidence/city-seed-replay-100.json), including
an explicitly expanded list of seeds 0 through 99 plus 2147483647, 2147483648,
4294967294 and 4294967295. Two additional cases exercise minimum population 1
with no intervention, and maximum population 120 with 120 homes, zero cost,
maximum supported delay 120 and compliance zero. These are supported recipe
boundaries, not a claim to exhaust every engine parameter combination.

Each case uses the supported `initialForRecipe` generator and real
`createEngine().step` for two 120-month arms. The initial state is recursively
frozen, hash checked after both arms, and regenerated independently. Both
normalized histories include exactly the common original Month 0 plus months
1–120. Each step validates seed, clock, model and generator provenance,
collection ID uniqueness, event identity/time/system/model and nonempty
versioned observations. The existing engine and normalizer additionally enforce
state, assignment and finance-ledger contracts. Raw steps retain all engine
outputs (including proposals, resolutions, decisions, events, observations,
flows and diagnostics) in the digest; normalized frames include rendered metrics
and cumulative capital spending. No synthetic causal edges are added.

The harness independently regenerates the entire pair, then compares initial,
raw-history and normalized-history SHA-256 digests for both arms. Digests use the
existing canonical content hash; history digests hash the ordered sequence of
per-step/frame hashes, so reordering or changing an intermediate record is
observable. Only the current arm's history and compact pair summaries are
retained; cases and independent runs execute sequentially, with no workers.
The report stores both digest sets, all recipes, exact engine/rules/generator,
runtime, source HEAD and content hashes (including the uncommitted harness at
execution). Source HEAD is the pre-implementation baseline; content hashes pin
the actual executed code without a circular evidence/commit hash dependency.

Failures are retained with case index, input and diagnostic, and subsequent
cases continue. Digest disagreements retain both sets of hashes. A failing
engine case may have no completed digest entry; `caseCount`, `passed` and
`mismatches` remain authoritative. The CLI saves the report before exiting
nonzero on any mismatch. Targeted tests inject mismatch and engine failures,
malformed seeds/recipes, and state/observation/provenance corruption. No retained
R03/R08 test or engine/data implementation was changed.

These are synthetic modeled results with illustrative, uncalibrated equations.
The generator has no geographic coordinates, zero private parcel capacity,
200 utility capacity per district/network, and zero annual growth. Replay
agreement establishes deterministic recomputation under pinned source, not
empirical validity, policy causality, saved-checkpoint equivalence, API durability
or browser behavior. IDs and months belong only to monthly City, not House or
Population. No UI changed; browser launch, Playwright and PR media are inapplicable.

Coordinator retains shared implementation plan and interface ownership. This
slice owns only the harness, its test, this document and the JSON evidence. No
CI, server, engine, data, production or release interface is changed.

## Observed acceptance evidence

On Bun 1.4.2, the acceptance command exited 0: **106/106 cases passed, zero
mismatches**. This is 104 explicitly listed seeds plus two recipe-boundary cases,
424 arm histories and 50,880 monthly engine steps across original and independent
replay runs. Each normalized arm contains 121 frames. The JSON report stores all
106 pairs of digest summaries, an empty mismatch list and the exact source hashes.

The targeted harness suite passed **5 tests / 43 assertions** (final run 3.80s).
The unchanged retained data, boundary and scrub-identity suites passed **12 tests /
264 assertions** (6.25s). `git diff --check` passed. The local sprint base and
pre-implementation HEAD both equal `870c0ca2ab9c9061ed1056de87731b3664474d48`;
isolation and base-ancestor checks passed. Host publication must verify remote
base freshness. There is no configured lint/type-check script and no UI change.
