"""Step 1: base geography for Lower Manhattan from the pinned deck.gl sample files.

Derives a land mask and shoreline from where streets, residents and buildings are, a street network
from the taxi trip paths (streets no sampled cab used are missing), approximate park outlines at real
park locations, and place labels. Writes work/geo.npz (rasters), work/base.json and work/segs.json.
"""
import json, math
import numpy as np
from scipy import ndimage
from skimage.draw import line as skline, polygon as skpoly
from skimage.measure import find_contours
from config import cache_paths

RAW, WORK, OUT = cache_paths()

W, E, S, N = -74.032, -73.955, 40.693, 40.752
LAT0 = 40.72
MX = 111320 * math.cos(math.radians(LAT0))   # m per degree lng
MY = 110950.0                                # m per degree lat
RES = 5.0                                    # m per pixel
NX = int(round((E - W) * MX / RES)); NY = int(round((N - S) * MY / RES))

def px(lng, lat):
    return (np.asarray(lng) - W) * MX / RES, (N - np.asarray(lat)) * MY / RES

def ll(col, row):
    return W + np.asarray(col) * RES / MX, N - np.asarray(row) * RES / MY

def meters(a, b):
    return math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MY)

def disk_se(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r

def inside(p):
    return W < p[0] < E and S < p[1] < N

def is_tunnel(a, b):
    m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    return m[0] < -74.0135 and 40.7245 < m[1] < 40.7315

trips = json.load(open(RAW / 'trips-v7.json'))
blds = json.load(open(RAW / 'buildings.json'))
res = json.load(open(RAW / 'manhattan.json'))

# ---------- traffic intensity raster + segment list ----------
intensity = np.zeros((NY, NX), np.float32)
segs = []
for t in trips:
    p = t['path']
    for a, b in zip(p[:-1], p[1:]):
        if not (inside(a) and inside(b)) or is_tunnel(a, b):
            continue
        L = meters(a, b)
        if L < 0.5 or L > 1300:
            continue
        segs.append((a, b, L))
        c0, r0 = px(a[0], a[1]); c1, r1 = px(b[0], b[1])
        rr, cc = skline(int(r0), int(c0), int(r1), int(c1))
        ok = (rr >= 0) & (rr < NY) & (cc >= 0) & (cc < NX)
        intensity[rr[ok], cc[ok]] += 1
intensity_s = ndimage.gaussian_filter(intensity, 2.0)
print('segments', len(segs))

# ---------- land mask ----------
street = np.zeros((NY, NX), bool)
for a, b, L in segs:
    if L > 150:
        continue
    c0, r0 = px(a[0], a[1]); c1, r1 = px(b[0], b[1])
    rr, cc = skline(int(r0), int(c0), int(r1), int(c1))
    ok = (rr >= 0) & (rr < NY) & (cc >= 0) & (cc < NX)
    street[rr[ok], cc[ok]] = True
land = ndimage.binary_dilation(street, disk_se(5))
resm = np.zeros_like(land)
for q in res:
    if inside(q):
        c, r = px(q[0], q[1])
        if 0 <= r < NY and 0 <= c < NX:
            resm[int(r), int(c)] = True
land |= ndimage.binary_dilation(resm, disk_se(12))
bmask = np.zeros_like(land)
for f in blds:
    p = np.array(f['polygon']); c, r = px(p[:, 0], p[:, 1])
    rr, cc = skpoly(r, c, shape=bmask.shape); bmask[rr, cc] = True
land |= bmask
pad = 40
L2 = np.pad(land, pad)
L2 = ndimage.binary_closing(L2, disk_se(16))
L2 = ndimage.binary_opening(L2, disk_se(10))
land = L2[pad:-pad, pad:-pad]

# Brooklyn: fill south / east of the derived shoreline
cols_ll, _ = ll(np.arange(NX), 0)
rows_lat = ll(0, np.arange(NY))[1]
bk = np.zeros_like(land)
for c in range(NX):
    lng = cols_ll[c]
    if lng > -74.0005:
        zone_rows = np.where((rows_lat < 40.7062) & land[:, c])[0]
        if len(zone_rows):
            bk[zone_rows.min():, c] = True
for r in range(NY):
    lat = rows_lat[r]
    if lat < 40.7255:
        zone_cols = np.where((cols_ll > -73.9690) & land[r, :])[0]
        if len(zone_cols):
            bk[r, zone_cols.min():] = True
land |= bk
gpl = [(-73.9622, 40.7240), (-73.9616, 40.7300), (-73.9621, 40.7350), (-73.9600, 40.7400), (-73.9590, 40.7450),
       (-73.9585, 40.7525), (-73.9500, 40.7525), (-73.9500, 40.7240)]
c, r = px([p[0] for p in gpl], [p[1] for p in gpl]); rr, cc = skpoly(r, c, shape=land.shape); land[rr, cc] = True

# New Jersey waterfront (hand-drawn, approximate)
nj = [(-74.0400, 40.6930), (-74.0332, 40.6930), (-74.0318, 40.7060), (-74.0312, 40.7125), (-74.0309, 40.7170),
      (-74.0302, 40.7230), (-74.0298, 40.7280), (-74.0282, 40.7330), (-74.0268, 40.7372), (-74.0258, 40.7430),
      (-74.0247, 40.7480), (-74.0238, 40.7520), (-74.0400, 40.7520)]
c, r = px([p[0] for p in nj], [p[1] for p in nj]); rr, cc = skpoly(r, c, shape=land.shape); land[rr, cc] = True
land = ndimage.binary_fill_holes(land)
lab, n = ndimage.label(land)
sizes = ndimage.sum(land, lab, range(1, n + 1))
land = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 3000])

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a; nab = np.hypot(*ab)
    if nab == 0:
        d = np.hypot(*(pts - a).T)
    else:
        d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / nab
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])

