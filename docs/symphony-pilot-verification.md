# Symphony pilot verification — SHE-179

Evidence recorded on November 11, 2026 in the isolated `SHE-179` checkout.
This report covers the worker execution and local publishing handoff. A live
GitHub draft PR is not yet verified: the trusted publisher runs after this
session ends.

## Observed execution and boundaries

1. **Linear:** a read-only `get_issue` request for `SHE-179` returned
   `In Progress`, labels `Bug` and `symphony-pilot`, no blocking relations,
   and no attachments. The supplied ticket scope contains no additional
   prerequisite issues. No tracker mutations were performed.
2. **Symphony → Codex:** the session received the issue context in
   `/Users/wahabma/code/symphony-pilot-isolated/SHE-179`. The existing
   `.git/hbl-workpad.md` reported host initialization complete and Symphony
   status `running`. Those are host-reported facts; this worker did not
   independently inspect dispatcher polling or process-launch logs.
3. **Codex workspace:** `git status --short --branch` showed a clean
   `symphony/SHE-179` branch. Initial HEAD, the local sprint branch, and its
   origin tracking ref all resolved to
   `ec408d03a70fdaac90c1eb82263a5740797c36bf`.
   `test ! -e docs/symphony-pilot-verification.md` succeeded before creation.
   No prior local publisher request existed. No existing PR was identified
   in the available issue attachments; GitHub PR state was not queried.
4. **Codex → trusted host → GitHub:** the required procedure specifies a
   local commit followed by atomic `.git/hbl-publish.json` and
   `.git/hbl-workpad.json` handoffs. The publisher request names repository
   `adnanwahab/happybearlandia`, branch `symphony/SHE-179`, base
   `sprint/one-city-two-futures-20261111`, full commit SHA, and PR body.
   The host's `after_run` hook owns authenticated push, draft creation and
   linking the receipt in the existing workpad. This is the prescribed
   publication contract, not evidence that publication has occurred.

The worker uses the host-provided local sprint base without a sandbox fetch.
The host must fetch and confirm the remote base is an ancestor of the committed
HEAD before publication. Local base equality does not establish remote freshness.
The issue stays In Progress for handoff; operator review controls later status
changes. No push, `gh`, GitHub authentication, merge or deployment was attempted.

## Checks actually performed

| Check | Result and evidentiary limit |
| --- | --- |
| Read repository guidance and affected pipeline sources | Read `AGENTS.md`, `docs/design.md`, `docs/implementation-plan.md`, `ops/symphony/README.md`, workflow templates, supervisor, intake and offline tests; also package scripts and Playwright config. No `docs/architecture.md`, more specific AGENTS or repository PR template was found. |
| Read required manual procedures | Read `/Users/wahabma/happybearlandia/tools/symphony/local/PROCEDURES.md`. No absent skill is claimed to have run. |
| Local isolation checks | Inline Python checked a real independent `.git` directory, Git/common directory containment, no object alternates and no symlinks in Git metadata. These reproduce the inspected `check-isolation.sh` assertions; the host script itself was not executed, as the ticket prohibits host scripts. |
| `python3 -m unittest discover -s ops/symphony -p test_pipeline.py -v` | **8 passed. Offline only.** Covers worker bounds, render substitution, dry-run behavior, explicit scale acknowledgment, curated queue parsing, preview, missing-task rejection and dependent-task dispatch rejection. Expected argument-error messages appeared in passing negative tests. Does not exercise a live dispatcher, Codex launch or PR publisher. |
| `python3 ops/symphony/run_25h.py --tracker linear --workers 1` | **Exit 0. Offline dry-run only.** Rendered Linear configuration with one worker and the sprint base. No `--run` was supplied and no agent was launched. |

Initial bare `git` and `cat` invocations failed because the session PATH omitted
system tools. Commands succeeded after using absolute paths or setting
`PATH=/usr/bin:/bin`; this was a local command lookup issue.

## Configuration discrepancy and verification limits

The checked-in Linear template and dry-run use `hbl-agent-ready` and
`approval_policy: on-request`. The supplied pilot contract uses
`symphony-pilot`, a trusted host publisher, and this session's approval policy
is `never`. The template also describes worker-side push and tracker updates.
Those older template instructions were not used to authorize this pilot's
publication. The dry-run verifies template rendering, not the active host
configuration. No template or runtime source was changed by this ticket.

This is a documentation-only change. Launch-app, browser journeys, failure-path
UI checks and uploaded media are not applicable; Playwright was skipped because
browser behavior is unchanged. No repository lint or typecheck script is defined.
No live GitHub creation, CI result, PR review or post-publication workpad update
is claimed. The final local commit, whitespace-check results and handoff status
are recorded in the local workpad update for the host; a publisher receipt is
required before describing the complete Linear → Symphony → Codex → GitHub
pipeline as live-verified end to end.
