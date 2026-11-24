"""Step 3: synthetic data for every city system, laid on the step 1-2 geography.

All readings, schedules, counts and capacities here are synthetic. Station names and approximate
station positions are real; service patterns and ridership are not. Writes work/out_*.json for export.py.
"""
import json, math, base64
import numpy as np
import networkx as nx
from scipy import ndimage
import config

RAW, WORK, OUT = config.cache_paths()

rng = np.random.default_rng(config.SEED_SYSTEMS)
g = np.load(WORK / 'geo.npz')
W, E, S, N, MX, MY, RES = [float(v) for v in g['meta']]
land5, park5, inten5 = g['land'], g['park'], g['intensity']
bz = np.load(WORK / 'bldg.npz'); occ2, hgt2 = bz['occ'], bz['hgt']
base = json.load(open(WORK / 'base.json'))
B = json.load(open(WORK / 'buildings_full.json'))
segs = json.load(open(WORK / 'segs.json'))['segs']
trips_raw = json.load(open(RAW / 'trips-v7.json'))
residents_raw = json.load(open(RAW / 'manhattan.json'))

def m2ll(x, y):  # meters east/north from (W,S)
    return W + x / MX, S + y / MY
def ll2m(lng, lat):
    return (lng - W) * MX, (lat - S) * MY
def dist(a, b):
    return math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MY)
def on_land(lng, lat):
    c = int((lng - W) * MX / RES); r = int((N - lat) * MY / RES)
    return 0 <= r < land5.shape[0] and 0 <= c < land5.shape[1] and bool(land5[r, c])
def r5(v):
    return round(float(v), 5)

# ---------------------------------------------------------------- street graph (for routing)
G = nx.Graph()
node_pts = {}
def nk(p):
    return (round(p[0], 4), round(p[1] / 0.75, 4))   # ~8.4 m cells in both axes
for a, b in segs:
    ka, kb = nk(a), nk(b)
    if ka == kb:
        continue
    node_pts.setdefault(ka, []).append(a); node_pts.setdefault(kb, []).append(b)
    L = dist(a, b)
    if not G.has_edge(ka, kb) or G[ka][kb]['len'] > L:
        G.add_edge(ka, kb, len=L)
pos = {k: (float(np.mean([p[0] for p in v])), float(np.mean([p[1] for p in v]))) for k, v in node_pts.items()}
big = max(nx.connected_components(G), key=len)
G = G.subgraph(big).copy()
keys = list(G.nodes); P = np.array([pos[k] for k in keys])
print('graph nodes', G.number_of_nodes(), 'edges', G.number_of_edges())

def nearest(lng, lat):
    d = ((P[:, 0] - lng) * MX) ** 2 + ((P[:, 1] - lat) * MY) ** 2
    return keys[int(np.argmin(d))]
def route(waypoints):
    path = []
    for a, b in zip(waypoints[:-1], waypoints[1:]):
        na, nb = nearest(*a), nearest(*b)
        try:
            sp = nx.shortest_path(G, na, nb, weight='len')
        except nx.NetworkXNoPath:
            continue
        pts = [pos[k] for k in sp]
        path += pts if not path else pts[1:]
    return smooth(path)
def smooth(path, it=1):
    p = np.array(path)
    for _ in range(it):
        if len(p) < 3:
            break
        q = p.copy(); q[1:-1] = 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]; p = q
    return [[r5(x), r5(y)] for x, y in p]
def path_len(path):
    return sum(dist(a, b) for a, b in zip(path[:-1], path[1:]))
def timestamps(path, speed, t0):
    ts = [t0]
    for a, b in zip(path[:-1], path[1:]):
        ts.append(ts[-1] + dist(a, b) / speed)
    return [round(t, 1) for t in ts]

# ---------------------------------------------------------------- taxi trips (clip to the view area)
VW, VE, VS, VN = -74.040, -73.950, 40.690, 40.756
trips = []
for i, t in enumerate(trips_raw):
    p, ts = t['path'], t['timestamps']
    cur_p, cur_t = [], []
    for a, tt in zip(p, ts):
        if VW < a[0] < VE and VS < a[1] < VN:
            cur_p.append([r5(a[0]), r5(a[1])]); cur_t.append(round(tt, 1))
        else:
            if len(cur_p) > 3:
                trips.append({'v': t['vendor'], 'p': cur_p, 't': cur_t})
            cur_p, cur_t = [], []
    if len(cur_p) > 3:
        trips.append({'v': t['vendor'], 'p': cur_p, 't': cur_t})
rng.shuffle(trips)
print('taxi trip pieces', len(trips))
LOOP = 2500

def flat(path):
    return [c for p in path for c in p]

def retime(tr, scale, offset, loop=LOOP):
    t0 = tr['t'][0]
    return [round(((x - t0) * scale + offset), 1) for x in tr['t']]

