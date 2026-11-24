#!/usr/bin/env python3
"""Regenerate data/city-systems-map/ for the City Systems Map (/tools/city-systems-map).

    python3 -m pip install -r scripts/city-systems-map/requirements.txt
    python3 scripts/city-systems-map/build.py

Downloads the three pinned deck.gl sample files into the cache directory (once), refuses any file
whose SHA-256 does not match config.py, runs the four steps and replaces the JSON files in the
output directory. With the pinned package versions the output is byte-identical between runs.
"""
import argparse
import hashlib
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

import config

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
STEPS = ['geo.py', 'buildings.py', 'systems.py', 'export.py']


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch_sources(raw):
    raw.mkdir(parents=True, exist_ok=True)
    for name, source in config.SOURCES.items():
        target = raw / name
        if not target.exists() or sha256(target) != source['sha256']:
            url = config.DECK_GL_DATA_URL + source['path']
            print('downloading', url)
            with urllib.request.urlopen(url, timeout=120) as response:
                target.write_bytes(response.read())
        if sha256(target) != source['sha256']:
            sys.exit(f'{name}: checksum does not match config.py; refusing to build from it')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cache', type=Path, default=REPO / '.cache' / 'city-systems-map',
                        help='working directory for downloads and intermediate files')
    parser.add_argument('--out', type=Path, default=REPO / 'data' / 'city-systems-map',
                        help='directory that receives the generated JSON files')
    args = parser.parse_args()
    cache = args.cache.resolve()
    fetch_sources(cache / 'raw')
    for step in STEPS:
        print('running', step)
        subprocess.run([sys.executable, str(HERE / step), str(cache)], check=True)
    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob('*.json'):
        old.unlink()
    files = sorted((cache / 'out').glob('*.json'))
    for path in files:
        shutil.copy2(path, args.out / path.name)
    print(f'wrote {len(files)} files to {args.out}')


if __name__ == '__main__':
    main()
