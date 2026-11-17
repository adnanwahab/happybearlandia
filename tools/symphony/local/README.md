See [the measured throughput follow-up](../../../docs/symphony-throughput.md) for the guarded observer, native dashboard, tests and rollback.

# Local Linear draft-PR pilot

The separate [safe backlog coordinator](COORDINATOR.md) audits/replenishes approvals
through durable host leases. It defaults to dry-run and is not activated. It does
not alter the current workflow, worker concurrency, sandbox or trusted publisher.

The active configuration is `../elixir/WORKFLOW.md`. This directory is the repair
for that configuration, separate from the older ops/symphony 25-hour supervisor.
Do not use that supervisor or its worker-count defaults for this pilot.

## Trusted host workpad bootstrap and SHE-179 recovery

`before_run` now runs auth/isolation checks then `workpad.py before`, before
Codex starts. It lists all comment pages, reuses one workpad or creates it with
a UUIDv4 persisted in trusted host state, updates host status and moves Todo to
In Progress.
Multiple existing workpads fail clearly without deleting or choosing one. Missing
workpads are initialization work, never an implementation blocker. A local
`.git/hbl-workpad.md` snapshot contains no credentials. Codex writes only data to
`.git/hbl-workpad.json`: status progress/blocked/handoff and cumulative notes.
`after_run` applies that update before the existing trusted publisher. A blocked
update removes only the pilot label and stops publication. In Review stays an
operator decision. No local update means no workpad mutation after the turn.

Both hooks retain the publisher's per-issue host lock. Bootstrap also serializes
by immutable Linear issue ID under `~/.local/state/hbl-publisher/workpad-identities/`.
Host state directories are mode 0700; identity and lock files are mode 0600.
One UUIDv4 is written through a private temporary file, fsynced, atomically
renamed and directory-synced before any create request. Retries/restarts reuse
that receipt. Corrupt/non-v4/symlink state fails closed; never delete or regenerate
a pending identity to retry an ambiguous create. Existing live workpads are read
first and retained without replacing their IDs.

Ordinary transient Linear transport failures retry up to three times. Workpad
creates use one transport attempt at a time: bootstrap re-reads all comment pages
after every create response (including failure), before any repeat, and after the
last ambiguous attempt. A failed reconciliation read stops creation. Duplicate
live workpads are preserved for manual reconciliation. Deterministic validation
or auth failures do not trigger blind retries. Errors report HTTP status and
allowlisted GraphQL classifications/codes/validation field names; raw messages,
constraint values, response bodies, headers and credentials are never logged.
Comment updates set the refreshed body in place; state and label updates set the
same desired outcome. Pending failed updates are retained, and before_run rejects
them until host recovery. after_run errors are logged by Symphony, so stop on
errors and inspect hook logs; never interpret worker completion as publication.
Only run one dispatcher. External writers creating a workpad concurrently are
outside the local lock: stop and reconcile if multiple comments are found.
The host uses the existing publisher Linear transport; it never executes model
commands with Linear credentials. LINEAR_API_KEY is explicitly removed from the
Codex process in addition to the runner's tracker-secret scrubbing. Do not store
keys in workspace/config files readable by model commands.

Safe SHE-179 retry (operator actions, not executed by this repair):

1. Stop the dispatcher; preserve SHE-179's clone, files, commits and any handoffs.
   Audit current issue state, dependencies, owned files, labels and any PR.
   Keep only the approved issue eligible; do not remove the pilot filter.
2. Run the offline tests below and rebuild Symphony. With the host key available,
   from `~/code/symphony-pilot-isolated/SHE-179`, run
   `/usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/workpad.py before`.
   This is a remote write and requires operator authorization. It safely creates
   the missing workpad or reuses it. Inspect `.git/hbl-workpad.md`. If a pending
   update is reported, inspect its JSON then run `workpad.py after` first; exit 2
   means the issue was parked as blocked, not a publication failure. Resolve the
   blocker and explicitly reapprove before restarting.
3. Since the observed attempt produced no commit or publisher handoff, resume
   the preserved isolated clone through one normal approved Symphony attempt.
   Do not run publisher as a substitute for implementation. If a valid existing
   handoff is discovered, reconcile it and use the publisher-only retry below.
4. Watch hook errors and the host publisher receipt. Stop after the first handoff
   or error; verify the draft PR, exact SHA/base and workpad before human review.