# ---------------------------------------------------------------- subway (approximate real stations)
SUB = [
    ('1', '#EE352E', [('23 St', 40.7442, -73.9957), ('18 St', 40.7410, -73.9978), ('14 St', 40.7378, -74.0000),
        ('Christopher St', 40.7334, -74.0029), ('Houston St', 40.7283, -74.0053), ('Canal St', 40.7223, -74.0063),
        ('Franklin St', 40.7192, -74.0068), ('Chambers St', 40.7155, -74.0093), ('WTC Cortlandt', 40.7111, -74.0122),
        ('Rector St', 40.7073, -74.0136), ('South Ferry', 40.7016, -74.0131)]),
    ('2 3', '#EE352E', [('Chambers St', 40.7155, -74.0093), ('Park Pl', 40.7131, -74.0088), ('Fulton St', 40.7094, -74.0074),
        ('Wall St', 40.7068, -74.0091), ('Clark St', 40.6977, -73.9932)]),
    ('4 5 6', '#00933C', [('23 St', 40.7398, -73.9866), ('14 St-Union Sq', 40.7347, -73.9906), ('Astor Pl', 40.7300, -73.9910),
        ('Bleecker St', 40.7259, -73.9946), ('Spring St', 40.7222, -73.9973), ('Canal St', 40.7188, -74.0001),
        ('Brooklyn Bridge-City Hall', 40.7131, -74.0041), ('Fulton St', 40.7102, -74.0078), ('Wall St', 40.7077, -74.0118),
        ('Bowling Green', 40.7046, -74.0140), ('Borough Hall', 40.6929, -73.9901)]),
    ('A C E', '#2B5FC8', [('23 St', 40.7457, -73.9982), ('14 St', 40.7397, -74.0023), ('W 4 St-Wash Sq', 40.7322, -74.0005),
        ('Spring St', 40.7262, -74.0037), ('Canal St', 40.7209, -74.0052), ('Chambers St', 40.7143, -74.0088),
        ('Fulton St', 40.7102, -74.0076), ('High St', 40.6994, -73.9906)]),
    ('B D F M', '#FF6319', [('23 St', 40.7429, -73.9928), ('14 St', 40.7382, -73.9962), ('W 4 St-Wash Sq', 40.7322, -74.0005),
        ('Broadway-Lafayette St', 40.7253, -73.9962), ('2 Av', 40.7233, -73.9897), ('Delancey St-Essex St', 40.7186, -73.9881),
        ('East Broadway', 40.7138, -73.9902), ('York St', 40.7014, -73.9866)]),
    ('N Q R W', '#FCCC0A', [('23 St', 40.7413, -73.9893), ('14 St-Union Sq', 40.7356, -73.9906), ('8 St-NYU', 40.7305, -73.9926),
        ('Prince St', 40.7243, -73.9977), ('Canal St', 40.7195, -74.0018), ('City Hall', 40.7135, -74.0067),
        ('Cortlandt St', 40.7108, -74.0111), ('Rector St', 40.7073, -74.0130), ('Whitehall St', 40.7031, -74.0130),
        ('Court St', 40.6941, -73.9918)]),
    ('L', '#A7A9AC', [('8 Av', 40.7397, -74.0026), ('6 Av', 40.7377, -73.9969), ('14 St-Union Sq', 40.7349, -73.9900),
        ('3 Av', 40.7326, -73.9860), ('1 Av', 40.7307, -73.9815), ('Bedford Av', 40.7172, -73.9566)]),
    ('J Z', '#A87A4B', [('Broad St', 40.7065, -74.0110), ('Fulton St', 40.7105, -74.0077), ('Chambers St', 40.7133, -74.0034),
        ('Canal St', 40.7181, -73.9998), ('Bowery', 40.7203, -73.9939), ('Delancey St-Essex St', 40.7184, -73.9877),
        ('Marcy Av', 40.7084, -73.9578)]),
]
BIG = {'14 St-Union Sq': 95, 'Fulton St': 62, 'Canal St': 48, 'WTC Cortlandt': 30, 'Chambers St': 34,
       'Brooklyn Bridge-City Hall': 38, 'W 4 St-Wash Sq': 41, 'Broadway-Lafayette St': 33, 'Wall St': 26,
       '23 St': 30, 'Bowling Green': 22, 'Delancey St-Essex St': 27, 'Astor Pl': 21, '14 St': 32, 'City Hall': 14}
sub_lines, stations, trains = [], {}, []
for name, color, sts in SUB:
    path = [[r5(lng), r5(lat)] for _, lat, lng in sts]
    sub_lines.append({'n': name, 'c': color, 'p': path})
    for sname, lat, lng in sts:
        key = sname + '|' + str(round(lat, 3))
        st = stations.setdefault(key, {'n': sname, 'pos': [r5(lng), r5(lat)], 'l': [], 'e': 0})
        st['l'].append(name)
    # trains both directions, headway 4 min, 3600 s loop; speed incl. dwell ~ 9.5 m/s
    L = path_len(path); tt = L / 9.5
    for direction in (1, -1):
        pp = path if direction == 1 else path[::-1]
        for k in range(int(3600 / 240) + int(tt / 240) + 2):
            t0 = -tt + k * 240 + (0 if direction == 1 else 120)
            ts = timestamps(pp, 9.5, t0)
            trains.append({'l': name, 'c': color, 'p': flat(pp), 't': ts, 'h': k % 4})
for st in stations.values():
    nm = st['n']
    st['e'] = int((BIG.get(nm, 0) or rng.integers(7, 16)) * 1000 * rng.uniform(0.9, 1.1))
print('stations', len(stations), 'trains', len(trains))

# ---------------------------------------------------------------- buses (routed on real streets)
BUS = [
    ('M15', [(-74.0128, 40.7019), (-74.0072, 40.7050), (-74.0035, 40.7078), (-73.9985, 40.7113), (-73.9916, 40.7156),
             (-73.9899, 40.7192), (-73.9880, 40.7232), (-73.9812, 40.7320), (-73.9776, 40.7377)]),
    ('M14', [(-74.0085, 40.7424), (-74.0026, 40.7397), (-73.9905, 40.7347), (-73.9817, 40.7310), (-73.9768, 40.7290)]),
    ('M21', [(-74.0105, 40.7287), (-74.0055, 40.7284), (-73.9975, 40.7254), (-73.9895, 40.7236), (-73.9778, 40.7206)]),
    ('M55', [(-73.9930, 40.7428), (-73.9968, 40.7378), (-74.0004, 40.7322), (-74.0047, 40.7202), (-74.0080, 40.7152),
             (-74.0123, 40.7080), (-74.0130, 40.7025)]),
    ('M103', [(-73.9907, 40.7291), (-73.9925, 40.7245), (-73.9960, 40.7177), (-74.0012, 40.7130), (-74.0058, 40.7124)]),
    ('M9', [(-73.9840, 40.7346), (-73.9825, 40.7275), (-73.9852, 40.7222), (-73.9900, 40.7150), (-74.0010, 40.7126)]),
]
bus_routes, buses = [], []
for name, wps in BUS:
    p = route(wps)
    if len(p) < 2:
        continue
    bus_routes.append({'n': name, 'p': p})
    L = path_len(p); tt = L / 3.6
    for direction in (1, -1):
        pp = p if direction == 1 else p[::-1]
        for k in range(int(3600 / 450) + int(tt / 450) + 2):
            t0 = -tt + k * 450 + (0 if direction == 1 else 225) + rng.uniform(-40, 40)
            buses.append({'l': name, 'p': flat(pp), 't': timestamps(pp, 3.6 * rng.uniform(0.85, 1.15), t0)})
