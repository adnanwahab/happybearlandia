"""Run once through native Codex workspace-write: source writable, .git denied."""
import json
from pathlib import Path
import sys


def probe(path):
    source = path / '.hbl-handoff/source-permission-probe'
    source.write_text('source edit permission verified\n')
    assert source.read_text() == 'source edit permission verified\n'
    source.unlink()
    metadata = path / '.git/hbl-permission-probe'
    denied = False
    try:
        metadata.write_text('probe only')
    except PermissionError:
        denied = True
    else:
        metadata.unlink()
    result = {'sourceEdit': True, 'gitMetadataWriteDenied': denied}
    print(json.dumps(result))
    return 0 if denied else 2


if __name__ == '__main__':
    sys.exit(probe(Path.cwd()))