Offline checks: `python3 -m unittest discover -s tools/symphony/local -p 'test_*.py'`
and `python3 tools/symphony/local/test_isolation.py`. No browser behavior changed.
Remote Linear acceptance/auth, eventual consistency and real publication remain
unexecuted; no remote issue was changed during this repair.

## Host publisher repair (current pilot instructions)

The verified sandbox cannot resolve api.github.com even with networkAccess=true.
GitHub publishing now runs exclusively in Symphony's host `after_run` hook using
`publish.py`. Codex stays workspace-write. It commits locally and submits the JSON
handoff described in WORKFLOW.md. `max_turns: 1` makes the host hook run after each
completed turn, rather than waiting for twenty turns. No handoff means no remote
operation. Normal Symphony continuation handles incomplete local work.

Host preflight rejects standard plaintext GitHub credential files. Use the normal
macOS gh Keychain login, not GH_TOKEN/GITHUB_TOKEN or plaintext hosts.yml tokens.
The Codex command unsets GitHub token variables and model shell environment
inheritance is disabled. GitHub credentials are never put in a request, workspace,
command argument or log. This guard covers standard gh, git-credentials and netrc
locations; operators must not place credential copies in other model-readable
files. Existing host Keychain authentication is reused; no token extraction.

The publisher validates SHE issue identity, canonical direct-child workspace,
independent metadata, exact branch, commit, clean index/worktree, allowlisted
origin, approved Linear label and single persistent workpad. Authenticated Git
uses temporary host-owned configuration and reads only workspace Git objects;
workspace credential helpers, remotes and hooks are not executed. Push uses a
full SHA and explicit issue ref without force. Current sprint base must be an
ancestor. Closed/merged/non-draft/wrong-base/duplicate PRs block publication.

A per-issue host lock serializes publication. Each retry queries all PR states
before create and reconciles ambiguous create failures. A matching existing PR
repairs the workpad without another push or PR. After linking, the host removes
only `symphony-pilot`, preserving other labels and parking further dispatch. The
issue stays active until an operator verifies checks/media/review and moves it
to In Review. There is no unattended merge, ready-for-review or deployment path.
Publication errors are recorded in the host receipt and hook logs. after_run
hook errors are logged but intentionally ignored by Symphony's existing hook
contract: inspect the receipt, stop the dispatcher on errors, and retry only the
publisher after correction. Do not requeue an agent just to retry publication.

Exact operator sequence (no live steps executed during this repair):

1. Stop the existing dispatcher; preserve all old workspaces. Audit one isolated
   SHE issue, dependencies, owned files, tests/media; the host initializes a missing workpad.
   Keep exactly one approved active issue labeled `symphony-pilot`.
2. In the normal macOS shell verify `gh auth status` and
   `gh repo view adnanwahab/happybearlandia`. Verify the sprint base exists:
   `gh api repos/adnanwahab/happybearlandia/git/ref/heads/sprint/one-city-two-futures-20261111`.
   Ensure LINEAR_API_KEY is available to Symphony, standard gh auth uses Keychain,
   and no custom token files are readable by model commands. Run:

   ```sh
   cd /Users/wahabma/happybearlandia
   python3 tools/symphony/local/check-host-auth.py
   python3 tools/symphony/local/test_publish.py
   python3 tools/symphony/local/test_isolation.py
   cd tools/symphony/elixir
   export PATH="$HOME/.local/share/mise/installs/elixir/1.19.5-otp-28/bin:$HOME/.local/share/mise/installs/erlang/28/bin:$PATH"
   export MIX_HOME="$HOME/.local/share/mise/installs/elixir/1.19.5-otp-28/.mix"
   export MIX_ARCHIVES="$MIX_HOME/archives"
   mix test
   mix build
   ```
3. When authorizing the real pilot, start the rebuilt dispatcher in that same
   host shell, with standard Keychain gh authentication and LINEAR_API_KEY:

   ```sh
   env -u GH_TOKEN -u GITHUB_TOKEN -u GH_ENTERPRISE_TOKEN -u GITHUB_ENTERPRISE_TOKEN ./bin/symphony --i-understand-that-this-will-be-running-without-the-usual-guardrails --port 43111 /Users/wahabma/happybearlandia/tools/symphony/elixir/WORKFLOW.md
   ```
