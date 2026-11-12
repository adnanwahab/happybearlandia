"""Prepare research context or intake model output into local draft triage."""
import argparse
import json
from pathlib import Path
from ops.improvement.__main__ import read_json
from ops.improvement.proposal import InvalidProposal
from . import prepare, submit, triage


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--context', type=Path)
    parser.add_argument('--triage', action='store_true', help='Read saved research drafts')
    parser.add_argument('--output', type=Path, help='Structured research-agent response')
    parser.add_argument('--record', action='store_true', help='Save drafts in local triage')
    parser.add_argument('--state-dir', type=Path, default=Path.home() / '.local/state/hbl-improvement')
    args = parser.parse_args(argv)
    try:
        if args.triage:
            if args.context or args.output or args.record:
                raise InvalidProposal('triage is read-only and takes no context or output')
            print(json.dumps(triage(args.state_dir), indent=2))
            return 0
        if not args.context:
            raise InvalidProposal('context required')
        if args.record and not args.output:
            raise InvalidProposal('record requires agent output')
        value = read_json(args.context, 1024 * 1024)
        result = submit(value, read_json(args.output, 1024 * 1024), args.state_dir,
                        record=args.record) if args.output else prepare(value)
        print(json.dumps(result, indent=2))
        return 0
    except InvalidProposal as error:
        print(json.dumps({'status': 'HELD', 'error': str(error), 'remoteWrites': 0}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
