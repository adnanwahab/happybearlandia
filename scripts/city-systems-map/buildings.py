"""Step 2: fill the city fabric with synthetic buildings along the traced streets and give every
building (real footprint or synthetic) synthetic attributes: use, year built, energy use, rent and
rooftop solar. Writes work/bldg.npz (occupancy and height rasters) and work/buildings_full.json.
"""
import json, math
import numpy as np
from scipy import ndimage
from skimage.draw import polygon as skpoly, line as skline
import config

RAW, WORK, OUT = config.cache_paths()

g = np.load(WORK / 'geo.npz')
W, E, S, N, MX, MY, RES = g['meta']
land5, park5 = g['land'], g['park']
base = json.load(open(WORK / 'base.json'))
real = json.load(open(RAW / 'buildings.json'))
rng = np.random.default_rng(config.SEED_BUILDINGS)

R2 = 2.0
NX = int(round((E - W) * MX / R2)); NY = int(round((N - S) * MY / R2))
def px(lng, lat):
    return (np.asarray(lng) - W) * MX / R2, (N - np.asarray(lat)) * MY / R2

# upsample 5 m masks to 2 m grid
yy = (np.arange(NY) * R2 / RES).astype(int).clip(0, land5.shape[0] - 1)
xx = (np.arange(NX) * R2 / RES).astype(int).clip(0, land5.shape[1] - 1)
land = land5[np.ix_(yy, xx)]
park = park5[np.ix_(yy, xx)]
blocked = ~land | park
occ = np.zeros((NY, NX), bool)        # buildings
hgt = np.zeros((NY, NX), np.float32)  # building height raster

# street corridors (half widths in m by class)
HW = [8.0, 9.5, 13.0, 16.0]
streets = [s for s in base['streets'] if not s[5]]
# dilate each street class by its half width
corr = np.zeros((NY, NX), bool)
for cls in range(4):
    m = np.zeros((NY, NX), bool)
    for s in streets:
        if s[4] != cls:
            continue
        c0, r0 = px(s[0], s[1]); c1, r1 = px(s[2], s[3])
        rr, cc = skline(int(r0), int(c0), int(r1), int(c1))
        ok = (rr >= 0) & (rr < NY) & (cc >= 0) & (cc < NX)
        m[rr[ok], cc[ok]] = True
    r = int(round(HW[cls] / R2))
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    corr |= ndimage.binary_dilation(m, x * x + y * y <= r * r)
blocked |= corr

# real buildings
def zone(lng, lat):
    if lng > -73.9625 and lat > 40.736: return 'lic'
    if lng > -73.9625 and lat > 40.7240: return 'greenpoint'
    if lat < 40.7058 and lng > -74.0005: return 'dtbk' if lat < 40.6985 else 'dumbo'
    if lng > -73.9690 and lat < 40.7240: return 'wburg'
    if lng < -74.0135 and 40.7040 < lat < 40.7190: return 'bpc'
    if lat < 40.7135 and lng < -74.0020: return 'fidi'
    if lat < 40.7240 and lng < -74.0020: return 'tribeca'
    if lng > -73.9890 and lat < 40.7165: return 'twobridges'
    if lng > -74.0020 and lat < 40.7175: return 'chinatown'
    if lng > -73.9935 and lat < 40.7235: return 'les'
    if lng > -73.9820 and 40.7290 < lat < 40.7355: return 'stuytown'
    if lng > -73.9920 and lat < 40.7330: return 'eastvillage'
    if lat > 40.7360: return 'flatiron' if lng > -73.9960 else 'chelsea'
    if lng < -74.0010: return 'westvillage'
    return 'village'

