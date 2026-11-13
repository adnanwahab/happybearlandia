"""Read-only research contract assessment; never runs experiment commands."""
import argparse
import json
from pathlib import Path
from ops.improvement.__main__ import read_json
from ops.improvement.proposal import InvalidProposal
from . import InvalidResearch, assess, validate_brief


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--brief', action='store_true')
    args = parser.parse_args(argv)
    try:
        value = read_json(args.input, 1024 * 1024)
        result = ({'briefDigest': validate_brief(value), 'lane': 'research',
                   'dispatchAuthorized': False} if args.brief else assess(value))
    except (InvalidResearch, InvalidProposal) as error:
        print(json.dumps({'status': 'HELD', 'error': str(error)}))
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result.get('status') != 'HELD' else 1


if __name__ == '__main__':
    raise SystemExit(main())
