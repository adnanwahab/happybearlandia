# Trusted assignment lifecycle and supervision

This extends `backlog_coordinator.cycle`; it is not another approval service.
Use the existing scheduler's `--watch` loop. Observation remains read-only;
`--apply` still requires enabled private readiness evidence and every existing
resource, capacity, ownership, dependency and approval gate. No worker gets Git
metadata writes or host credentials. No production, merge or deployment action.

## Authority and admission

Use the existing host-private readiness format in COORDINATOR.md. Review UUID,
issue digest, exact approved base/branch/files/interfaces, reviewer identity,
freshness, source/PR/dependency audits, tests and acceptance must all pass. A label,
issue description or worker-authored handoff cannot supply a review. Source paths
must also satisfy the publisher's protected-path rules. `publishEnabled` starts
false; only independent validation can authorize publication.

The actual host inventory additionally includes fresh dashboard claims, retained
assignments and Git worktrees. Unknown runtime ownership holds. Worktree reviews
are in `worktreeReviews`, keyed by canonical checkout path, with `head`,
`sourceDigest`, `reviewedBy`, `expiresAt`, exact `files` and `interfaces`. An empty
scope means an operator actually reviewed a paused/read-only checkout, not that
this code inferred inactivity. `sourceDigest` binds current source metadata and
path ownership, including untracked/ignored state except Git/dependency stores;
no repository filters/hooks run. Any changed/unknown worktree holds for re-review.
The inventory is evidence to review, not authorization to manufacture those entries.

Under the durable coordinator lock, admission persists a pending lease and
`admission` journal, atomically fsyncs mode600 `assignments/SHE-N.json` in a700
private directory, then marks assignment-created before adding symphony-pilot.
Each assignment binds repository/base/baseCommit/issue/files/interfaces/reviewer,
expiry and review/issue digests. Per-issue locks exclude simultaneous publishers.
The full project/PR inventory and host ownership are rechecked before mutation.
The direct CLI and scheduler also recheck private operator evidence.

Crash before/after the policy replacement or label response retains an exact
predecessor/pending policy and recovers without replacing a newer policy. An
external assignment, changed review, unsafe permissions/symlink or independent
publication authorization is preserved and held rather than silently rewritten.
All original clones, branches, ignored state and snapshots stay intact.

Already-labeled issues go through the same review and host inventory checks. A
missing assignment is repaired only with that authority. Orphan labels are
reported under `assignmentMaintenance`; labels are never automatically removed.
Existing external policies are retained and require explicit compatible review
identity before this coordinator adopts them. No blanket requeue or approval.

## Explicit standing authorization

Normal review expiry never silently extends. An operator may explicitly add
`standingAuthorization` to an exact review with:

- `authorizationId`: actual operator approval reference;
- `authorizedBy`: identical to reviewedBy;
- `reviewDigest`: SHA256 of sorted JSON of the original full review excluding
  standingAuthorization (`assignment_lifecycle.checksum`);
- `revoked`: literal false;
- `validUntil`: finite Unix expiry within30days;
- `leaseSeconds`: integer60–86400.

The operator must actually authorize this; do not populate it from this example.
Every renewal revalidates issue digest, unchanged review/scope/base, dependency
readiness, current remote baseline, all ownership and execution state. Revocation,
changed evidence or an outside policy update holds. A standing grant does not
allow publication, baseline migration or changing assigned scope.

The existing scheduler can maintain only an already-owned active standing lease
under a new-grant/resource hold. That maintenance-only path cannot repair missing
policies, add labels or admit another task. It prevents the stale-lease watchdog
from making legitimate renewal impossible while preserving all dispatch holds.
Restart recovery checks exact old/new digests; it does not delete history.

Verified draft release additionally requires matching private published receipt,
terminal workpad phase, real same-repository issue-branch draft/commit/base, its
URL and SHA in the Linear workpad, absent execution label and no runtime claim.
An operator's explicit historical release still retains unfinished assignment
ownership. A PR mention or status alone does not release capacity.

## Disposable checks

```
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m unittest discover -s tools/symphony/local -p 'test_*.py'
```

Lifecycle tests use temporary private directories, fake Linear/GitHub inventories,
real lock/atomic files, interrupted creation/renewal/label responses, simultaneous
coordinator processes, and the actual scheduler. Supervisor tests render plist
artifacts and mock process exits; they never install or run a service.

