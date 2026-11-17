# Advisory feedback and triage

The existing `/vote-on-patch` entry point collects votes, ideas, problems,
confusing steps and favorite moments. Every write requires `consent: true`;
reading issues no cookie. The UI starts unchecked and does not persist consent.
Unchecking prevents future submissions; it does not erase previously submitted
records. No names, emails, IPs, URLs or gameplay telemetry are stored by this
module. Free text may contain personal data: operators must keep the store
private. There is no public report listing. Replay seeds are optional, manually
supplied strings; they do not prove reproducibility without model/input versions.

Configure HBL_PATCH_VOTE_SECRET and optionally HBL_PATCH_VOTE_DB_PATH as for the
existing ballot. Keep the database outside static roots. No deployment here.

Run `bun ops/patch-voting/triage.js list` locally to inspect pending feedback
and advisory vote tallies. Run `bun ops/patch-voting/triage.js merge SOURCE TARGET`
to mark a duplicate idea merged into another unmerged idea atomically, retaining
both original texts and provenance. Reports cannot be merged. These commands
never implement changes, launch agents or publish feedback. No remote admin
endpoint or automated improvement-service handoff is introduced.

## Player patch loop in /world (PR #547)

- The **⚡ Patches** button opens `/vote-on-patch?returnTo=...` and keeps the current World scenario for return navigation. Embed mode hides the shortcut.
- Player ideas and problem reports are still PRIVATE pending moderation. Optional `worldContext` stores only allowlisted World IDs and seed; there is no browser-to-GitHub write credential.
- The current `GET /api/patch-votes`, `POST /api/patch-votes/:id/vote` and `POST /api/patch-votes/suggestions` are the stable write contract. `POST /api/patches` and `POST /api/patches/:id/vote` are same-origin **307 aliases** to the existing handlers, preserving the narrow cookie path and validation. `GET /api/patches` provides public curated ballot + known PR lifecycle; `GET /api/patches/:id/impact` returns validated recorded evidence, or an explicit unavailable response. Raw submissions do not become GitHub issues or agent prompts.
- A ballot must CLOSE with at least **5 upvotes and +3 net votes**, the candidate must be maintainer-curated, and all dependencies must be in `ops/agent-factory/verified.json` before `buildReadyQueue` releases an executable task.
- The existing scoped Codex dispatcher executes on a trusted host; focused tests and optional independent reviewers run before publication. PR creation is always **draft** through the GitHub App adapter. Ready status, required CI, branch protection, no-hold checks, and review approval remain independent gates.
- The repository's existing five-minute guarded auto-merger, when explicitly enabled by its owner, can merge a ready and eligible PR. **Nothing in PR #547 bypasses review, turns on that workflow, or deploys the game.** Deployment needs a separate production release step.

### GitHub App configuration (trusted agent host ONLY)

Create a GitHub App installed only on `adnanwahab/happybearlandia`. Grant **Contents: read**, **Issues: read and write**, **Pull requests: read and write**, **Checks: read** and standard metadata read access. Keep the private key off the public game server, client bundle, repository, logs, and CI artifacts.

```bash
export HBL_GITHUB_APP_ID=<numeric-app-id>
export HBL_GITHUB_INSTALLATION_ID=<numeric-installation-id>
export HBL_GITHUB_APP_PRIVATE_KEY="$(cat /secure/path/to/github-app.pem)"
# On both worker and voting server: a properly secured, shared PRIVATE SQLite file
export HBL_PATCH_VOTE_DB_PATH=/private/persistent/patch-votes.sqlite
# Run a bounded local dry-run first:
bun ops/agent-factory/dispatcher.mjs
# Once the host, isolated worktrees, Codex, reviewer tools and Git credentials are provisioned:
bun ops/agent-factory/dispatcher.mjs --execute --loop --github-app-prs
```

The dispatcher verifies curated task scope, closes and thresholds; generates a branch with local focused tests; pushes that exact commit; and uses the GitHub App to open an issue and draft PR. GitHub publication verifies the exact tested SHA against the pushed branch and the PR response, and reuses existing PRs. If GitHub fails, the job stays blocked for inspection. A GitHub search marker helps de-duplicate issues but is not an atomic cross-system transaction. The user must explicitly mark the draft ready after review; successful CI and repository protections are then required for merger eligibility.

The GitHub App uses signed RS256 JWTs to obtain short-lived installation tokens. Its remote operations are limited to this repository and pre-approved branch names. `ops/patch-voting/github-api.js` never accepts arbitrary player-provided text as an implementation task or GitHub payload.

### GitHub webhook on the game server

Configure the GitHub App webhook URL `https://happybearlandia.fly.dev/webhooks/github` with content type JSON, subscribe to `pull_request` and `workflow_run`, and configure:

```bash
HBL_GITHUB_WEBHOOK_SECRET=<random-secret-with-at-least-32-characters>
```

The server HMAC-verifies `X-Hub-Signature-256`, bounds body size, checks repository/PR identity, and only updates PRs previously linked by the trusted worker in the private vote database. The UI distinguishes draft/open/merged from deployments. The observed `HappyBearLandia core journeys` workflow conclusion is only a status hint, NOT a substitute for all checks. For a scaled/distributed deployment, use a shared transactional database/event queue instead of uncoordinated local SQLite files. Webhooks may not cover every workflow event; GitHub remains authoritative.

### Real before/after impact

Impact results are NEVER estimated from votes, PR descriptions, or placeholder math. They must be recorded by the actual simulator with matching `seed`, `scenarioId`, and `startingStateId`. Each run artifact is JSON:

```json
{
  "schemaVersion": "hbl.sim-run.v1",
  "runId": "recorded-run-id",
  "seed": "same-seed",
  "scenarioId": "scenario:hbl:baseline",
  "startingStateId": "same-start-state",
  "modelVersion": "version-used",
  "rulesVersion": "rules-version-used",
  "metrics": [{"key":"metric_name","label":"Metric name","value":0,"unit":"documented-unit"}]
}
```

For an actual comparison, write an impact manifest `hbl.patch-impact.v1` containing `candidateId`, `seed`, `startingStateId`, `scenarioId`, `recordedAt`, and a `before` and `after` record each with `runId`, `source:"recorded"`, `modelVersion`, `rulesVersion`, `metrics` and `evidenceSha256` (SHA-256 of the exact respective run JSON bytes). Import from a trusted host only:

```bash
bun ops/patch-voting/import-impact.mjs U06 /private/impact.json /private/before-run.json /private/after-run.json
bun test test/patch-voting.test.js test/patch-queue.test.js test/patch-governance.test.js test/patch-github-api.test.js
```

The importer verifies both artifact digests and the claimed run metadata/metrics before recording them. It does NOT independently prove empirical validity or confirm that the game engine actually produced the file; retain the underlying test receipt/CI artifact for human verification. If there is no evidence, the comparison UI explicitly says so.