4. Watch the dashboard and `~/.local/state/hbl-publisher/SHE-<number>.json`.
   Stop with Ctrl-C after `published` or any publication error. On success verify
   draft=true, exact sprint base/HEAD, tests/checks/media and the existing workpad
   link, then manually move to In Review. The publisher parks successful issues
   by removing their pilot label; the dispatch filter remains unchanged.
5. On an error, stop the dispatcher first. Correct the reported host auth,
   connectivity, branch/base divergence or Linear permission problem. Retry from
   the existing clone, without starting an agent or creating a replacement:

   ```sh
   cd "$HOME/code/symphony-pilot-isolated/SHE-<number>"
   /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/publish.py
   ```

The receipt is the success authority, not a zero Symphony worker exit. A remote
create may have succeeded before a timeout; always retry this publisher instead
of manually creating another PR. Validation does not certify ticket test claims:
operators still review acceptance evidence. Existing PR bodies are preserved on
retry; substantive new PR-body evidence requires operator review/edit.

The earlier validation record below describes the preceding isolation repair.
Its agent-side GitHub and automatic review-transition guidance is superseded by
this host-publisher section and the current WORKFLOW.md/PROCEDURES.md.

## Architecture and recovery

The old hook uses a shared bare repository under ~/.local/share/hbl-codex/shared-git.
A linked issue workspace contains a .git file pointing outside its writable root;
fetch writes FETCH_HEAD there and shared refs/objects also require write access.
Adding only FETCH_HEAD or the worktree-specific directory is insufficient. Adding
the entire shared common Git directory permits cross-issue ref/object mutation.
Current source-only workers use independent full clones with --no-local under
`~/code/symphony-source-only`, retaining workspace-write protection of `.git`.
The runner must grant only the canonical source workspace, with no explicit
`.git` exception. Fetch/branch/stage/commit/push are trusted-host operations.
Before-run rejects shared metadata, alternates and metadata symlinks.
Historical worker Git-write permission experiments below are superseded.

Backups: `backups/WORKFLOW.pre-pilot.md` and `backups/worktree-hook.pre-pilot.sh`.
The original external hook was read and copied, never edited. Existing issue
worktrees, branches, commits, workpads and credentials were not migrated.
Do not restore the old workflow while dispatching; it contains the unsafe review
and merge instructions. Stop the dispatcher before editing or recovery. To resume
old work, an operator must separately reconcile its branch/dirty files/workpad
and explicitly plan a lossless copy into an independent clone. Never delete,
reset or reuse an old workspace as a shortcut. The new root intentionally does
not rediscover SHE-81's old checkout.

Initial and fresh retry dispatch now reject unresolved dependency states for
all active states. Existing label filtering is enabled as `symphony-pilot`.
Missing dependency states fail closed. Ownership still requires operator audit;
there is no machine-readable file ownership contract in this workflow.

Review state changes remain agent instructions, not a server-side PR verifier.
The prompt requires a tested implementation, verified open draft PR at current
HEAD, sprint base, review sweep and passing checks before In Review. All blockers
stay active and remove the pilot label; failed tracker access needs operator
parking. In Review, Human Review and Merging are not dispatched. No agent merges.

## One safe pilot (operator actions; not executed by this repair)

1. Stop any existing Symphony instance manually before starting another. Check
   the existing logs/dashboard and preserve running work. Do not run two pollers
   against this project. This repair does not stop processes or reload a service.
2. Audit the candidate issue and existing workpad/PR. Resolve each dependency;
   specify owned files, shared interface owner, acceptance and required tests.
   Do not pilot SHE-81 until its preserved checkout and branch are reconciled.
   Ensure exactly ONE issue in Todo/In Progress/Rework has `symphony-pilot`.
   Apply that label manually only after this audit; no labels were changed here.
3. Verify Codex login, LINEAR_API_KEY availability, `gh auth status`, repository
   Git push permission and the sprint branch. Do not print credentials. Confirm
   sufficient disk space (hook requires 10 GiB free by default), Bun/browser/test
   prerequisites and a reviewer-readable media channel for app issues.