def vectorize(mask, eps_px=0.8, min_pts=8):
    m = np.pad(mask.astype(float), 1)
    out = []
    for cnt in find_contours(m, 0.5):
        cnt = cnt - 1
        if len(cnt) < min_pts:
            continue
        s = rdp(cnt[:, ::-1], eps_px)          # (col,row)
        lng, lat = ll(s[:, 0], s[:, 1])
        out.append([[round(float(x), 6), round(float(y), 6)] for x, y in zip(lng, lat)])
    return out

land_polys = vectorize(ndimage.gaussian_filter(land.astype(float), 1.2) > 0.5)
print('land polygons', len(land_polys), [len(p) for p in land_polys])

# ---------- parks (approximate footprints of real parks) ----------
def rrect(lng, lat, w, h, ang):
    a = math.radians(ang); pts = []
    for dx, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]:
        x = dx * math.cos(a) - dy * math.sin(a); y = dx * math.sin(a) + dy * math.cos(a)
        pts.append([round(lng + x / MX, 6), round(lat + y / MY, 6)])
    return pts

PARKS = [
    ('Washington Square Park', -73.9973, 40.7308, 300, 190, -29),
    ('Union Square', -73.9906, 40.7359, 110, 230, -29),
    ('Tompkins Square Park', -73.9818, 40.7265, 200, 230, -29),
    ('City Hall Park', -74.0068, 40.7126, 170, 270, -25),
    ('Battery Park', -74.0158, 40.7038, 260, 220, -10),
    ('Columbus Park', -73.9999, 40.7156, 110, 150, -29),
    ('Sara D. Roosevelt Park', -73.9925, 40.7204, 55, 780, -29),
    ('Seward Park', -73.9893, 40.7145, 110, 120, -29),
    ('Madison Square Park', -73.9880, 40.7421, 190, 240, -29),
    ('Stuyvesant Square', -73.9838, 40.7339, 75, 190, -29),
    ('Gramercy Park', -73.9862, 40.7381, 60, 140, -29),
    ('Rockefeller Park', -74.0166, 40.7170, 120, 280, -8),
    ('Corlears Hook Park', -73.9800, 40.7118, 140, 100, -20),
    ('Duarte Square', -74.0050, 40.7225, 45, 70, -29),
]
parkmask = np.zeros_like(land)
parks = []
def add_park(name, m):
    global parkmask
    m = m & land
    parkmask |= m
    polys = vectorize(m, eps_px=0.6, min_pts=4)
    if polys:
        big = max(polys, key=len)
        parks.append({'name': name, 'polygon': big})
for n, x, y, w, h, a in PARKS:
    pr = np.array(rrect(x, y, w, h, a)); c, r = px(pr[:, 0], pr[:, 1]); rr, cc = skpoly(r, c, shape=land.shape)
    m = np.zeros_like(land); m[rr, cc] = True; add_park(n, m)
# waterfront parks that follow the derived coastline
def add_band(m, edges, a, b):
    rows = np.array([e[0] for e in edges if e[1] >= 0]); cs = np.array([e[1] for e in edges if e[1] >= 0], float)
    if len(rows) < 5:
        return
    cs = ndimage.uniform_filter1d(cs, 25, mode='nearest')
    for r, c in zip(rows, cs):
        c = int(round(c)); m[r, max(0, c + a):c + b] = True