print('bus routes', [(b['n'], len(b['p'])) for b in bus_routes], 'buses', len(buses))

# ---------------------------------------------------------------- ferries (on water)
FER = [
    ('Staten Island Ferry', [(-74.0128, 40.7006), (-74.0175, 40.6975), (-74.0300, 40.6880), (-74.0480, 40.6720)], 8.5),
    ('East River route', [(-74.0058, 40.7030), (-73.9990, 40.7046), (-73.9935, 40.7052), (-73.9860, 40.7072),
                          (-73.9780, 40.7090), (-73.9712, 40.7150), (-73.9700, 40.7250), (-73.9702, 40.7335),
                          (-73.9695, 40.7445)], 7.5),
    ('Hudson route', [(-74.0172, 40.7138), (-74.0230, 40.7150), (-74.0290, 40.7175), (-74.0255, 40.7290),
                      (-74.0225, 40.7360), (-74.0212, 40.7450)], 7.0),
]
ferry_routes, boats = [], []
for name, wps, sp in FER:
    for lng, lat in wps:
        if on_land(lng, lat) and VW < lng < VE:
            print('WARNING ferry waypoint on land', name, lng, lat)
    p = [[r5(x), r5(y)] for x, y in wps]
    ferry_routes.append({'n': name, 'p': p})
    L = path_len(p); tt = L / sp
    hw = 1800 if name.startswith('Staten') else 1200
    for direction in (1, -1):
        pp = p if direction == 1 else p[::-1]
        for k in range(int(3600 / hw) + int(tt / hw) + 2):
            t0 = -tt + k * hw + (0 if direction == 1 else hw / 2)
            boats.append({'l': name, 'p': flat(pp), 't': timestamps(pp, sp, t0)})

# ---------------------------------------------------------------- other vehicles on real taxi paths
ambulance = [{'p': flat(t['p']), 't': retime(t, 0.7, rng.uniform(0, LOOP))} for t in trips[:24]]
vans = [{'p': flat(t['p']), 't': retime(t, 1.4, rng.uniform(0, LOOP))} for t in trips[24:150]]
trucks = [{'p': flat(t['p']), 't': retime(t, 2.6, rng.uniform(0, LOOP))} for t in trips[150:210]]
taxis = [{'v': t['v'], 'p': flat(t['p']), 't': t['t']} for t in trips]
print('taxis', len(taxis))

# walkers: short pieces of street paths at walking speed
walkers = []
for i in range(900):
    a = keys[rng.integers(len(keys))]
    # random walk 400-900 m along the graph
    path = [pos[a]]; cur = a; prev = None; L = 0; target = rng.uniform(350, 900)
    while L < target:
        nb = [n for n in G.neighbors(cur) if n != prev]
        if not nb:
            break
        nxt = nb[rng.integers(len(nb))]
        L += G[cur][nxt]['len']; path.append(pos[nxt]); prev, cur = cur, nxt
    if len(path) < 3 or not (VW < path[0][0] < VE):
        continue
    p = [[r5(x), r5(y)] for x, y in path]
    walkers.append({'p': flat(p), 't': timestamps(p, rng.uniform(1.1, 1.5), rng.uniform(-600, LOOP))})
print('walkers', len(walkers))

# ---------------------------------------------------------------- helpers for sampling along streets / buildings
street_list = [s for s in base['streets'] if not s[5]]
s_arr = np.array([[s[0], s[1], s[2], s[3], s[4]] for s in street_list])
s_len = np.array([dist((s[0], s[1]), (s[2], s[3])) for s in street_list])
def sample_street_points(n, cls_w=(1, 1.5, 2, 1), weight_fn=None, offset=7.0):
    w = s_len * np.array([cls_w[int(c)] for c in s_arr[:, 4]])
    if weight_fn is not None:
        mid = (s_arr[:, :2] + s_arr[:, 2:4]) / 2
        w = w * np.array([weight_fn(x, y) for x, y in mid])
    w = w / w.sum()
    idx = rng.choice(len(s_arr), n, p=w)
    out = []
    for i in idx:
        x0, y0, x1, y1, c = s_arr[i]
        t = rng.random()
        lng, lat = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        dx, dy = (x1 - x0) * MX, (y1 - y0) * MY; L = math.hypot(dx, dy) or 1
        side = rng.choice([-1, 1])
        lng += -dy / L * offset * side / MX; lat += dx / L * offset * side / MY
        out.append((lng, lat, int(c)))
    return out
bcent = np.array([[np.mean([p[0] for p in b['p']]), np.mean([p[1] for p in b['p']])] for b in B])
def near_any(lng, lat, pts, r):
    return any(dist((lng, lat), p) < r for p in pts)
def gauss_w(centers):
    def f(x, y):
        v = 0.15
        for cx, cy, s, a in centers:
            v += a * math.exp(-(((x - cx) * MX) ** 2 + ((y - cy) * MY) ** 2) / (2 * s * s))
        return v
    return f

# ---------------------------------------------------------------- Citi Bike docks (poisson-disk along streets)
cb = []
for lng, lat, c in sample_street_points(4000, offset=9):
    if not on_land(lng, lat) or not (-74.0185 < lng < -73.9700):
        continue
    if all(dist((lng, lat), (q[0], q[1])) > 230 for q in cb):
        cb.append((lng, lat))
