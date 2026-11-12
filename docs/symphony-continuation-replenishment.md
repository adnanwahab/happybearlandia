# Guarded backlog continuation and replenishment

## Investigation and ownership

The user renewed continuous backlog execution on November11,2026. Actual installed
source, native/local tests, AGENTS, design/implementation/demo docs, Linear,
GitHub PR36/37, process inventory and the existing Codex chats were inspected.
PR36 and PR37 are merged; this is a narrow follow-up, not a second coordinator.

| Owner | Exclusive scope | Dependencies / limitations |
| --- | --- | --- |
| Runtime coordinator (this change) | Native runner/hook-result parking, workflow agent limits, cached observation, redacted metrics/config diagnostics | Host hook contract and resource clearance |
| Host Git repair coordinator | Publisher, workpad, prepare/isolation hooks, source-only handoff; retained SHE121 publication | Tests, private exact-file assignment and authenticated host invocation |
| Two-ticket readiness coordinator | SHE83/SHE142 duplicate, ownership, prerequisites and exact scope approval | SHE79/141 Done verified; no pressure-release approval inferred |
| Existing product/release chats | Their existing files, worktrees and implementation claims | Their absence from a running process list does not release ownership |

The five older product chat/worktree identities in the worker ledger are
historical, not five demonstrated active worker processes. Fresh app inventory
also showed active release verification, host-Git repair and two-ticket readiness
chats; their exact ownership was read before reserving work. No chat was paused,
archived or restarted. Private process/VM evidence was retained without prompts,
credentials or environment dumps.

## Exact causes of idle capacity

The retry queue was empty because no job was executing; it was not proof of no
work. The authoritative coordinator had empty trusted readiness reviews,
`enableApprovals:false`, no overlap reconciliation and no leases. The runtime
required BOTH `symphony-pilot` and `symphony-pressure-release`. During this audit,
pilot labels appeared on SHE83/SHE142 from another writer; neither was given the
pressure-release label by this coordinator. Missing approvals,26reserved active
claims/unknown ownership, review backlog and actual memory pressure independently
hold dispatch. Native prerequisites SHE79/141 being Done removes only one gate.

An external edit changed the active file to cap2 and a legacy inline clone under
`~/code/symphony-isolated-v2`, while installed publisher ROOT still targeted
`~/code/symphony-pilot-isolated`. An external process restart ran `./bin/symphony`
asPID97590. The coordinator restored cap1 and preserved the pressure guard; the
host-Git owner is responsible for the reviewed source-only root/hook install.
The runtime/configuration diagnostics added here expose the loaded workflow path,
workspace root, required labels, max workers and max turns, excluding secrets.

Resource diagnosis:16GiBphysicalRAM,~19.3GiBusedswap with~717MiBswapheadroom,
kernel`memorystatus_vm_pressure_level=2`(warning), and compressed memory around
6GiB. The command-line free-memory percentage was32%; that does not cancel the
kernel warning or imply headroom for another model/browser process. A5-second
VM sample saw80swapins,0swapouts,28pageouts. No applications were killed, no
memory-pressure allocation was run, and no resource gate was loosened.

## Delivered lifecycle behavior

The installed native runner previously invoked after_run only after all turns.
The local workflow leaves completed handoff In Progress and labelled until the
host publishes. Raising max_turns1→20 without a guard could therefore repeat a
finished implementation19times and delay its publication. After-run failures were
also logged and discarded, producing a normal1-second implementation restart.

The pinned overlay now reads only bounded local data between successful turns.
Canonical `.hbl-handoff/workpad.json` has statusprogress/blocked/handoff and nonblank
notes≤40000characters; terminal statuses end the session promptly. Legacy `.git`
handoff input remains read-only recovery support. Malformed/oversized JSON,
symlinked file/parent and invalid status fail closed. A model-authored stop request
never authorizes publication. The trusted host alone validates the exact files,
base, tests and version2publish handoff.

Incomplete work retains the same app-server thread and workspace up to20turns.
The host after_run still executes exactly once in the finalizer. Failure emits
`:host_handoff_blocked`, raises a sanitized error and reuses the existing blocked
orchestrator state. Polling keeps that issue parked without a new implementation
retry; operator publication recovery preserves its work. A process restart still
requires the host prepare guard for terminal/pending publication. This overlay
is for the observed local worker profile; SSH handoff reads are not implemented.

This is a deliberate local contract amendment to the upstream best-effort
`after_run` policy: publication/workpad failure must not look like successful
implementation completion. Before enabling20, the host owner must enforce that
terminal handoff without valid publish data fails unless an authoritative private
completion receipt already exists, and prepare must refuse terminal pending work.

## Cached observation, fresh authority

