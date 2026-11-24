"""Shared settings for the City Systems Map data generator.

Every value that changes the generated data lives here: the data version, the
random seeds and the pinned public source files. Bump VERSION whenever a change
here or in a step script changes the output in data/city-systems-map/.
"""
import sys
from pathlib import Path

VERSION = 'city-systems-map.1'

# numpy.random.default_rng seeds for the two steps that draw random numbers.
SEED_BUILDINGS = 7
SEED_SYSTEMS = 42

# Public sample files from vis.gl's example-data repository (MIT licence),
# pinned to one commit and checked by SHA-256 before use.
DECK_GL_DATA_COMMIT = 'a85a4ab3c578e36af1decfd0a46fb713459301bf'
DECK_GL_DATA_URL = f'https://raw.githubusercontent.com/visgl/deck.gl-data/{DECK_GL_DATA_COMMIT}/'
SOURCES = {
    'buildings.json': {
        'path': 'examples/trips/buildings.json',
        'sha256': '446b67495e58d2925eeeca34a80b6814af25a6de15cd71d306216a4327d03222',
        'use': '999 Lower Manhattan building footprints with heights',
        'upstream': 'deck.gl trips example; upstream source not documented by vis.gl',
    },
    'trips-v7.json': {
        'path': 'examples/trips/trips-v7.json',
        'sha256': 'e5ec75520944b79731dfa3a316fd3b40f23d84685fef5fa5342816586b9d54f8',
        'use': 'Taxi trip paths and timestamps; the street network is traced from these paths',
        'upstream': 'NYC Taxi & Limousine Commission trip records, as sampled for the deck.gl trips example',
    },
    'manhattan.json': {
        'path': 'examples/scatterplot/manhattan.json',
        'sha256': '593a3cf13f04e0dfc4e562259ade744667510bb436addbc269027d6b70834d92',
        'use': 'Resident dots for Manhattan',
        'upstream': 'US Census population sample, as prepared for the deck.gl scatterplot example',
    },
}


def cache_paths():
    """Raw, work and out directories under the cache directory given as argv[1]."""
    if len(sys.argv) < 2:
        sys.exit('Run scripts/city-systems-map/build.py, which passes the cache directory to each step.')
    cache = Path(sys.argv[1])
    raw, work, out = cache / 'raw', cache / 'work', cache / 'out'
    for path in (work, out):
        path.mkdir(parents=True, exist_ok=True)
    return raw, work, out
