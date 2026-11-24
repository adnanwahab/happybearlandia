"""Step 4: write one JSON file per city system into out/, each an array with one record per line,
plus meta.json with the data version, seeds and source checksums. build.py copies out/ into
data/city-systems-map/."""
import json
import platform
from importlib.metadata import version

import config

RAW, WORK, OUT = config.cache_paths()
load = lambda name: json.load(open(WORK / f'out_{name}.json'))
base, bld, mob, sys_ = load('base'), load('buildings'), load('mobility'), load('systems')

for old in OUT.glob('*.json'):
    old.unlink()


def write(name, records):
    with open(OUT / f'{name}.json', 'w') as fh:
        fh.write('[\n' + ',\n'.join(json.dumps(r, separators=(',', ':')) for r in records) + '\n]\n')


F = sys_['fields']
write('meta', [{
    'version': config.VERSION,
    'generator': 'scripts/city-systems-map/build.py',
    'seeds': {'buildings': config.SEED_BUILDINGS, 'systems': config.SEED_SYSTEMS},
    'python': platform.python_version(),
    'packages': {p: version(p) for p in ('numpy', 'scipy', 'networkx', 'scikit-image')},
    'sources': [{'file': name, 'url': config.DECK_GL_DATA_URL + src['path'], 'sha256': src['sha256'],
                 'licence': 'MIT (visgl/deck.gl-data)', 'use': src['use'], 'upstream': src['upstream']}
                for name, src in config.SOURCES.items()],
    'observed': ['building footprints and heights marked real', 'taxi trip paths and timestamps',
                 'resident dots in Manhattan', 'subway station names'],
    'derived': ['street network traced from taxi paths', 'shoreline and land mask', 'approximate park outlines',
                'approximate subway station positions'],
    'synthetic': ['every building without a real footprint, and all building attributes',
                  'every system reading, schedule, count, capacity, rent, crash, request and sensor',
                  'all vehicle and pedestrian movement except the taxi trips'],
    'bbox': base['bbox'], 'loop': mob['loop'], 'fw': F['w'], 'fh': F['h'], 'species': sys_['species'],
}])
write('land', base['land'])
write('parks', base['parks'])
write('streets', base['streets'])
write('labels', base['labels'])
zones = bld['zones']
write('buildings', [r[:9] + [zones[r[9]]] + r[10:] for r in bld['b']])
for key, name in [('taxis', 'taxis'), ('vans', 'vans'), ('ambulance', 'ambulances'), ('trucks', 'trucks'),
                  ('walkers', 'walkers'), ('citibike', 'bike-docks'), ('commute', 'commute'), ('crashes', 'crashes'),
                  ('parking', 'parking')]:
    write(name, mob[key])
write('subway-lines', mob['subway']['lines'])
write('subway-stations', mob['subway']['stations'])
write('subway-trains', mob['subway']['trains'])
write('bus-routes', mob['bus']['routes'])
write('buses', mob['bus']['buses'])
write('ferry-routes', mob['ferry']['routes'])
write('ferries', mob['ferry']['boats'])
write('fields', [{'name': k, 'data': F[k]} for k in ['land', 'heat', 'air', 'noiseD', 'noiseN', 'elev', 'built', 'well']])
for key, name in [('wind', 'wind'), ('trees', 'trees'), ('cso', 'sewer-outfalls'), ('mains', 'water-mains'),
                  ('leaks', 'main-breaks'), ('construction', 'construction'), ('subs', 'substations'),
                  ('feeders', 'feeders'), ('steam', 'steam-mains'), ('vents', 'steam-vents'), ('ev', 'ev-chargers'),
                  ('cells', 'cell-sites'), ('baskets', 'litter-baskets'), ('residents', 'residents'),
                  ('schools', 'schools'), ('stores', 'storefronts'), ('hospitals', 'hospitals'), ('fire', 'firehouses'),
                  ('fireResp', 'fire-response'), ('reqs', 'requests-311'), ('proposals', 'proposals'),
                  ('cooling', 'cooling-centers'), ('sensors', 'sensors')]:
    write(name, sys_[key])
files = sorted(OUT.glob('*.json'))
print(len(files), 'files,', sum(f.stat().st_size for f in files) // 1024, 'KB')
