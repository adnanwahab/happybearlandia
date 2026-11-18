# Local launch feedback review — SHE-970

This operator-only dry run connects existing opt-in player counts and private
patch-vote review to one review artifact. It never calls Linear, creates tickets,
changes source databases or dispatches work. Run on a trusted local host against
private **local copies** of both current-schema databases. Missing files/tables
fail closed; this command does not initialize or migrate a store.

Prepare a private JSON backlog snapshot from an authorized read-only Linear
export, including completed/closed issues. Exhaust pagination for each family.
`completeFamilies` is the exporting human's assertion, not independently verified
by this offline tool. Do not mark partial/failed searches complete. Example shape:

```json
{
  "version": 1,
  "revision": "export-time-or-content-revision",
  "completeFamilies": ["HBL-FUN", "HBL-W1", "HBL-SYM"],
  "issues": [
    {"id": "SHE-586", "title": "[HBL-FUN-098] In-place Wow / Confusing feedback"}
  ]
}
```

The example is incomplete: export all three families before asserting coverage.
Issue IDs are Linear SHE identifiers; HBL prefixes live in issue titles. Titles
only enter the private search record. No user text is sent to search services.

```sh
bun --no-env-file ops/launch-triage/run.js prepare /private/counts.sqlite /private/patch-votes.sqlite /private/backlog.json .hbl-private/launch-review.json
```

The output is exclusive-create, mode 0600 under `.hbl-private` (0700 when newly
created); existing files are never overwritten, and symlink roots are rejected.
Keep the entire directory private; do not attach this queue to public issues,
commit it, serve it or copy it into artifacts. Raw suggestion text can contain
personal information. No voter keys/cookies are read. Counts are submissions,
not people; current endpoint opt-in requirements do not prove legacy row consent
or grant publication consent. Unresolved consent stays explicitly unavailable.

Groups merge only equal kind + normalized title/details + exact replay seed and
World context. Original texts, IDs, statuses and merged-into links stay intact.
Merged ideas remain evidence; they are not reopened in the source store. Ballots
retain their own candidate IDs, tallies and linked PR/head identity. Count keys
remain kind/moment, with no invented individual identities, model versions or
run provenance. Counts, suggestions and ballots are separate evidence types;
humans may discover further semantic duplicates across them.

Search ranks all snapshot issue titles by token overlap. It is a candidate list,
not semantic duplicate detection. Inspect the full snapshot and original backlog
before deciding, including done issues that may need reopening. No match is not
proof of new work. Refresh copies/export immediately before review; the queue
revision includes all sources and search content. Changes invalidate decisions.
Two databases are read separately, not as a cross-store transactional snapshot.
Source IDs are scoped to this pair of copies; do not combine unrelated stores.

Create a private decision file, copying the exact queue revision and entry key:

```json
{
  "queueRevision": "copy-from-queue",
  "key": "copy-from-entry",
  "reviewed": true,
  "duplicateSearchReviewed": true,
  "action": "link-existing",
  "issueId": "SHE-586"
}
```

```sh
bun --no-env-file ops/launch-triage/run.js review .hbl-private/launch-review.json /private/decision.json .hbl-private/launch-decision.json
```

Prefer linking existing work. For genuinely new work, use `action: "preview-new"`
and `noExistingIssue: true` instead of `issueId`. All three families must be
complete for either decision. The preview contains only fixed wording and an
enumerated feedback category, never user text, seeds, source IDs, backlog titles
or URLs. Evidence remains in the private queue; public reproduction/evidence is
explicitly unavailable until a human independently reviews and sanitizes it.
Review flags are local human attestations, not authenticated approvals. Protect
the input files from edits by untrusted parties. No publishing credential or
submission option exists. A separately authorized human must review copy and
open/link any issue manually; repeat the live duplicate search before doing so.
The tool does not promise atomic idempotency across manual Linear writes.

Rollback: stop using the command and remove its local private output copies and
decision files. No schema/source/governance rollback is needed. Existing collector
retention and anonymous-count withdrawal limits still apply. Operators own
expiry/withdrawal of derived review copies; there is no new live retention service.
No synthetic simulation output or verified causal/defect claim is generated.

Verification: `bun --no-env-file test test/launch-triage.test.js`.
