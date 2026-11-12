# HappyBearLandia trusted host backlog coordinator

See [COORDINATOR.md](COORDINATOR.md) for installation, readiness evidence,
read-only audits, lease recovery and the controlled activation procedure.

`coordinator_host.py` contains only the sanitized Linear transport and private-file
helpers extracted from the already installed host publisher/workpad integration.
The coordinator can therefore be tested from this repository without copying the
full external Symphony runtime. Existing host publisher/workpad hooks are unchanged;
this PR neither installs nor replaces that runtime.

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
