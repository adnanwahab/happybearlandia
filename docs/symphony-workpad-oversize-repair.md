# Host workpad oversize retry-loop repair

Observed recovery evidence: SHE-141's handoff notes contained42,212characters,
exceeding the40,000-character workpad contract. after_run refused the update but
retained a pending file; before_run then refused that same file on repeated
attempts without parking execution approval. Another owner recovered the actual
issue; this repair did not inspect or change its source, metadata or publication.

The shared repository did not contain the installed workpad/publisher modules.
This package versions the existing runtime dependency `publish.py` unchanged and
the existing workpad implementation with this narrowly scoped repair. Existing
transport/identity behavior is covered by the added original tests. There is no
workflow, scheduler, CI, model, sandbox or GitHub publication-policy modification.

## Changed behavior

- Both before/after phases inspect a valid pending update for notes above40000chars
  before the normal pending-update guard can refuse another worker attempt.
- Exact original JSON bytes are atomically archived/fsynced under host-private
  `~/.local/state/hbl-publisher/rejected-workpads/`, mode600/directory700, named by
  immutable issue ID hash and SHA256 of the bytes. Existing archives are verified
  and reused; corrupt/interrupted state is not silently overwritten.
- A compare guard detects replacement during archive creation before parking.
  The host removes only symphony-pilot, preserving pressure and unrelated labels.
  Parking happens before comment IO; a comment API failure therefore cannot keep
  a known-invalid oversized request eligible for unattended retries.
- The existing workpad body/history stays intact. One bounded rejection receipt
  per digest explicitly states no publication was attempted. The pending update,
  publisher JSON, source and commits are never overwritten/deleted by rejection.
- Main returns2 for a blocked result; the existing shell after_run short-circuits
  before the publisher. A real fresh-process shell test verifies the publisher
  spy is not executed. No success or completed implementation is fabricated.

Exactly40000characters follow the existing normal handoff path. This repair does
not alter generic malformed-JSON recovery, arbitrary tracker outages or other
readiness gates. If durable archival or label removal fails, the host reports an
error and preserves input; it must not claim the issue was parked. A comment
failure after parking can be retried manually without losing the archive.

## Operator recovery

Keep the issue parked while inspecting the private full archive and retained
work. Supply concise current-session notes instead of copying the entire old
history. Flush them using the trusted host, verify the exact publisher request
matches the current implementation HEAD and actual tests, then explicitly reapprove
only if another attempt is required. Never truncate/delete original recovery
artifacts or infer that publication succeeded from a worker exit. Workflow and
runtime owners retain their existing guards, including resource-pressure holds.
No worker or additional clone was started for this repair.

## Verification scope

The106-test installed-host suite and35focused workpad tests passed after the
runtime owner independently resolved an older exact-label assertion. Earlier
failure evidence is retained: the workflow gained symphony-pressure-release while
an existing publisher test still expected the old single-label string. This task
did not revert that hold or edit the workflow/test assertion. Browser checks are
inapplicable to this host-only change. Standalone package results and source hashes
are recorded in docs/evidence/workpad-oversize-evidence.json.

Latest rerun: installed host164passed; clean standalone package92passed.
The installed suite grew through independent work; the earlier106pass and one
prior external exact-label failure are source/time-qualified historical results.