citibike = []
for i, (lng, lat) in enumerate(cb):
    z = 'off' if (lat < 40.7135 and lng < -74.002) or (lat > 40.736) else 'res'
    docks = int(rng.choice([19, 23, 27, 31, 35, 39, 43, 47, 55]))
    citibike.append({'pos': [r5(lng), r5(lat)], 'id': f'{5100 + i * 7 % 900}.{rng.integers(1, 15):02d}', 'd': docks,
                     'z': 1 if z == 'off' else 0, 'b': round(float(rng.uniform(0.25, 0.75)), 2)})
print('citibike', len(citibike))

# ---------------------------------------------------------------- commute flows (regional arcs)
ORIG = [('Park Slope', -73.9800, 40.6720), ('Bed-Stuy', -73.9440, 40.6870), ('Williamsburg', -73.9570, 40.7140),
        ('Bushwick', -73.9210, 40.6950), ('Crown Heights', -73.9420, 40.6690), ('Sunset Park', -74.0100, 40.6450),
        ('Long Island City', -73.9490, 40.7440), ('Astoria', -73.9230, 40.7640), ('Jackson Heights', -73.8830, 40.7560),
        ('Jersey City', -74.0700, 40.7280), ('Hoboken', -74.0320, 40.7440), ('Newark', -74.1720, 40.7350),
        ('Staten Island', -74.1000, 40.6100), ('South Bronx', -73.9180, 40.8160), ('Harlem', -73.9450, 40.8090),
        ('Upper West Side', -73.9750, 40.7870), ('Bay Ridge', -74.0300, 40.6260), ('Flatbush', -73.9590, 40.6400)]
DEST = [('Financial District', -74.0090, 40.7070, 1.0), ('World Trade Center', -74.0125, 40.7118, 0.8),
        ('Civic Center', -74.0040, 40.7140, 0.6), ('Hudson Square', -74.0070, 40.7260, 0.5),
        ('SoHo', -74.0000, 40.7240, 0.4), ('Union Square', -73.9905, 40.7360, 0.6), ('Flatiron', -73.9895, 40.7410, 0.7)]
commute = []
for on, ox, oy in ORIG:
    for dn, dx, dy, dw in DEST:
        vol = int(rng.lognormal(math.log(900 * dw), 0.6))
        if vol < 250:
            continue
        nj = ox < -74.03
        transit = rng.uniform(0.55, 0.8); car = rng.uniform(0.08, 0.22) if not nj else rng.uniform(0.15, 0.3)
        mode = 0 if rng.random() < transit else (1 if rng.random() < car / (1 - transit + 1e-9) else 2)
        commute.append({'o': on, 'd': dn, 's': [ox, oy], 't': [r5(dx + rng.normal(0, 0.0006)), r5(dy + rng.normal(0, 0.0006))],
                        'v': vol, 'm': int(mode)})
print('commute arcs', len(commute))

# ---------------------------------------------------------------- crash hotspots (busy intersections)
deg = np.array([G.degree(k) for k in keys])
cand = [i for i in range(len(keys)) if deg[i] >= 4]
def inten_at(lng, lat):
    c = int((lng - W) * MX / RES); r = int((N - lat) * MY / RES)
    if 0 <= r < inten5.shape[0] and 0 <= c < inten5.shape[1]:
        return float(inten5[r, c])
    return 0.0
cand = sorted(cand, key=lambda i: -inten_at(*P[i]))
crashes = []
for i in cand:
    lng, lat = P[i]
    if not on_land(lng, lat) or not (-74.0185 < lng < -73.9700 and 40.7000 < lat < 40.7470):
        continue
    if all(dist((lng, lat), c['pos']) > 260 for c in crashes):
        n = int(np.clip(rng.lognormal(math.log(14), 0.45), 5, 60))
        crashes.append({'pos': [r5(lng), r5(lat)], 'n': n, 'inj': int(n * rng.uniform(0.25, 0.5)),
                        'ped': int(n * rng.uniform(0.05, 0.25))})
    if len(crashes) >= 45:
        break

# ---------------------------------------------------------------- parking garages
parking = []
for lng, lat, c in sample_street_points(600, offset=16):
    if not on_land(lng, lat) or not (-74.0185 < lng < -73.9700):
        continue
    if all(dist((lng, lat), q['pos']) > 320 for q in parking):
        cap = int(rng.choice([60, 90, 120, 180, 240, 320, 400]))
        fidi = lat < 40.7135 and lng < -74.002
        parking.append({'pos': [r5(lng), r5(lat)], 'cap': cap, 'rate': int(rng.integers(18, 30) + (14 if fidi else 0)),
                        'z': 1 if (fidi or lat > 40.736) else 0})
    if len(parking) >= 48:
        break

mobility = {'loop': LOOP, 'taxis': taxis, 'vans': vans, 'ambulance': ambulance, 'trucks': trucks, 'walkers': walkers,
            'subway': {'lines': sub_lines, 'stations': list(stations.values()), 'trains': trains},
            'bus': {'routes': bus_routes, 'buses': buses}, 'ferry': {'routes': ferry_routes, 'boats': boats},
            'citibike': citibike, 'commute': commute, 'crashes': crashes, 'parking': parking}

# ================================================================= fields on a 20 m grid
GR = 20.0
GX = int(round((E - W) * MX / GR)); GY = int(round((N - S) * MY / GR))
def down(m5, how='mean'):
    f = RES / GR  # 0.25
    out = ndimage.zoom(m5.astype(np.float32), (GY / m5.shape[0], GX / m5.shape[1]), order=1)
    return out
land_g = down(land5) > 0.5
park_g = down(park5)
occ_g = ndimage.zoom(occ2.astype(np.float32), (GY / occ2.shape[0], GX / occ2.shape[1]), order=1)
hgt_g = ndimage.zoom(hgt2, (GY / hgt2.shape[0], GX / hgt2.shape[1]), order=1)
traf_g = ndimage.zoom(inten5, (GY / inten5.shape[0], GX / inten5.shape[1]), order=1)
traf_g = np.log1p(traf_g); traf_g /= np.percentile(traf_g[land_g], 99.5)
dwater = ndimage.distance_transform_edt(land_g) * GR       # m from water
def gc(lng, lat):
    return (lng - W) * MX / GR, (N - lat) * MY / GR