# zone params: frontage(min,max), depth(min,max), height lognormal (median m, sigma), p(res,off,civ), year range, rent
Z = {
    'fidi':        ((20, 45), (24, 42), (70, 0.55), (0.30, 0.62, 0.08), (1900, 2020), 4600),
    'bpc':         ((24, 42), (22, 38), (60, 0.40), (0.70, 0.22, 0.08), (1982, 2012), 5200),
    'tribeca':     ((14, 30), (20, 34), (26, 0.40), (0.55, 0.38, 0.07), (1860, 2015), 6200),
    'chinatown':   ((7, 14), (16, 26), (19, 0.25), (0.55, 0.40, 0.05), (1880, 1975), 2900),
    'twobridges':  ((9, 30), (16, 34), (22, 0.55), (0.75, 0.18, 0.07), (1900, 2018), 2500),
    'les':         ((7, 13), (17, 25), (19, 0.25), (0.70, 0.26, 0.04), (1880, 2015), 3700),
    'eastvillage': ((7, 13), (17, 25), (18, 0.22), (0.74, 0.22, 0.04), (1870, 2010), 3900),
    'stuytown':    ((16, 30), (16, 26), (38, 0.10), (0.92, 0.06, 0.02), (1947, 1949), 4300),
    'village':     ((8, 22), (16, 28), (21, 0.35), (0.60, 0.33, 0.07), (1840, 1990), 4900),
    'westvillage': ((7, 16), (14, 24), (16, 0.30), (0.72, 0.24, 0.04), (1830, 1960), 5300),
    'flatiron':    ((14, 32), (20, 36), (40, 0.40), (0.35, 0.58, 0.07), (1890, 2015), 5100),
    'chelsea':     ((10, 26), (18, 32), (24, 0.40), (0.55, 0.38, 0.07), (1860, 2015), 5000),
    'dumbo':       ((16, 45), (20, 40), (24, 0.40), (0.45, 0.47, 0.08), (1890, 2018), 5100),
    'dtbk':        ((20, 40), (20, 36), (55, 0.60), (0.50, 0.42, 0.08), (1920, 2020), 4300),
    'wburg':       ((10, 30), (16, 34), (20, 0.45), (0.65, 0.28, 0.07), (1890, 2018), 4100),
    'greenpoint':  ((8, 20), (16, 28), (13, 0.30), (0.70, 0.22, 0.08), (1880, 2015), 3700),
    'lic':         ((24, 40), (24, 40), (95, 0.45), (0.70, 0.25, 0.05), (2005, 2024), 4200),
}

def attrs(lng, lat, h, area, z=None):
    z = z or zone(lng, lat)
    fr, dp, hh, pk, yr, rent = Z[z]
    kind = int(rng.choice(3, p=pk))
    if h > 110:
        kind = 1 if rng.random() < 0.7 else 0
    year = int(rng.integers(yr[0], yr[1] + 1))
    if h > 120:
        year = max(year, 1960)
    base_eui = [92, 135, 175][kind]                      # kBtu/ft2/yr
    age_adj = 0.25 * (2025 - year) / 120.0
    eui = base_eui * (1 + age_adj) * rng.lognormal(0, 0.18)
    floors = max(1, int(round(h / 3.6)))
    gfa = area * floors                                  # m2
    r = rent * rng.lognormal(0, 0.12) if kind == 0 else 0
    return z, kind, year, round(eui, 1), floors, gfa, int(round(r / 10) * 10)

def rect(cx, cy, w, d, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    for dx, dy in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]:
        x = cx + dx * ca - dy * sa; y = cy + dx * sa + dy * ca
        pts.append((x, y))
    return pts

out = []
# real footprints first
for f in real:
    p = np.array(f['polygon'])
    c, r = px(p[:, 0], p[:, 1])
    rr, cc = skpoly(r, c, shape=occ.shape)
    occ[rr, cc] = True; hgt[rr, cc] = np.maximum(hgt[rr, cc], f['height'])
    lng, lat = p[:, 0].mean(), p[:, 1].mean()
    area = max(1.0, len(rr) * R2 * R2)
    z, kind, year, eui, floors, gfa, rent = attrs(lng, lat, f['height'], area)
    out.append({'p': [[round(x, 6), round(y, 6)] for x, y in f['polygon']], 'h': f['height'], 'k': kind, 'y': year,
                'e': eui, 'f': floors, 'a': int(gfa), 'r': rent, 'z': z, 'real': 1})
blocked_real = ndimage.binary_dilation(occ, iterations=1)