m = np.zeros_like(land); edges = []
for r in range(NY):
    lat = rows_lat[r]
    if 40.7262 <= lat <= 40.7400:
        zc = np.where(land[r, :] & (cols_ll < -74.000) & (cols_ll > -74.0185))[0]
        edges.append((r, zc.min() if len(zc) else -1))
add_band(m, edges, 0, 9)
add_park('Hudson River Park', m)
m = np.zeros_like(land); edges = []
for r in range(NY):
    lat = rows_lat[r]
    if 40.7128 <= lat <= 40.7285:
        zc = np.where(land[r, :] & (cols_ll < -73.9690) & (cols_ll > -73.985))[0]
        edges.append((r, zc.max() if len(zc) else -1))
add_band(m, edges, -11, 1)
add_park('East River Park', m)

# ---------- streets: dedupe and classify ----------
best = {}
for a, b, L in segs:
    k = tuple(sorted([(round(a[0], 4), round(a[1], 4)), (round(b[0], 4), round(b[1], 4))]))
    if k[0] == k[1]:
        continue
    if k not in best:
        best[k] = (a, b, L)
streets = []
vals = []
for k, (a, b, L) in best.items():
    c0, r0 = px((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    v = float(intensity_s[min(NY - 1, max(0, int(r0))), min(NX - 1, max(0, int(c0)))])
    over_water = not land[min(NY - 1, max(0, int(r0))), min(NX - 1, max(0, int(c0)))]
    streets.append([a, b, v, over_water, L])
    vals.append(v)
q = np.quantile(vals, [0.55, 0.85, 0.97])
out_streets = []
for a, b, v, ow, L in streets:
    cls = 0 if v < q[0] else 1 if v < q[1] else 2 if v < q[2] else 3
    if ow:
        cls = max(cls, 2)
    out_streets.append([round(a[0], 5), round(a[1], 5), round(b[0], 5), round(b[1], 5), cls, 1 if ow else 0])
print('unique streets', len(out_streets), 'quantiles', q)

LABELS = [
    ('Financial District', -74.0090, 40.7070, 'hood'), ('Battery Park City', -74.0163, 40.7115, 'hood'),
    ('Tribeca', -74.0085, 40.7183, 'hood'), ('Civic Center', -74.0030, 40.7143, 'hood'),
    ('Chinatown', -73.9970, 40.7160, 'hood'), ('Two Bridges', -73.9915, 40.7112, 'hood'),
    ('Lower East Side', -73.9865, 40.7175, 'hood'), ('SoHo', -74.0013, 40.7235, 'hood'),
    ('Little Italy', -73.9972, 40.7195, 'hood'), ('NoHo', -73.9930, 40.7270, 'hood'),
    ('Greenwich Village', -73.9995, 40.7335, 'hood'), ('West Village', -74.0055, 40.7345, 'hood'),
    ('East Village', -73.9842, 40.7272, 'hood'), ('Stuyvesant Town', -73.9772, 40.7318, 'hood'),
    ('Gramercy', -73.9845, 40.7378, 'hood'), ('Flatiron', -73.9905, 40.7408, 'hood'),
    ('Chelsea', -74.0012, 40.7445, 'hood'), ('Meatpacking', -74.0072, 40.7402, 'hood'),
    ('Hudson River', -74.0215, 40.7265, 'water'), ('East River', -73.9805, 40.7062, 'water'),
    ('Upper New York Bay', -74.0215, 40.6985, 'water'), ('Brooklyn', -73.9790, 40.6975, 'boro'),
    ('Hoboken', -74.0292, 40.7480, 'boro'),
]
labels = []
for name, x, y, kind in LABELS:
    c, r = px(x, y); r = int(r); c = int(c)
    on_land = bool(land[r, c]) if (0 <= r < NY and 0 <= c < NX) else None
    labels.append({'name': name, 'pos': [x, y], 'kind': kind})
    if kind == 'water' and on_land:
        print('WARNING water label on land:', name)
    if kind == 'hood' and on_land is False:
        print('WARNING hood label on water:', name)

np.savez_compressed(WORK / 'geo.npz', land=land, park=parkmask, intensity=intensity_s, bmask=bmask,
                    street=street, meta=np.array([W, E, S, N, MX, MY, RES]))
json.dump({'bbox': [W, S, E, N], 'land': land_polys, 'parks': parks, 'streets': out_streets, 'labels': labels},
          open(WORK / 'base.json', 'w'), separators=(',', ':'))
json.dump({'segs': [[a, b] for a, b, L in segs]}, open(WORK / 'segs.json', 'w'))
print('NX,NY', NX, NY, 'land frac', land.mean())