4. From this checkout, validate/build using its installed toolchain:

   ```sh
   python3 tools/symphony/local/test_isolation.py
   cd tools/symphony/elixir
   # Use the installed repository toolchain, including its cached Hex archive.
   export PATH="$HOME/.local/share/mise/installs/elixir/1.19.5-otp-28/bin:$HOME/.local/share/mise/installs/erlang/28/bin:$PATH"
   export MIX_HOME="$HOME/.local/share/mise/installs/elixir/1.19.5-otp-28/.mix"
   export MIX_ARCHIVES="$MIX_HOME/archives"
   mix test
   mix build
   ```

5. Only when ready to authorize one real agent, run in the foreground:

   ```sh
   ./bin/symphony --i-understand-that-this-will-be-running-without-the-usual-guardrails --port 43111 /Users/wahabma/happybearlandia/tools/symphony/elixir/WORKFLOW.md
   ```

   The CLI acknowledgement is required by Symphony; it does not disable the
   configured Codex workspace-write sandbox. Concurrency remains one. The label
   filter limits eligibility, not the lifetime number of jobs: keep only one
   candidate labeled. Watch http://127.0.0.1:43111/ and the workpad. Stop with
   Ctrl-C after its draft handoff or blocker. Inspect remaining child processes
   before restarting. Symphony may retry active failed work; removing the pilot
   label parks it. Do not queue another pilot until review is complete.
6. Independently verify draft=true, sprint base, implementation diff, required
   tests/media/checks, correct Linear link and preserved workpad. A blocker must
   not enter In Review. Human reviews and authorizes any later merge separately.

## Validation record

Final validation: `make all` passed before the protected-Git refinement; after
that refinement, `make build fmt-check lint coverage dialyzer` passed again.
301 ExUnit tests, 0 failures, 6 opt-in live tests skipped. Configured coverage
was 100% (the project excludes several orchestration/runtime modules from that
metric); specs.check and strict Credo passed; Dialyzer reported 0 errors.
`python3 tools/symphony/local/test_isolation.py` passed, as did the sandboxed
fixture below, `sh -n` for both hooks, and `git diff --check`. Browser tests were
not run because no app/browser behavior changed. The dependency resolver emitted
security advisories for existing locked packages; no dependency upgrades were
made. No live pilot or GitHub/Linear write was performed. Offline fixtures do not prove remote auth, the app-server-specific sandbox
Git policy, media upload or end-to-end PR creation; the single pilot verifies
those remaining integration boundaries without expanding writable access.