The existing single scheduler is reused. Read-only mode caches the complete
versioned inventory for at most300seconds, with fresh runtime/resources each
cycle. Cache age/hit/TTL are projected separately; API counts describe the last
full authoritative scan, not a fictitious new zero-query scan. Private snapshot
receipts are mode0600 under a mode0700directory, reject links and unsafe owners,
and are fsynced/atomically replaced. Corrupt/stale/future/incomplete data triggers
refresh. A failed refresh preserves the old receipt without serving stale data.
Explicit invalidation retains the prior snapshot as evidence.

Apply mode NEVER reads the cache: both its original initial inventory and its
mandatory pre-mutation inventory remain authoritative. No completion-event feed
is invented. Existing post-grant runtime refresh remains; periodic full inventory
is fallback. An approved ready buffer can include only genuinely independent
verified tasks; this change does not manufacture two executable approvals to
satisfy a queue target while ownership/resource holds remain.

## Install, verification and rollback

The native application is local and untracked by sprint, so the PR carries a
pinned minimal source patch, exact checksums, two new native tests and a safe
installer instead of vendoring the runtime. Check first:

```sh
python3 tools/symphony/local/install_lifecycle_overlay.py \
  --elixir-root /Users/wahabma/happybearlandia/tools/symphony/elixir
python3 -W error::ResourceWarning -m unittest discover \
  -s tools/symphony/local -p 'test_*.py'
```

Apply requires `--apply --backup /absolute/new/private/backup`; all pinned source
must match before any replacement. Different upstream/newer source or tests are
preserved for reconciliation. `--restore --backup <same-directory>` verifies all
installed/backupchecksums before restoring old source; new focused tests remain
as useful evidence. No workspace or lease cleanup is performed.

Verify zero actual running/retrying workers before stopping the exact listening
runtime PID. Run required native build/formatter/strictCredo/fulltests/100%coverage/
Dialyzer offline, copy the escript to a unique versioned host path, then launch
only that executable. Never overwrite a running escript and never start a second
dispatcher. Keep cap1 and both label filters during the repair. Enable20 only after
all lifecycle and strict host-terminal guards pass. Restore the previous turn
setting/source from private backups if validation fails.

Keep the existing host-authenticated observer read-only until readiness and
physical resources pass. For a safe read-only check:

```sh
python3 tools/symphony/local/throughput_scheduler.py --once \
  --workflow /Users/wahabma/happybearlandia/tools/symphony/elixir/WORKFLOW.md \
  --evidence "$HOME/.local/state/hbl-publisher/backlog-coordinator/she180-activation-readiness.json"
```

No worker, pressure-release label, merge, deployment or production mutation is
authorized merely by this command. The existing readiness workflow and exact
issue authorization remain required for apply. SHE121 retained tested output may
be published by the host owner without launching a model, but that is publication
recovery rather than an observed running Symphony implementation worker.

## Actual verification checkpoint

`make all` passed on the installed native application after the source-only hooks
were installed:310tests,0failures,6existing skips; formatter, strictCredo/specs,
100%configuredcoverage andDialyzer passed. Existing AgentRunner/Workspace coverage
exclusions were unchanged; the new fake-appserver fixtures independently exercise
20turns, one thread/workspace, terminal-stop-atone, malformed input and hookerrors.
A realOTP parking regression proves no implementation retry on the nextpoll.
Standalone integrated package:173tests passed on the workflow's
actual `/usr/bin/python3`3.9, with ResourceWarning treated as an error. The full installed host suite passed213tests. The Python3.9
HTTPError-with-no-response cleanup regression found by the host owner was fixed
without masking the original network error. Initial strictlint and legacyhook
assertion failures were corrected; no assertion/coverage threshold was waived.

At this checkpoint the active native setting is max_turns20, maxworkers1, both
required labels retained. A zero-worker guarded stop preceded the offline build;
PID15747 runs the unique host `20261111-lifecycle-v1/symphony` executable. This
proves installed lifecycle/configuration and preserves the hold, not a live model
completion experiment. Remaining blocked candidates are:

| Candidate | Verified prerequisites | Current dispatch state |
| --- | --- | --- |
| SHE83 | SHE79 Done | Explicit user approval; new four-file receipt scope; source-only preflight/resource/active-claim audit pending |
| SHE142 | SHE141 Done; HBL-1M-014 mapped to it | Explicit user approval; new five-file scalar oracle scope; same preflight/resource holds |
| SHE84 | SHE83 stillTodo | Blocked receipt prerequisite; no reassigned owner |
| SHE143 | SHE141 Done; SHE142 andSHE171 stillTodo | Blocked oracle/benchmark prerequisites; no reassigned owner |
| SHE126 | No native prerequisite | Existing coordinator's active documentation reservation; not reallocated |

