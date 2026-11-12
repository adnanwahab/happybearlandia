# Symphony source status contract v1 (SHE-252 / SHE-251)

Owner: existing HappyBearLandia host coordinator. Consumer: Civic Synthesis's
repository Issues view. This is a read projection, never execution authority.

`source-status.json` under the coordinator's host-private state is the current
snapshot (`version:1`, `at`, `repositories`, `issues`, `operations`). The same
`Store.public_rows(repository)` function supplies a selected repository's rows.
An authenticated existing host bridge can read this projection; do not expose the
SQLite store, raw issues, credentials, readiness files or assignment manifests.
No new network service or public app deployment is included in this change.

Rows contain:

- `provider` = `github`, immutable numeric `repositoryId`, `issueId`, exact
  allowlisted `repository`, `number`, `sourceKey` = `github:<repo ID>:<issue ID>`;
- `revision` (SHA256 of relevant current issue content), `url`, sanitized `title`;
- `state`: queued, waiting, needs_clarification, implementing, pr_opened,
  already_implemented, duplicate, infeasible, closed;
- `blockingReason`, `lastAttempt`, `nextAction`, `nextRetry` (Unix seconds or null);
- `linearTicket` (public URL or null), `pullRequests` with URL/headSha/state/draft;
- `statusCommentUrl` only after a verified GitHub receipt;
- `delivery` with queued/failed/posted state, attempts, retry_at, sanitized error.

A failed or unconfigured fetch is not an empty repository: check each repository's
`complete` and `error`. A partial scan never infers closed/completed issues.
`pr_opened` means review/voting remains pending, not implemented or merged. Keep
failed rows in Issues and show linked drafts in the matching repository's PR view.
The caller must enforce the exact repository allowlist as well as access policy.
All descriptions and titles remain untrusted text, never HTML or instructions.
`source-status.fixture.json` is synthetic test data, not evidence of live PRs.

There is no dependency on the companion UI to activate intake, and no requirement
for UI votes before admission. The UI can consume this schema/fixture independently.