def blur(a, m):
    return ndimage.gaussian_filter(a, m / GR)
def norm(a, mask=None, lo=1, hi=99):
    v = a[mask] if mask is not None else a
    l, h = np.percentile(v, lo), np.percentile(v, hi)
    return np.clip((a - l) / (h - l + 1e-9), 0, 1)

# surface heat: built mass + traffic + low albedo, cooled by parks and water
heat = 0.55 * blur(occ_g, 50) + 0.25 * blur(traf_g, 60) + 0.15 * blur(np.clip(hgt_g / 60, 0, 1), 80) \
       - 0.45 * blur(park_g, 70) - 0.35 * np.exp(-dwater / 140)
heat = norm(heat, land_g, 1, 99.5)

# air quality: traffic emissions advected toward the SE by a NW wind, plus point sources
emis = blur(traf_g, 30)
shift = ndimage.shift(emis, (4, 5), order=1, mode='nearest')     # rows down (south), cols right (east)
air = 0.6 * blur(shift, 120) + 0.4 * blur(emis, 60)
def plume(lng, lat, length, width, amp, ang_deg=-40):
    yy, xx = np.mgrid[0:GY, 0:GX].astype(np.float32)
    c, r = gc(lng, lat)
    dx, dy = (xx - c) * GR, (yy - r) * GR
    a = math.radians(ang_deg)
    u = dx * math.cos(a) - dy * math.sin(a); v = dx * math.sin(a) + dy * math.cos(a)
    return amp * np.exp(-((np.clip(u, 0, None) / length) ** 2) - (v / (width + 0.25 * np.abs(u))) ** 2) * (u > -60)
air += plume(-73.9748, 40.7287, 900, 60, 0.5)        # steam/power plant on the East River
air += plume(-73.9950, 40.7090, 500, 60, 0.25)        # bridge approaches
air += plume(-73.9925, 40.7120, 500, 60, 0.25)
air = norm(air, None, 1, 99.7)

# noise: traffic by day; nightlife + highways at night
noise_d = norm(blur(traf_g, 25) + 0.25 * blur(occ_g, 40), land_g, 1, 99.7)
night_spots = [(-73.9875, 40.7215, 260, 1.0), (-73.9850, 40.7275, 280, 0.8), (-74.0070, 40.7405, 220, 0.8),
               (-74.0005, 40.7300, 240, 0.6), (-73.9935, 40.7190, 200, 0.6), (-74.0060, 40.7190, 180, 0.4)]
nn = np.zeros((GY, GX), np.float32)
yy, xx = np.mgrid[0:GY, 0:GX].astype(np.float32)
for lng, lat, s, a in night_spots:
    c, r = gc(lng, lat); nn += a * np.exp(-(((xx - c) * GR) ** 2 + ((yy - r) * GR) ** 2) / (2 * s * s))
hw_mask = blur((traf_g > 0.75).astype(np.float32), 30)
noise_n = norm(0.55 * nn + 0.6 * hw_mask + 0.15 * blur(traf_g, 25), land_g, 1, 99.7)

# elevation (m): low along the waterfront and historic landfill, rising inland
elev = 1.1 + 1.6 * (1 - np.exp(-dwater / 250)) + 0.0042 * dwater
elev += 2.0 * np.exp(-(((xx - gc(-73.9990, 40.7290)[0]) * GR) ** 2 + ((yy - gc(-73.9990, 40.7290)[1]) * GR) ** 2) / (2 * 900 ** 2))
elev += rng.normal(0, 0.25, elev.shape); elev = blur(elev, 40)
for lng, lat, s, d in [(-74.0105, 40.7050, 260, -1.2), (-74.0035, 40.7075, 220, -1.0), (-73.9790, 40.7180, 400, -1.1),
                       (-74.0155, 40.7110, 300, -0.6), (-74.0110, 40.7280, 260, -0.8)]:
    c, r = gc(lng, lat); elev += d * np.exp(-(((xx - c) * GR) ** 2 + ((yy - r) * GR) ** 2) / (2 * s * s))
elev = np.clip(elev, 0.5, 25)

# cell sites + signal (RSRP, dBm), attenuated by built mass
cells = []
for b, (lng, lat) in zip(B, bcent):
    if b['h'] > 35 and rng.random() < 0.012 and all(dist((lng, lat), c['pos']) > 260 for c in cells):
        cells.append({'pos': [r5(lng), r5(lat)], 'k': 'macro', 'h': b['h'], 'bk': int(rng.random() < 0.6)})
for lng, lat, c in sample_street_points(400, offset=6):
    if on_land(lng, lat) and all(dist((lng, lat), q['pos']) > 180 for q in cells) and len(cells) < 75:
        cells.append({'pos': [r5(lng), r5(lat)], 'k': 'small', 'h': 8, 'bk': int(rng.random() < 0.3)})
rsrp = np.full((GY, GX), -140.0, np.float32)
for c in cells:
    cx, cy = gc(*c['pos'])
    d = np.hypot((xx - cx) * GR, (yy - cy) * GR) / 1000 + 0.02
    ptx = 46 if c['k'] == 'macro' else 30
    rsrp = np.maximum(rsrp, ptx - (128.1 + 37.6 * np.log10(d)) + 15)
rsrp -= 14 * blur(occ_g, 30)
cell_n = np.clip((rsrp + 125) / 55, 0, 1)

# well-being composite (0-1): green access, quiet, cool, transit access
pd_ = ndimage.distance_transform_edt(park_g < 0.3) * GR
stx = np.full((GY, GX), 1e6, np.float32)
for st in stations.values():
    cx, cy = gc(*st['pos']); stx = np.minimum(stx, np.hypot((xx - cx) * GR, (yy - cy) * GR))
