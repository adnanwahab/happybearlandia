# Detective of Futures prototype (SHE-225)

Entry: `/world/detective.html`, also linked from Future Machine. Start with the
normal `bun run start`. Five cases use seeds 42–46 and the existing versioned
Future Machine generator. Four candidates vary housing authorization (12, 24,
36 or 48 homes), keeping cost, district, timing and compliance fixed. Each case
is a distinct recipe. Candidate IDs and order are generated per saved attempt.

`POST /api/detective {caseIndex:0..4}` returns only a saved experiment ID.
`GET /api/detective/:id` returns allowlisted Month-120 metrics, candidates, step
count, and a reveal only after submission. Share `?experiment=<id>`; no `fm=`.
`POST /:id/evidence {step:inventory|completion|trail}` counts each distinct step
once before reveal. Trail summaries use the existing anchored evidence builder;
raw policies, state, project records and event payloads are never returned.
`POST /:id/answer {choiceId}` compares canonical SHA-256 recipe hashes and freezes
the first submission. Correct answers earn 50 + 15 per distinct step (max 95).
The reveal includes both hashes and the canonical matched-run receipt. Baseline
and plan start from the same pre-intervention state and seed. Receipt experiment
identity is null because this is not a City API experiment; the reveal carries
the saved puzzle ID separately and the receipt recipe supports recomputation. No ordinary City experiment is
created, so its manifest API cannot disclose a puzzle answer.

`GET /api/detective` reports aggregate attempt counts, correct submissions,
correct completions with >=2 steps, their fraction of started attempts, and
correct zero-evidence submissions. Target is >=60% completions with evidence;
zero-evidence successes inform the kill criterion. These are saved attempts,
not authenticated players. No user study has been run.

Storage: `HBL_DETECTIVE_ROOT` (default `.hbl-detective`) outside static roots.
One atomically replaced mode-0600 JSON file retains pinned recipes, choices,
steps and reveals across restarts. Single-process prototype, serialized requests,
10,000-attempt cap, five cached recomputations. Use one writer. Mount and back up
the directory before any separately authorized deployment. Authentication,
abuse resistance, multi-process storage and player cohort analytics remain out
of scope. An ID grants access to the same attempt including submission rights.

Data is synthetic monthly City, with private parcel capacity zero, utility
capacity 200, and annual growth zero. Events and joins are model observations;
causal certainty and empirical prediction are not claimed. Recipes/rules and
seeds are disclosed in the receipt only after reveal. Receipts verify internal
deterministic recomputation, not independent recorded-checkpoint equivalence.