# mock fill along streets
order = rng.permutation(len(streets))
placed = 0
for i in order:
    s = streets[i]
    ax_, ay_ = (s[0] - W) * MX, (N - s[1]) * MY        # meters, y down
    bx_, by_ = (s[2] - W) * MX, (N - s[3]) * MY
    L = math.hypot(bx_ - ax_, by_ - ay_)
    if L < 12:
        continue
    dx, dy = (bx_ - ax_) / L, (by_ - ay_) / L
    nx_, ny_ = -dy, dx
    ang = math.atan2(dy, dx)
    hw = HW[s[4]]
    midlng, midlat = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
    z = zone(midlng, midlat)
    fr, dp, hh, pk, yr, rent = Z[z]
    for side in (1, -1):
        t = rng.uniform(0, 4)
        while t < L - 6:
            w = rng.uniform(*fr); d = rng.uniform(*dp)
            if t + w > L + 4:
                break
            off = hw + 0.6 + d / 2
            cx = ax_ + dx * (t + w / 2) + nx_ * side * off
            cy = ay_ + dy * (t + w / 2) + ny_ * side * off
            pts = rect(cx, cy, w, d, ang)
            cols = np.array([p[0] / R2 for p in pts]); rows = np.array([p[1] / R2 for p in pts])
            rr, cc = skpoly(rows, cols, shape=occ.shape)
            if len(rr) < 6 or blocked[rr, cc].any() or occ[rr, cc].any() or blocked_real[rr, cc].any():
                t += 4
                continue
            h = float(np.clip(rng.lognormal(math.log(hh[0]), hh[1]), 6, 330))
            if z in ('les', 'eastvillage', 'chinatown') and rng.random() < 0.06:
                h = rng.uniform(30, 60)
            occ[rr, cc] = True; hgt[rr, cc] = h
            lngs = [W + p[0] / MX for p in pts]; lats = [N - p[1] / MY for p in pts]
            area = w * d
            zz, kind, year, eui, floors, gfa, rentv = attrs(sum(lngs) / 4, sum(lats) / 4, h, area, z)
            out.append({'p': [[round(x, 6), round(y, 6)] for x, y in zip(lngs, lats)], 'h': round(h, 1), 'k': kind,
                        'y': year, 'e': eui, 'f': floors, 'a': int(gfa), 'r': rentv, 'z': zz, 'real': 0})
            placed += 1
            t += w + rng.uniform(0.4, 1.6)
print('real', len(real), 'mock placed', placed)

# Stuyvesant Town: towers inside the campus (no internal streets in the data)
for k in range(34):
    lng = rng.uniform(-73.9812, -73.9742); lat = rng.uniform(40.7296, 40.7345)
    cx, cy = (lng - W) * MX, (N - lat) * MY
    ang = math.radians(rng.choice([-29, 61]))
    pts = rect(cx, cy, 48, 16, ang)
    cols = np.array([p[0] / R2 for p in pts]); rows = np.array([p[1] / R2 for p in pts])
    rr, cc = skpoly(rows, cols, shape=occ.shape)
    if len(rr) < 6 or blocked[rr, cc].any() or occ[rr, cc].any():
        continue
    occ[rr, cc] = True; hgt[rr, cc] = 40
    lngs = [W + p[0] / MX for p in pts]; lats = [N - p[1] / MY for p in pts]
    zz, kind, year, eui, floors, gfa, rentv = attrs(lng, lat, 40, 48 * 16, 'stuytown')
    out.append({'p': [[round(x, 6), round(y, 6)] for x, y in zip(lngs, lats)], 'h': 40, 'k': 0, 'y': year, 'e': eui,
                'f': floors, 'a': int(gfa), 'r': rentv or 4300, 'z': zz, 'real': 0})

# rooftop solar potential: shading from taller neighbours within ~60 m
hmax = ndimage.maximum_filter(hgt, size=31)
for b in out:
    p = np.array(b['p']); c, r = px(p[:, 0].mean(), p[:, 1].mean())
    r = int(np.clip(r, 0, NY - 1)); c = int(np.clip(c, 0, NX - 1))
    shade = float(np.clip(1 - (hmax[r, c] - b['h']) / 80.0, 0.25, 1.0))
    roof = b['a'] / max(1, b['f'])
    b['s'] = int(roof * 0.55 * 175 * shade)            # kWh per year
print('total buildings', len(out))
np.savez_compressed(WORK / 'bldg.npz', occ=occ, hgt=hgt, R2=np.array([R2]))
json.dump(out, open(WORK / 'buildings_full.json', 'w'), separators=(',', ':'))
