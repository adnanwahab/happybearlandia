# SHE-256: measured concurrency decision gate

## Decision as of 2026-11-12

Keep concurrency at 1. No candidate above 1 has a measured passing run.
This is a decision ticket, explicitly marked **Do not dispatch**. The issue
requires a test budget before starting. No paid experiment or PR creation was
started for this ticket; disposable Linear/GitHub targets and budget are pending.
The live backlog, approvals, labels and workflow are unchanged.

| Candidate | Measured runs | PRs opened | Conflicts | Failed checks | Run time | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | None | Unknown | Unknown | Unknown | Unknown | Not tested |
| 6 | None | Unknown | Unknown | Unknown | Unknown | Not tested |
| 8 | None | Unknown | Unknown | Unknown | Unknown | Not tested |
| 12 | None | Unknown | Unknown | Unknown | Unknown | Not tested |

Highest passing candidate: **none**; conflict count unavailable. The historical
measured concurrency of 1 is a baseline observation, not a passing comparative
benchmark. Missing observations must not be recorded as zero failures.

## Proposed bounded experiment (awaiting budget and targets)

1. Agree the compute/cost ceiling, wall-clock limit, maximum PR count, model and
   effort settings, and authorized disposable Linear project and GitHub repo.
   A concrete initial proposal is five windows (1, 4, 6, 8, 12), each with 12
   matched tasks, at most 60 draft PRs total, 30 minutes per window and no
   automatic retries. This bounds wall time at 150 minutes and scheduled worker
   time at 15.5 hours, excluding setup/CI; a separate monetary cap is required.
   These are proposed limits, not authorized expenditure or measured timings.
2. Use a separate Symphony instance/workspace root and explicit disposable target
   allowlist. Use the normal readiness, isolated workspace, source handoff,
   trusted publisher and checks. Do not copy the template unchanged: its clone
   hook and PR destination point to the live sprint. Verify every tracker,
   clone, publication and CI destination before starting. Retain live holds.
3. Pin runtime, policy, model, task corpus and base SHA. Repeat the same 12
   representative tasks from a clean disposable base for each window, using
   distinct issue/branch identities mapped to the same task IDs. Include
   independent edits and explicitly assigned shared-file integration cases.
   Record any random seeds, or mark sampling nondeterministic. Drain a window
   before starting the next. Stop at the first unsafe failure or budget limit;
   later candidates remain untested until a new authorized window.
4. Record UTC start/end, monotonic duration, configured and actual peak concurrent
   working agents, task/issue IDs, PR URLs, head/base SHAs, first check attempts
   and final outcomes, worker-hours, resource peaks and retry counts. A configured
   cap without observed occupancy at that value does not measure that candidate.
   Count distinct PRs opened, PRs with integration conflicts against the evolving
   disposable integration branch, and failed check attempts (including later
   recovered failures). List pending, cancelled, timed-out and missing checks
   separately. Integration trials affect only the disposable branch.
5. Proposed pass rule: all 12 tasks publish exactly one valid PR each, required
   checks finish green on the tested heads, zero conflicts, zero failed check
   attempts, no duplicate claims or out-of-scope edits, no resource/ownership gate
   violations, and accepted changes per worker-hour at least the matched cap-1
   baseline. Human review determines accepted changes. Missing evidence or a
   timeout cannot pass. Agree this rule before spending compute; one short
   synthetic corpus supports a limited decision, not sustained live capacity.
6. Replace the table with source-linked observations, attach sanitized run
   manifests, and post results on SHE-256, including highest passing candidate
   and its conflict count. A human alone decides whether to edit the workflow;
   a passing test does not enable approvals or release live tickets.

## Existing gate and verification

`tools/symphony/local/throughput_policy.py` holds modeled 4/6/8/12 requests at 1
without operator scaling evidence and holds all new grants under unsafe resource
readings. Its existing evidence schema is not a per-candidate experiment ledger;
an operator assertion is not independent measurement. This report is the manual
decision gate and does not claim a new machine-enforced evidence validator.

On 2026-11-12 the checked-in `tools/symphony/elixir/WORKFLOW.md` declares
`max_concurrent_agents: 1` and `approval_policy: never`. This is a source-file
inspection, not a fresh observation of the running host. Eight focused policy
tests passed; those tests exercise synthetic resource/evidence inputs and do not
measure Symphony worker capacity.

## Rollback to 1

The human operator sets `agent.max_concurrent_agents: 1` in the **actual loaded**
workflow, verifies the effective cap via the runtime state/config, and verifies
new grants remain bounded at 1. Preserve approvals and label holds. If restart
is needed, first hold new dispatch and drain/reconcile existing work, then use
the existing single-runtime restart procedure. Lowering a cap does not cancel
workers already running: retain their leases, workspaces and PRs, and admit no
additional work while occupancy exceeds 1. Never start a second dispatcher.