## macOS launchd installation (operator handoff, not auto-activation)

The other terminal currently owns Symphony. **Do not bootstrap another runtime
while it is running.** Agree a lossless owner handoff, preserve logs/workspaces,
and stop its supervisor before installing these jobs. Rendering does not stop,
start or modify it. No launchd service is installed by the tests or renderer.

1. Review/install this package and its publisher/runtime dependencies. Preserve
   existing installed files and version/checksum them. Prefer a host-private
   versioned code directory; `supervisor.py`, scheduler and coordinator must use
   the same reviewed package. Private state is `~/.local/state/hbl-publisher`.
2. Prepare its `supervisor` and `supervisor/logs` directories mode700. Fill
   supervisor-config.example.json from actual host paths and save it as
   `supervisor/config.json`, mode600. The placeholder example is not runnable.
   Evidence remains in the existing private backlog-coordinator directory.
3. Reference a host-managed regular credential file `supervisor/linear.key`,
   already mode600. Supply its value through your private credential-management
   mechanism. Never paste it into a plist, source, shell argument or worker.
   The host uses existing macOS Keychain GitHub authentication. The model's
   workflow environment still strips LINEAR/GH credentials and inherits none.
4. Record canonical installed Node/Codex and Erlang/Elixir directories in
   `toolchainDirectories`; resolve installation aliases first. The bootstrap
   rejects worker paths and does not inherit a repository-controlled PATH.
   Verify the executable and actual workflow sandbox/filter with the runtime
   owner. CLI arguments match the installed Symphony CLI's supported options.
5. Keep coordinatorApply false and existing readiness enableApprovals false for
   the first dry-run. After reviewing actual holds, separately authorize applying
   only exact eligible reviews. Never use a service install as dispatch approval.
6. Render the two credential-free user LaunchAgent definitions:

```
/usr/bin/python3 ~/happybearlandia/tools/symphony/local/supervisor.py \
  --config ~/.local/state/hbl-publisher/supervisor/config.json --render /private/tmp/hbl-launchagents
plutil -lint /private/tmp/hbl-launchagents/*.plist
```

After the existing owner's explicit handoff, copy those two files to
`~/Library/LaunchAgents` and use `launchctl bootstrap gui/$(id -u) <plist>` for
each. Do not load both these and a previous Symphony job. Use `launchctl print`
to inspect the two labels `com.happybearlandia.coordinator` and
`com.happybearlandia.symphony`. Disable by booting out the exact job, preserving
its private logs and all workspaces. Never pkill other chats or clean sources.

launchd persists jobs over login/restart and throttles restarts60seconds. One
per-service flock, existing-coordinator inventory and the runtime-port check refuse duplicate wrapper instances
or an existing external listener. A private durable restart budget bounds failed child starts to3 across wrapper exits and machine restarts. Only a service observed healthy for300seconds resets it. Terminal HELD exits0 and selective KeepAlive does not restart it; an operator must review the cause, advance the private restartGeneration and explicitly kickstart the job. Retry waits are bounded at60seconds. The coordinator retains its own3-error policy and all
lease recovery. Health failures produce JSON codes and inspection actions;
the wrapper does not force-kill an active worker or publisher. SIGTERM forwards
to its own child and waits. No config/credential exception text is printed.
A user LaunchAgent requires that user's login/Keychain availability after reboot;
this is not a pre-login system daemon. An unavailable key or runtime holds safely.

## Controlled live verification

Run existing coordinator `--dry-run` against actual private evidence first.
Review `assignmentMaintenance`, all reasons, runtime and ownership inventory.
Missing approvals or resource holds remain blockers. Verify an actual Codex
running turn and model activity on one authorized task before considering more
workers. Keep the existing concurrency; no process-start or queue-only success
claim. The current terminal owner must explicitly coordinate any live activation.

The admission and publisher use one shared assignment validator, including the100file/64KiB/freshness limits. The issue publisher lock remains held through label lookup and remote addition; current policy digest, expiry and publishEnabled=false are rechecked at that final boundary. Public scheduler status contains only closed hold codes and aggregate queue counts. `approved` means a current trusted admission, `execution_labeled` is separately counted, and awaiting_review stays null when actual review decisions are unavailable.
