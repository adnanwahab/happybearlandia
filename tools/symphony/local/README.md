See [the measured throughput follow-up](../../../docs/symphony-throughput.md) for the guarded recurring scheduler, native dashboard overlay, verification and rollback.

# HappyBearLandia trusted host backlog coordinator

See [COORDINATOR.md](COORDINATOR.md) for installation, readiness evidence,
read-only audits, lease recovery and the controlled activation procedure.

`coordinator_host.py` contains only the sanitized Linear transport and private-file
helpers extracted from the already installed host publisher/workpad integration.
The coordinator can therefore be tested from this repository without copying the
full external Symphony runtime. The source-only publication integration below
adds the trusted publisher and hooks; native runtime lifecycle is maintained separately.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/symphony/local -p 'test_*.py' -v
```

The original80-test installed-host evidence and the fresh standalone-package test
log are attached under docs/evidence. They are distinct source-qualified runs.


## Oversized pending workpad repair

The versioned workpad/publisher runtime files mirror the already installed host
integration. `publish.py` is an unchanged runtime dependency, not a new publication
policy. The workpad repair archives an oversized update byte-for-byte before
parking only its pilot label. It leaves the original request, prior workpad history,
implementation and publisher handoff intact and returns nonzero before publication.
See [repair/recovery details](../../../docs/symphony-workpad-oversize-repair.md).
This PR does not install/rewrite hooks or change workflow/scheduler configuration.

## Source-only host Git handoff (current contract)

The current worker writes `.hbl-handoff/{workpad,publish}.json`, never `.git` or
Git commits. See [PROCEDURES.md](PROCEDURES.md). New independent clones use
`~/code/symphony-source-only`; all previous workspace roots are retained.
`prepare.py` and `host_git.py` require a host-private exact-file assignment,
current approved baseline and unchanged pilot approval. The host commits validated
source snapshots in private Git storage before using the existing idempotent
push/draft/Linear-link transport. Out-of-scope, ignored, unsafe or credential-like
files fail closed. No force pushes, main/sprint commits, production deployment,
worker Git write privileges or model-authored scope policy are introduced.
Historical worker-commit/.git-handoff procedures in older installations describe
legacy recovery only and are superseded for new workers by this contract.
