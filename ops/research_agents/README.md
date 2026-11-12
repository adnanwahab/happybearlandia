# Draft-only research agents (SHE-206)

This operator role supports missing rule evidence, modeling comparisons,
experiment proposals and research implementation issues. It reuses the private
`ops.improvement` inbox, budgets, receipts and replay rules. It has no dispatcher,
remote issue writer, scheduler, credentials or command executor.

## Entry points

From the repository root:

```sh
python3 -m ops.research_agents --context context.json
python3 -m ops.research_agents --context context.json --output response.json
python3 -m ops.research_agents --context context.json --output response.json --record
python3 -m ops.research_agents --triage
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops/research_agents -p 'test_*.py' -v
```

The first command prints the research prompt and evidence-gap inventory for a
coding agent or model to consume. The next command validates its response in a
read-only dry run. `--record` saves it in local triage; `--triage` reads saved
drafts. `--state-dir` selects the same private state directory as the improvement
CLI. No command contacts a model or research provider. Python callers can use
`run_agent(context, generate, state_dir, record=False)` with their own model
callable; it receives the prompt dictionary and returns the response dictionary.
Provider cost controls belong to that caller; this role performs no retries.

## Research Library input contract

No central Research Library service exists in this checkout. The supplied
`research-context.v1` snapshot is the role's library boundary; acquisition remains
owned by SHE-246. It contains:

- `library`: entries with unique `id`, `title`, and `source` using the existing
  improvement source contract (pinned repository, paper, artifact references).
- `rules`: unique `id`, `description`, pinned `source`, and `libraryIds` linking
  any existing rule evidence to library entries. Every supplied rule is scanned.

Missing source-text/measured links produce evidence gaps. A linked source is
provenance, not proof that a mechanism is scientifically valid. The role does not
read paper text, validate its conclusions or claim an empirical experiment ran.
Context and agent versions are retained on each draft. Experiments must specify
any model version, scenario inputs, seeds and metrics they need in their proposed
hypothesis/acceptance criteria; these proposals are not simulation run records.

## Model response contract

`research-output.v1` contains 1–20 `drafts`. Each has exactly:

- `activity`: `missing-evidence`, `compare-models`, `experiment`, or
  `implementation-issue`; `ruleId` must identify a supplied rule; `title`.
- `claims`: nonempty list of `{text, libraryIds}`. Unknown IDs fail validation.
  Every claim receives resolved source links. An empty list, metadata-only
  citation or repository-inspection citation gets `unsupported`; source-text or
  measured references get `source-linked`, never a verified finding.
- `hypothesis`, `dataSources` (library IDs, nonempty for experiments), nonempty
  `acceptanceCriteria`, and `testCommands` (argv arrays stored solely as data).

Use separate claims for comparisons and their tradeoffs. Hypotheses and acceptance
criteria are prospective statements. Unsupported claims remain visible in triage;
invented library links, unknown fields or approval requests fail closed.

The complete normalized draft is JSON in the existing proposal `hypothesis`
field, preserving the frozen intake schema. Its 2,000-character limit applies;
oversize drafts are rejected without truncation. Source count remains capped at
12. Rule provenance is included even when all claims are unsupported. Content
hashes identify replay, and stable topic keys hold revised output for review.
All drafts retain `status: draft`, `executionApproved: false`, and intake's
`NOT_EVALUATED` evidence status. Human review must create any eventual scoped
implementation task through the existing workflow. Nothing here grants execution
approval or submits an issue to Linear.
