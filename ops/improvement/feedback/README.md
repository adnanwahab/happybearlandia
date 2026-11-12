# Consented aggregate triage (SHE-248)

This module is a pure, local adapter with an injected callable proposal sink.
It collects nothing, opens no files at runtime, transmits nothing, and creates
no issues. The only accepted v1 input is a synthetic categorical aggregate
fixture, not a public submission format. No UI/server/replay owner is changed.

```python
from ops.improvement.feedback import triage
report = triage(batch, now=150, sink=proposals.append)
```

The caller supplies an integer UTC epoch clock. Input has exactly the shape in
`fixtures/consented.json`. Explicit consent requires literal `true`, scope
`aggregate-triage` and integer version 1 on every aggregate. Missing, withdrawn,
invalid or collection-only consent rejects the entire batch. All validation
finishes before the first sink call. Errors contain no submitted values.

Only enumerated surfaces and symptoms are accepted; there is no free text.
Unknown fields are rejected, including identifiers, credentials, text and URLs.
Reproduction has exactly scenario/seed/modelVersion: null means unavailable.
The only supported recipe and model labels are `synthetic-riverside-v1` and
`fixture-model.v1`; no actual run identity, URL or replay mapping is inferred.
Seeds are optional unsigned 32-bit integers. Missing fields must be explicitly
null; arbitrary nested metadata is rejected.

Bounds: 100 aggregates per call, 1–100000 observations per aggregate, 1000 vote
ordinals per aggregate, ordinals 0–10000 and vote ordinals 0–100000. These integer
ordinals are synthetic fixture references within one batch, never player IDs or
hashed player identities. Repeated aggregate ordinals with equal normalized
content are ignored; conflicting reuse rejects the batch. Vote ordinals are
counted once per cluster across distinct aggregates. This cannot establish
independent people, authenticated consent or live anti-abuse guarantees.

Clusters use the exact surface, symptom and reproduction tuple; no fuzzy match
or semantic defect equivalence is claimed. Sorting and SHA-256 canonical hashes
make output stable under row/vote reordering and exact retries. Source IDs are
cluster hashes, revisions hash minimized counts/context/earliest deletion time,
and proposal dedup keys are stable per cluster. The injected sink must implement
idempotency across calls and transactional delivery if needed. Sink exceptions
propagate; earlier calls can already have succeeded, so retry through an
idempotent sink. This module keeps no cursor, durable receipt or private store.

Retention: createdAt cannot be in the future; deleteAt must be strictly later
and at most seven days after creation. At now == deleteAt, input is excluded.
Any valid deletedAt (creation through now inclusive) excludes the record.
Retries of excluded records count once. A cluster inherits the earliest deleteAt
of its contributors; the returned hash/revision/deadline metadata lets a caller
expire the *entire* derived proposal at that boundary. The caller/sink must
remove derived records and copies then, or immediately on later withdrawal.
This adapter does not retract previously delivered proposals, persist deletion
requests, or enforce downstream deletion. Do not connect it to persistent live
feedback until that ownership and deletion path exist. Passing a later batch
alone does not delete earlier sink state.

## Implementation plan and acceptance evidence

Completed slice: strict fixture input → consent/minimization checks → bounded
retention filtering → deterministic duplicate clustering → shared v1 proposal
through injected sink. The module deliberately rejects free text instead of
claiming a reliable PII detector. Hypotheses identify synthetic observations and
unavailable reproduction; reports are evidence for review, not verified defects.
Proposals retain SHE-52/SHE-120 dependencies. No dispatch gates are altered.

The scope is limited to this new directory, including this plan/status record;
coordinator-owned schema, persistence, CLI and repository implementation plan
are untouched. Local compatibility tests use the checked-out shared validator;
production integration still waits for the shared-contract PR review. No live
activation, host workflow changes, network, Linear writes, model rules, merges
or deployments are included.

Verification:

```sh
python3 -m unittest discover -s ops/improvement/feedback -p 'test_*.py' -v
python3 -m unittest discover -s ops/improvement -p 'test_*.py' -v
```

Eight adapter tests cover consent/opt-out, unknown sensitive fields, raw URLs,
oversized strings and lists, unsupported context, missing reproduction, retries,
conflicting receipts, duplicate votes, deterministic ordering, retention and
withdrawal boundaries, full validation before sink delivery, sink failure and
shared-contract compatibility. Browser behavior is unchanged; Playwright does
not apply. Live consent collection/authentication, real aggregate provenance,
privacy review and abuse defenses remain separate prerequisites.

Actual local results: all 8 adapter tests and all 34 improvement-package tests
passed; `git diff --check` passed. No repository-wide lint/type command is
configured for these Python modules. No production sink integration was run.