well = 0.30 * np.exp(-pd_ / 350) + 0.25 * (1 - noise_d) + 0.20 * (1 - heat) + 0.25 * np.exp(-stx / 500)
well = norm(blur(well, 40), land_g, 1, 99)

def enc(a, scale=255.0):
    return base64.b64encode(np.clip(np.round(a * scale), 0, 255).astype(np.uint8).tobytes()).decode()
fields = {'w': GX, 'h': GY, 'bbox': [W, S, E, N],
          'land': enc(land_g.astype(np.float32)), 'heat': enc(heat), 'air': enc(air), 'noiseD': enc(noise_d),
          'noiseN': enc(noise_n), 'elev': enc(elev / 25.0), 'built': enc(np.clip(occ_g, 0, 1)), 'well': enc(well)}

# ---------------------------------------------------------------- wind streamlines (animated)
def wind_at(lng, lat):
    c, r = gc(lng, lat); c = int(np.clip(c, 0, GX - 1)); r = int(np.clip(r, 0, GY - 1))
    dens = occ_g[r, c]
    u, v = 0.62, -0.78                          # blowing toward the SE (from the NW)
    ga, gb = math.sin(math.radians(29)), math.cos(math.radians(29))   # avenue axis (unit, east,north)
    if dens > 0.25:                              # channel along the street grid
        proj = u * ga + v * gb
        u, v = 0.5 * u + 0.5 * ga * proj * 1.4, 0.5 * v + 0.5 * gb * proj * 1.4
    spd = 5.5 * (1 - 0.55 * min(1, dens * 1.6)) * (1.15 if not land_g[r, c] else 1.0)
    return u * spd, v * spd
wind = []
for i in range(520):
    lng = rng.uniform(-74.036, -73.952); lat = rng.uniform(40.694, 40.754)
    pts = [(lng, lat)]; spd_acc = []
    for k in range(70):
        u, v = wind_at(lng, lat)
        lng += u * 4.0 / MX; lat += v * 4.0 / MY
        pts.append((lng, lat)); spd_acc.append(math.hypot(u, v))
        if not (W < lng < E and S < lat < N):
            break
    if len(pts) < 10:
        continue
    p = [[r5(x), r5(y)] for x, y in pts]
    # time in seconds such that particles drift visibly (scaled 6x real speed)
    ts = [0.0]
    for a, b, s in zip(p[:-1], p[1:], spd_acc + [spd_acc[-1]]):
        ts.append(ts[-1] + dist(a, b) / (s * 6))
    off = rng.uniform(0, 600)
    wind.append({'p': flat(p), 't': [round(t + off, 1) for t in ts], 's': round(float(np.mean(spd_acc)), 1)})
print('wind lines', len(wind))

# ---------------------------------------------------------------- environment & water point layers
SPECIES = [('London planetree', 0.16), ('Honeylocust', 0.22), ('Callery pear', 0.09), ('Pin oak', 0.08),
           ('Littleleaf linden', 0.06), ('Ginkgo', 0.06), ('Japanese zelkova', 0.05), ('Cherry', 0.04),
           ('Red maple', 0.04), ('Other', 0.20)]
sp_names = [s for s, _ in SPECIES]; sp_p = np.array([p for _, p in SPECIES]); sp_p /= sp_p.sum()
trees = []
for lng, lat, c in sample_street_points(7000, cls_w=(1.6, 1.2, 0.6, 0.1), offset=7.5):
    if on_land(lng, lat):
        trees.append([r5(lng), r5(lat), int(rng.choice(len(sp_names), p=sp_p)), int(np.clip(rng.lognormal(math.log(11), 0.5), 3, 40)),
                      int(rng.choice(3, p=[0.78, 0.17, 0.05]))])
print('trees', len(trees))