The readiness owner staged two records and25externalclaims in the private
`she83-she142-readiness.json`; activationReady=false andblank cleanBaseEvidence
truthfully preserve the missing source-only issue clones. They idempotently
ensured pilot labels only; external pilotlabels already existed. No pressurelabel
or modelclaim was added. The current active readiness file remains separate and
disabled. These are five next candidates, not five eligible executable tasks.

## Final isolation, interference and recovery evidence

Adversarial review found and fixed interrupted-install rollback: restore accepts
only exact pinned before/after states per original file, handles missing new tests,
rejects unknown edits, and can be repeated. Actual pinned-source apply/restore/
repeated-restore passed in a disposable copy. Handoff parent validation now happens
before probing its child, so even a symlink to an empty directory fails closed.
Cache validation rejects malformed normalized fields/duplicate identifiers and
bounds both receipt parsing and serialization at32MiB, preserving prior evidence
on an oversize hold.15cachetests passed.

The actual app-server configuration still contained a legacy implicit `.git`
writable-root exception, despite the separate standard-profile probe rejecting
metadata writes. The native schema now defaults to only the canonical workspace
root. Existing explicit operator root-list semantics remain unchanged; the active
profile configures no extra roots.55configurationtests passed, including the
public Config helper and the actual runtime-settings path. The final full native
`make all` again passed310/0fail/6skip and100%configuredcoverage.

The user confirmed another terminal intentionally edits/restarts Symphony. It
changed the cap to3, removed the second label filter and replaced the process
while verification was ongoing. Configuration snapshots and retry evidence were
preserved. Missing host assignments rejected SHE83/142 (and an unrelatedSHE165)
before any Codex tokens. Guards correctly refused manual publication and exact-PID
shutdown when their prerequisites changed; those refusals are not claimed as
successful operations. The identified idle replacement was then stopped safely.

Authoritative runtime is now PID26040, versioned `20261111-lifecycle-v2/symphony`,
with its PRIVATE PINNED `WORKFLOW.md` in the same host directory (mode0400), cap1,
max_turns20 and both labels. The shared repository workflow is now a template,
not the effective running file. Its future edits do not reconfigure this process.
The user was asked to pause the competing terminal's restarts, not delete its
workspaces. The API reports the actual pinned workflow path. Cached read-only
observerPID26942 (`20261111-observer-v4`) uses that same pinned file, never apply.
No blanket approval or pressure release was added.

Real host publication recovery produced OPEN/DRAFT PR40 at
4845c3dadc1cc32c6d6e42b64cf6583410884b79, linked to SHE121 with a durable published
receipt. This was retained worker implementation with6unit/27assertions and7host
browser checks, not a fresh model run. Native logs show the external runtime's
before_run correctly rejected its pending terminal handoff, then its after_run
published the retained work. The coordinator's manual command had not run then.
A later ONE retry was explicitly approved by the user and invoked once; it exited1
with a sanitized PublicationError. The published receipt/PR remained intact; live
idempotence is not claimed passed. The host owner is fixing CLI exception identity
so expected policy errors retain their safe diagnostic instead of looking like
an unspecified transport interruption. No second retry is inferred from that
one-use approval.

Source backup manifests are under
`/private/tmp/hbl-drain-lifecycle-installed-backup-20261111` and
`/private/tmp/hbl-drain-host-package-backup-20261111`; original workflow snapshots,
core test and local source/spec documentation are under
`/private/tmp/hbl-drain-runtime-backup-20261111`. Native readme/spec changes are
represented by the pinned source patch and supplemental `lifecycle-spec.patch`.
`continuation-workflow.patch` records only the20turn setting, separate from the
host owner's root/hook changes. For this installed run, observation commands must
use `$HOME/.local/state/hbl-publisher/throughput-runtime/20261111-lifecycle-v2/WORKFLOW.md`
as `--workflow`; do not restart from the concurrently edited shared template.

The publisher owner subsequently fixed canonical CLI module identity and added an
actual child-process regression. Its133focused tests and the full installed
Python3.9suite214tests passed. The original live failure's safe cause was not
retained, so it is not attributed to authentication. A read-only check using the
publisher's exact trusted environment confirmed GitHub auth status exit0 and host
Linear-key presence, without logging credentials. PR40 remains open/draft; no
second live retry was performed. The repair is separately reviewable in PR42.

Three actual cached-observer cycles completed: first full scan18logicalLinearreads,
35GitHubcommands/0GitHubretries/35.660seconds; two subsequent complete-inventory
observations were cachehits (age130.409seconds at the third). Those are avoided
inventory scans, not measured delivery throughput. Resources/runtime were freshly
sampled while the queue stayed held. New metrics distinguish60second observation
interval from300second full-inventory cacheTTL. First-pass CI, issue-completion
rates and accepted throughput remain unavailable without trustworthy outcome data.
