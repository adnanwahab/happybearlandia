# Research engineer lane — SHE-207

This local contract sits after research discovery (`ops/improvement`) and before
scientific model release. It reuses the existing coordinator's `research` lane
(`tools/symphony/local/throughput_policy.py`); it creates no second dispatcher.

1. Author a `research-brief.v1` JSON issue attachment using the brief in
   `example.json`. State question, hypothesis, pinned sources, intended use,
   acceptance criteria and separate verification, validation and uncertainty
   answers. Sources distinguish observed, synthetic and modeled records.
2. Validate the brief with `python3 -m ops.research_pipeline --brief --input BRIEF`.
   The coordinator records `scheduling.lane: research` in its trusted review.
   Only the coordinator grants `hbl-agent-ready` and `hbl-coordinator-approved`
   after dependency, scope and resource checks. Existing pilot/pressure filters
   are additional host prerequisites; this package does not modify them.
3. Symphony's Codex research engineer implements the assigned model, adapter,
   experiment and tests through the ordinary isolated source-only worker path.
   Retain inputs, environment, rules version, seeds, exact code revision,
   reproduction argv, error analysis, uncertainty and limitations. Commands in
   the manifest are data and are never executed by this validator.
4. Assemble `research-release.v1`. Compute the brief digest with `validate_brief`;
   compute the review subject with `digest({'brief': brief, 'model': model})`.
   Separate engineering and scientific reviewers attest to this exact subject.
   Engineering evidence covers correctness and regression tests. Research
   evidence covers independently reproduced results, error analysis, uncertainty
   and peer review. Reviewers must differ from each other and the model author.
5. Run `python3 -m ops.research_pipeline --input RELEASE`. Exit 0 means both
   attestations pass; exit 1 holds a failed, missing evaluation or stale review;
   exit 2 rejects malformed contracts. The report identifies model ID, version,
   full code commit and gameplay/experiments use. Preserve the reviewed manifest
   alongside that version in the model's repository; changes invalidate reviews.

`example.json` is synthetic documentation with both gates NOT_EVALUATED. It is
not scientific evidence. Run tests with:
`python3 -m unittest discover -s ops/research_pipeline -p 'test_*.py'`.

This validator checks structure, subject binding and declared review separation.
It cannot authenticate reviewers, verify referenced files or establish scientific
truth. Trusted reviewers and protected repository review remain authoritative.
ACCEPTED never grants dispatch, merges, deploys, publishes a registry record or
changes Linear. Live host installation and an actual reviewed research-model
pilot remain operational follow-up; no model experiment is claimed here.