# CSO outfalls along the Manhattan shoreline
shore = []
lp = max(base['land'], key=len)
for p in lp[::max(1, len(lp) // 60)]:
    if -74.0190 < p[0] < -73.9700 and p[1] < 40.746 and p[0] < -73.968:
        if all(dist(p, q) > 420 for q in shore):
            shore.append(p)
cso = [{'pos': [r5(p[0]), r5(p[1])], 'id': f'NC-{i + 21:03d}', 'mg': round(float(rng.uniform(0.4, 6.5)), 1)} for i, p in enumerate(shore)]

# water mains on major streets: pressure psi drops with elevation and distance from the feed (north)
mains = []
for i, s in enumerate(base['streets']):
    if s[5] or s[4] < 2:
        continue
    lng, lat = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
    if not on_land(lng, lat):
        continue
    c, r = gc(lng, lat); e = float(elev[int(np.clip(r, 0, GY - 1)), int(np.clip(c, 0, GX - 1))])
    psi = 74 - 0.9 * e - 0.0016 * dist((lng, lat), (-73.985, 40.745)) + rng.normal(0, 1.5)
    mains.append([i, round(float(psi), 1)])
leaks = [{'pos': [r5(x), r5(y)], 'gpm': int(rng.integers(20, 140))} for x, y, c in sample_street_points(3, offset=0)]

# construction sites
construction = []
cand_b = [i for i, b in enumerate(B) if not b['real'] and b['h'] > 20]
for i in rng.permutation(cand_b):
    lng, lat = bcent[i]
    if all(dist((lng, lat), q['pos']) > 380 for q in construction):
        fl = int(rng.integers(8, 52)); kind = rng.choice(['Residential tower', 'Office conversion', 'Mixed-use tower',
                                                           'Hotel', 'School expansion', 'Facade repair'])
        construction.append({'pos': [r5(lng), r5(lat)], 'b': int(i), 'k': str(kind), 'f': fl,
                             'pct': int(rng.integers(8, 92)), 'q': f"Q{rng.integers(1, 5)} {rng.integers(2027, 2030)}"})
    if len(construction) >= 22:
        break

# ---------------------------------------------------------------- energy
SUBS = [('Substation 1 · East River', -73.9748, 40.7287, 520), ('Substation 2 · Financial District', -74.0100, 40.7058, 410),
        ('Substation 3 · Tribeca', -74.0090, 40.7192, 300), ('Substation 4 · Chinatown', -73.9975, 40.7150, 280),
        ('Substation 5 · Greenwich Village', -74.0030, 40.7340, 330), ('Substation 6 · Lower East Side', -73.9845, 40.7185, 300),
        ('Substation 7 · Flatiron', -73.9895, 40.7412, 360)]
subs = [{'n': n, 'pos': [r5(x), r5(y)], 'cap': c} for n, x, y, c in SUBS]
# network assignment: nearest substation (Manhattan) / none for other boroughs
net = []
for b, (lng, lat) in zip(B, bcent):
    if b['z'] in ('dumbo', 'dtbk', 'wburg', 'greenpoint', 'lic'):
        net.append(-1); continue
    d = [dist((lng, lat), s['pos']) for s in subs]
    net.append(int(np.argmin(d)))
feeders = []
for si, s in enumerate(subs):
    members = [i for i, n in enumerate(net) if n == si]
    if not members:
        continue
    tgt = [bcent[i] for i in rng.choice(members, min(9, len(members)), replace=False)]
    for t in tgt:
        p = route([tuple(s['pos']), tuple(t)])
        if len(p) > 2:
            feeders.append({'s': si, 'p': p, 'r': round(float(rng.uniform(0.55, 1.0)), 2)})
print('feeders', len(feeders))
# steam mains (Con Ed steam district serves Midtown South and Downtown)
steam = []
for i, s in enumerate(base['streets']):
    if s[5] or s[4] < 1:
        continue
    lng, lat = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
    if (lat < 40.7125 and lng < -74.003) or (lat > 40.7335 and -73.9960 < lng < -73.9800):
        if rng.random() < 0.55:
            steam.append(i)
vents = []
for i in rng.permutation(steam)[:60]:
    s = base['streets'][i]
    p = [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2]
    if all(dist(p, v['pos']) > 220 for v in vents):
        vents.append({'pos': [r5(p[0]), r5(p[1])], 'psi': int(rng.integers(120, 180))})
ev = []
for lng, lat, c in sample_street_points(900, offset=8):
    if on_land(lng, lat) and -74.0185 < lng < -73.970 and all(dist((lng, lat), q['pos']) > 200 for q in ev):
        kw = int(rng.choice([7, 7, 19, 19, 50, 150], p=[0.25, 0.2, 0.25, 0.1, 0.12, 0.08]))
        ev.append({'pos': [r5(lng), r5(lat)], 'kw': kw, 'ports': int(rng.choice([2, 2, 4, 6, 8])), 'off': int(rng.random() < 0.07)})
    if len(ev) >= 70:
        break
baskets = []
for lng, lat, c in sample_street_points(2600, cls_w=(0.6, 1.3, 1.6, 0.2), offset=8,
                                        weight_fn=gauss_w([(-73.9970, 40.7170, 500, 2), (-73.9900, 40.7355, 400, 1.5),
                                                           (-74.0090, 40.7080, 500, 1.2), (-73.9870, 40.7260, 450, 1.3)])):
    if on_land(lng, lat):
        baskets.append([r5(lng), r5(lat), round(float(rng.beta(2.2, 2.0)), 2)])
baskets = baskets[:900]

# ---------------------------------------------------------------- people
residents = [[r5(q[0]), r5(q[1])] for q in residents_raw if VW < q[0] < VE and VS < q[1] < VN]
for i, b in enumerate(B):   # outer-borough residents from residential buildings
    if b['z'] in ('dumbo', 'dtbk', 'wburg', 'greenpoint', 'lic') and b['k'] == 0:
        for _ in range(int(b['a'] / 3500) + (1 if rng.random() < 0.5 else 0)):
            residents.append([r5(bcent[i][0] + rng.normal(0, 0.00012)), r5(bcent[i][1] + rng.normal(0, 0.0001))])
print('residents', len(residents))
schools = []
for i in rng.permutation([i for i, b in enumerate(B) if b['k'] == 2 and b['h'] < 45]):
    lng, lat = bcent[i]
    if on_land(lng, lat) and -74.0185 < lng < -73.970 and all(dist((lng, lat), q['pos']) > 420 for q in schools):
        cap = int(rng.choice([350, 450, 600, 800, 1100, 1500]))
        schools.append({'pos': [r5(lng), r5(lat)], 'n': f'School {len(schools) + 1:02d}', 'cap': cap,
                        'enr': int(cap * rng.uniform(0.72, 1.22)), 'lvl': str(rng.choice(['Elementary', 'Middle', 'High']))})
    if len(schools) >= 26:
        break

# ---------------------------------------------------------------- economy: storefronts on commercial corridors
CORR = [(-73.9990, 40.7178, 380, 2.2), (-73.9975, 40.7235, 450, 1.8), (-73.9870, 40.7270, 300, 1.6),
        (-73.9895, 40.7205, 320, 1.6), (-74.0060, 40.7090, 400, 1.3), (-73.9905, 40.7360, 350, 1.4),
        (-74.0010, 40.7305, 320, 1.2), (-73.9935, 40.7165, 300, 1.3), (-74.0040, 40.7410, 380, 1.0)]
stores = []
for lng, lat, c in sample_street_points(6000, cls_w=(0.7, 1.4, 1.6, 0.05), offset=10, weight_fn=gauss_w(CORR)):
    if on_land(lng, lat) and -74.0185 < lng < -73.970:
        cat = int(rng.choice(3, p=[0.42, 0.38, 0.20]))
        stores.append([r5(lng), r5(lat), cat, int(np.clip(rng.lognormal(math.log(420), 0.7), 40, 6000))])
stores = stores[:2600]
print('stores', len(stores))

# ---------------------------------------------------------------- health & safety
hospitals = [{'n': 'Downtown hospital', 'pos': [-74.0050, 40.7106], 'beds': 180, 'er': 34},
             {'n': 'East Side medical center', 'pos': [-73.9818, 40.7330], 'beds': 520, 'er': 52},
             {'n': 'Kips Bay medical center', 'pos': [-73.9752, 40.7392], 'beds': 840, 'er': 71},
             {'n': 'Brooklyn waterfront hospital', 'pos': [-73.9900, 40.6950], 'beds': 300, 'er': 45}]
FH = [(-74.0085, 40.7175), (-74.0125, 40.7095), (-74.0050, 40.7060), (-73.9995, 40.7135), (-73.9930, 40.7210),
      (-73.9840, 40.7150), (-73.9890, 40.7270), (-73.9800, 40.7250), (-74.0020, 40.7255), (-74.0080, 40.7330),
      (-73.9975, 40.7345), (-73.9880, 40.7395), (-74.0040, 40.7420), (-73.9790, 40.7340)]
fire = [{'n': f'Firehouse {i + 1:02d}', 'pos': [r5(x), r5(y)]} for i, (x, y) in enumerate(FH)]
# response time on streets: Dijkstra from each firehouse at ~7 m/s
tmin = {}
for f in fire:
    src = nearest(*f['pos'])
    for k, d in nx.single_source_dijkstra_path_length(G, src, cutoff=7 * 300, weight='len').items():
        t = d / 7.0 + 60  # 60 s turnout
        if t < tmin.get(k, 1e9):
            tmin[k] = t
fire_resp = []
for a, b in G.edges:
    if a in tmin and b in tmin:
        t = (tmin[a] + tmin[b]) / 2
        pa, pb = pos[a], pos[b]
        if -74.020 < pa[0] < -73.968 and pa[1] < 40.747:
            fire_resp.append([r5(pa[0]), r5(pa[1]), r5(pb[0]), r5(pb[1]), int(t)])
print('fire response edges', len(fire_resp))

# 311 service requests through the day (hour-dependent mix)
reqs = []
popw = np.array(residents)
for k in range(2400):
    hw_ = np.array([2, 1.4, 1.1, .8, .6, .6, 1, 2, 3.2, 4.2, 4.6, 4.8, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.1, 4, 3.8, 3.6, 3.2, 2.6])
    hour = float(rng.choice(24, p=hw_ / hw_.sum())) + rng.random()
    night = hour >= 21 or hour < 3
    cat = int(rng.choice(4, p=[0.55, 0.15, 0.15, 0.15] if night else [0.22, 0.30, 0.24, 0.24]))
    q = popw[rng.integers(len(popw))]
    reqs.append([r5(q[0] + rng.normal(0, 0.0004)), r5(q[1] + rng.normal(0, 0.0003)), cat, round(hour, 2),
                 int(rng.integers(0, 6))])
# civic proposals with support share (for/against)
PROP = ['Protected bike lane', 'Bus lane', 'Street trees', 'Park renovation', 'Open street', 'Curb loading zone',
        'Public restrooms', 'Daylighted crosswalk', 'Cooling station', 'Community garden']
proposals = []
for lng, lat, c in sample_street_points(400, offset=0):
    if on_land(lng, lat) and -74.0185 < lng < -73.970 and all(dist((lng, lat), q['pos']) > 300 for q in proposals):
        proposals.append({'pos': [r5(lng), r5(lat)], 'k': str(rng.choice(PROP)), 'sup': round(float(rng.beta(4, 2.6)), 2),
                          'votes': int(rng.integers(40, 1900))})
    if len(proposals) >= 42:
        break
# cooling centers (heat emergencies)
cooling = []
for i in rng.permutation([i for i, b in enumerate(B) if b['k'] == 2]):
    lng, lat = bcent[i]
    if on_land(lng, lat) and -74.0185 < lng < -73.970 and all(dist((lng, lat), q['pos']) > 650 for q in cooling):
        cooling.append({'pos': [r5(lng), r5(lat)], 'cap': int(rng.choice([60, 80, 120, 200]))})
    if len(cooling) >= 12:
        break

# sensors (digital twin layer)
sensors = []
for lng, lat, c in sample_street_points(900, cls_w=(0.3, 1, 2.5, 1), offset=4):
    if not (on_land(lng, lat) and -74.0185 < lng < -73.970):
        continue
    if all(dist((lng, lat), q['pos']) > 160 for q in sensors):
        cc_, r_ = gc(lng, lat); e = float(elev[int(np.clip(r_, 0, GY - 1)), int(np.clip(cc_, 0, GX - 1))])
        k = 2 if e < 3.2 and rng.random() < 0.6 else int(rng.choice(4, p=[0.45, 0.25, 0.0, 0.30]))
        if k == 2 and e >= 3.2:
            k = 0
        sensors.append({'pos': [r5(lng), r5(lat)], 'k': k})
    if len(sensors) >= 150:
        break

systems = {'fields': fields, 'wind': wind, 'trees': trees, 'species': sp_names, 'cso': cso, 'mains': mains,
           'leaks': leaks, 'construction': construction, 'subs': subs, 'feeders': feeders, 'steam': steam,
           'vents': vents, 'ev': ev, 'cells': cells, 'baskets': baskets, 'residents': residents, 'schools': schools,
           'stores': stores, 'hospitals': hospitals, 'fire': fire, 'fireResp': fire_resp, 'reqs': reqs,
           'proposals': proposals, 'cooling': cooling, 'sensors': sensors}

# ---------------------------------------------------------------- compact buildings
ZONES = sorted(set(b['z'] for b in B))
bl = []
for b, n in zip(B, net):
    bl.append([[c for p in b['p'] for c in (round(p[0], 5), round(p[1], 5))], b['h'], b['k'], b['y'], b['e'], b['f'],
               b['a'], b['r'], b['s'], ZONES.index(b['z']), n, b['real']])
for name, value in [('buildings', {'zones': ZONES, 'b': bl}), ('base', base), ('mobility', mobility), ('systems', systems)]:
    json.dump(value, open(WORK / f'out_{name}.json', 'w'), separators=(',', ':'))
