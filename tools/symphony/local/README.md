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
