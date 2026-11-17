# Improvement proposal intake — phases 1 and 2

This is the shared local boundary for future research, evaluation and feedback
adapters. It consumes proposed work, not simulation runs, and reuses SHE-180's
existing report instead of introducing another dispatcher. No persistent service
has been activated. No Linear/GitHub transport, command executor or approval API
exists in this package.

## Audited reuse and limits

| Existing work | Observation and decision |
| --- | --- |
| SHE-180, PRs #30, #31 and #37 | Merged coordinator, durable approval leases and private reports. Reuse report shape; preserve its approval implementation. |
| SHE-126/127 | Checklist remains incomplete; GitHub Issue mirror matching remains a documented gap. PR #20 is the inactive alternative dispatcher. |
| Live workflow | Host-only `~/happybearlandia/tools/symphony/elixir/WORKFLOW.md`, root `~/code/symphony-isolated-v2`, one worker; both `symphony-pilot` and `symphony-pressure-release` required. Preserve runtime owner's hold. |
| SHE-7/52/120 | Telemetry schema absent; feedback issues are incomplete/overlapping. Do not implement a competing UI or intake endpoint. |
| Existing feedback modules | `world/onboarding/feedback-adapter.js` presents simulation evidence. `world/decision/onboarding.js` records bounded local demo activity. Neither is consent-backed player collection. |
| Evaluation | Reuse checkpoint replay, evidence manifests, Bun/Playwright CI and existing renderer/startup benchmarks. Unsupported hardware and absent evidence stay unavailable. |
| Research | Existing research worktrees hold reproducible model experiments. No OpenAlex/Crossref acquisition adapter was found. Reuse the evidence registry and existing experiment identities later. |

## First three independently testable tasks

Created in the existing project, as children of existing product issues. Each
can develop and test against an injected fake sink without editing the shared
core. Integrated submission waits for this contract's review. Backlog status and
`hbl-symphony-queue` tracking are **not execution approval**.

| Task | Parent / exclusive ownership | Acceptance |
| --- | --- | --- |
| [SHE-246](https://linear.app/shel-bernstein/issue/SHE-246) | SHE-185; `ops/improvement/research/` only | Metadata agreement, source provenance, DOI/paper/topic cache, bounded retries and fixture tests; distinguish metadata from verified mechanisms and hypotheses. |
| [SHE-247](https://linear.app/shel-bernstein/issue/SHE-247) | SHE-189; `ops/improvement/evaluation/` only | Normalize actual CI/benchmark artifacts with exact-head/environment checks and PASS/FAIL/NOT_EVALUATED; no parallel executor. |
| [SHE-248](https://linear.app/shel-bernstein/issue/SHE-248) | SHE-196; `ops/improvement/feedback/` only | Pure consent-gated aggregate triage, dedup and retention fixtures; no collection, UI or live voting while SHE-52 / SHE-120 ownership is unresolved. |

Phases 3–5 implement those adapters in separate reviewed PRs. Network acquisition,
source-text validation, CI/nightly triggers, supported GPU execution, collection
consent, authentication, moderation and live abuse defenses are distinct gates.
Phase 6 extends the existing operator dashboard with inbox discoveries/holds and
measured adapter costs; it must not treat proposal counts as verified improvements.

## Frozen v1 contract

`proposal.validate_proposal` accepts exactly these fields:

- `schemaVersion`: `improvement-proposal.v1`; `kind`: research/evaluation/feedback.
- Bounded `title`, `hypothesis`, nonempty `acceptanceCriteria` and `testCommands`.
  Commands are argv **data**; intake never executes them, including shell argv.
- Nonempty `sources`: each has type, id, revision, url and evidence. Repository
  references pin this repository's blob SHA/path. Artifact references identify a
  SHA-256 and build SHA with a repository Actions URL. Paper references use DOI
  or OpenAlex work IDs and metadata content revisions. Feedback references use
  aggregate hashes, a consent assertion and no URL.
- Explicit `dependencies` as SHE identifiers, `deduplicationKeys`, and
  `targetIssue` (identifier or null). Unknown fields, including labels, fail.

Validation checks **structure and reference consistency**, not factual existence,
content hashes, obtained consent or scientific correctness. All intake evidence
is marked NOT_EVALUATED and all execution approvals false. Metadata-only source
labels cannot become measured evidence. Free-form hypotheses are not a PII
screen; future adapters must minimize and review content before submission.

The paper-ID subset follows the official [OpenAlex ID documentation](https://help.openalex.org/how-to/finding-openalex-ids/)
and [Crossref metadata interface](https://www.crossref.org/documentation/retrieve-metadata/rest-api).
No provider request or empirical finding is claimed in this slice.

`improvement-batch.v1` wraps one producer stream, expected `cursorBefore`, distinct
`cursorAfter`, and up to 20 proposals. Limits: 32 KiB per proposal, 1 MiB input batch,
12 source references/acceptance criteria/test argv entries. DOI and source order
are normalized. Identity includes kind, source IDs/revisions and dedup keys;
payload changes under an unchanged identity are conflicts. Related keys under a
new revision are stored but held for review. Semantic duplicates still require
existing coordinator/source review.

## Run the vertical slice

From the repository root:

```sh
python3 -m ops.improvement --input ops/improvement/fixtures/example-batch.json --state-dir /tmp/hbl-improvement-example
python3 -m ops.improvement --input ops/improvement/fixtures/example-batch.json --state-dir /tmp/hbl-improvement-example --record
python3 -m ops.improvement --input ops/improvement/fixtures/example-batch.json --state-dir /tmp/hbl-improvement-example --record
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops/improvement -p 'test_*.py' -v
```

Default dry-run makes no state directory, database, cursor or lock. `--record`
explicitly persists locally; the repeat reports zero new proposals. The example
is marked as example work, points at the real already-delivered metric boundary,
and targets SHE-141 so a fresh coordinator report holds it as already represented.
It is not a new implementation task or a synthetic performance measurement.

Add `--coordinator-report /path/to/existing-coordinator-dry-run.json` to project
current issue, PR and dependency holds. Reports must match HBL's project and be
at most one hour old. Missing reports hold all proposals. This is an advisory
snapshot; even REVIEW never bypasses the live readiness/ownership/resource gates.

The default private state location is `~/.local/state/hbl-improvement`. It must be
host-owned mode 700; database/lock are 600. No symlinks/hardlinks or schema resets.
SQLite commits proposal records, dedup keys, budget, receipt and checkpoint in
one transaction. Conflicts, failure, stale cursors or exhausted budget leave the
checkpoint unchanged. Replay reprojects current holds and reports `storedCursor`,
which can be newer than the replayed batch. Corrupt state/receipts fail closed.

The default global intake budget is 20 new proposals per UTC day, with an explicit
operator `--daily-limit` of 1–100. These are intake policy limits, not performance
targets. Lock waits have three bounded attempts; SQLite timeout is 5 seconds.
No external retry/model loop exists. Structured summaries report actual local
network/model/remote-write counts of zero; they do not estimate upstream adapter
costs. Reports omit proposal bodies and test argv. Keep the private proposal DB
out of public artifacts; no raw player data belongs in this intake.