Sandbox policy reference: [official OpenAI App Server documentation](https://learn.chatgpt.com/docs/app-server#start-a-turn) describes workspaceWrite with explicit writableRoots and boolean networkAccess. The source-only runner supplies only the canonical issue root; no explicit .git write exception is permitted.

## Read-only backlog audit (2026-11-11)

- [SHE-81](https://linear.app/shel-bernstein/issue/SHE-81): In Review, no PR
  attachment, and workpad 98141a0c-eb3e-472c-a0c1-1da459582d00 explicitly reports
  no implementation, commits or push. It records FETCH_HEAD outside the sandbox,
  absent skills, incomplete ownership audit and a historical gh 401. The workpad
  identifies potential cancellation boundaries in world/decision/api.js and
  world/city/api.js, but these are observations, not an approved ownership split.
  Preserve its checkout and workpad. Audit related changes and assign the queue
  API contract and UI stale-result owner before any requeue. GitHub auth must be
  rechecked; the historical failure is not proof of current auth status.
- [SHE-141](https://linear.app/shel-bernstein/issue/SHE-141) (HBL-1M-014): In Review,
  no PR attachment; defines the common metric contract and has many downstream
  blockers. Assign one contract owner and verify executable metrics/evidence
  before downstream implementation is considered ready.
- [SHE-170](https://linear.app/shel-bernstein/issue/SHE-170): In Review, no PR
  attachment; prose says it depends on HBL-1M-014, but structured blockedBy is
  empty. The runner cannot infer that relation. Operator must verify SHE-141's
  completed contract, map the dependency and approve worker/GPU scheduler file
  ownership before adding the pilot label. Description-only dependencies are
  explicitly checked by the workflow preflight as well.

These samples establish readiness gaps, not an exhaustive board/PR audit. No
issue state, label, relation, comment or workpad was changed. Do not bulk relabel
or move the existing review queue based on this repair. The team workpad reports
In Review exists but Human Review, Rework and Merging do not; the new handoff uses
In Review and has no alias-based blocker escape. Rework remains an optional
active-state name in configuration for installations that provide it.

The clone hook has a 10-minute timeout to allow independent full-history clones;
failures remain failures and do not produce a usable partial checkout. The
before_run isolation check also runs for resumed workspaces.

Offline sandbox fixture command (Codex 0.167.1; launches commands, no model):

```sh
HBL_TEST_CODEX_SANDBOX=1 HBL_CODEX_BIN="$(command -v codex)" python3 tools/symphony/local/test_isolation.py
```

The current source preflight uses native `codex sandbox -P :workspace` with
no metadata exception. `source_preflight.py` verifies source edits succeed and
Git metadata writes are denied. Real publication runs only in trusted host code;
actual app-server policy verification belongs to the native runtime tests.

## Authored file manifest

Relative to the HappyBearLandia checkout:

- docs/implementation-plan.md
- tools/symphony/README.md
- tools/symphony/SPEC.md
- tools/symphony/elixir/README.md
- tools/symphony/elixir/WORKFLOW.md
- tools/symphony/elixir/lib/symphony_elixir/config/schema.ex
- tools/symphony/elixir/lib/symphony_elixir/orchestrator.ex
- tools/symphony/elixir/test/symphony_elixir/core_test.exs
- tools/symphony/elixir/test/symphony_elixir/workspace_and_config_test.exs
- tools/symphony/local/README.md
- tools/symphony/local/PROCEDURES.md
- tools/symphony/local/isolated-checkout.sh
- tools/symphony/local/check-isolation.sh
- tools/symphony/local/test_isolation.py
- tools/symphony/local/backups/WORKFLOW.pre-pilot.md
- tools/symphony/local/backups/worktree-hook.pre-pilot.sh

Quality gates also rebuilt ignored bin/symphony, _build, cover and local tool
caches. The tools/symphony tree was already untracked at task start; ordinary
`git diff` therefore shows only the tracked implementation-plan change. Nothing
was staged, committed, pushed or remotely updated by this repair.


## Oversized pending workpad recovery

The host rejects notes above40000characters in either before_run or after_run.
It first durably archives the complete original JSON bytes under
`~/.local/state/hbl-publisher/rejected-workpads/` (mode600, directory700), keyed
by immutable issue ID and SHA256 of the exact bytes. It then removes only the
pilot label, preserving other labels including the pressure guard. This happens
before comment IO so a failed comment update cannot leave known-invalid work
eligible for an unattended retry loop. Existing workpad history is preserved;
a bounded rejection receipt is appended idempotently. Exit2 stops the existing
hook chain before the publisher; no publication success is implied.

The pending request and publisher JSON are never deleted or rewritten by this
rejection path. Retries reuse the archive/receipt. If an operator changes the
pending input during archiving, a comparison guard aborts before parking and
preserves the replacement. Archive/label/comment failures report failure without
claiming success; an archive error does not remove the only copy of the input.
A comment failure after label removal leaves the issue parked and can be retried
manually using the same after phase. Verify parked state if tracker access fails.

The recovery owner must inspect the complete archive and preserved implementation,
prepare concise bounded current-session notes (do not copy all prior history),
flush that update with the trusted host, revalidate the exact publisher handoff
against current HEAD, and only then explicitly reapprove if required. Never
truncate or overwrite the original recovery artifacts or implementation commits.
Exactly40000characters still follow the existing successful update path. No
workflow/scheduler change or live issue recovery was performed by this repair.

## Current source-only publication

See PROCEDURES.md. Workers write `.hbl-handoff` data only. Trusted private exact-file assignments and the pinned sprint baseline control host Git publication. Earlier `.git` handoff/worker commit instructions are historical recovery only and are superseded. No worker Git write exception, force push, merge or deployment is authorized.

### Operator swap ceiling update (2026-11-12)

The installed admission hook and scheduler policy use an inclusive 16 GiB swap-used ceiling. This changes only the absolute swap ceiling: paging-rate, swap-growth, pressure, headroom, CPU, disk, freshness, approval and concurrency gates remain required. Endpoint and intervening observations above the ceiling hold new grants. An already running scheduler imports policy at startup and requires its normal authenticated reload to adopt this change; the per-dispatch Python admission hook reads it on each invocation. No worker or orchestrator restart is authorized by this setting update.
