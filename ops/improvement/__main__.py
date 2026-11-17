"""Default dry-run: python3 -m ops.improvement --input BATCH [--record]."""
import argparse
import json
from pathlib import Path
from .inbox import ingest
from .proposal import InvalidProposal


def read_json(path, maximum):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise InvalidProposal('duplicate JSON key')
            result[key] = value
        return result
    def constant(_):
        raise InvalidProposal('nonfinite JSON value')
    try:
        with path.open('rb') as stream:
            raw = stream.read(maximum + 1)
        if len(raw) > maximum:
            raise InvalidProposal('input exceeds byte limit')
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)
    except (OSError, ValueError, UnicodeError, RecursionError) as error:
        if isinstance(error, InvalidProposal):
            raise
        raise InvalidProposal('input unavailable or invalid JSON') from None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--state-dir', type=Path, default=Path.home() / '.local/state/hbl-improvement')
    parser.add_argument('--coordinator-report', type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--record', action='store_true', help='Persist locally; never writes Linear or GitHub')
    mode.add_argument('--dry-run', action='store_true', help='Default: plan without changing state')
    parser.add_argument('--daily-limit', type=int, default=20)
    args = parser.parse_args(argv)
    try:
        batch = read_json(args.input, 1024 * 1024)
        report = read_json(args.coordinator_report, 32 * 1024 * 1024) if args.coordinator_report else None
        result = ingest(batch, args.state_dir, record=args.record, coordinator_report=report, daily_limit=args.daily_limit)
    except InvalidProposal as error:
        print(json.dumps({'schemaVersion': 'improvement-intake-report.v1', 'status': 'HELD',
                          'error': str(error), 'remoteWrites': 0}))
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
