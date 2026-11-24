// City Systems Map: every layer reads data/city-systems-map/ (see docs/city-systems-map.md).
// Scenario rules, time curves and KPI formulas below are synthetic presentation rules, not a calibrated model.
(async function () {
const D = window.deck;
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const g = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// ---------- palette (validated dark-mode categorical slots + status) ----------
const C = {
  blue: hex('#3987e5'), orange: hex('#d95926'), aqua: hex('#199e70'), yellow: hex('#c98500'),
  magenta: hex('#d55181'), violet: hex('#9085e9'), red: hex('#e66767'),
  good: hex('#0ca30c'), warning: hex('#fab219'), serious: hex('#ec835a'), critical: hex('#d03b3b'),
  ink: [238, 241, 244], muted: [124, 134, 146]
};
const RAMP = {
  blue: ['#0d366b', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6', '#cde2fb'].map(hex),
  orange: ['#4a1d0b', '#7a3014', '#a8431c', '#d95926', '#eb7a4e', '#f3a07c', '#f8c4a9', '#fde3d4'].map(hex),
  violet: ['#2a2468', '#3b3394', '#5146bd', '#6b5fd9', '#9085e9', '#ada5f0', '#cac4f6', '#e4e1fb'].map(hex),
  magenta: ['#4d1229', '#7a1d42', '#a8285c', '#d55181', '#e47aa0', '#ee9fbb', '#f6c4d6', '#fbe1ea'].map(hex),
  aqua: ['#073d2a', '#0b5a3f', '#127a56', '#199e70', '#3dbb8d', '#74d2ad', '#a8e4cc', '#d4f3e6'].map(hex)
};
function ramp(name, t) {
  const r = RAMP[name]; t = clamp(t, 0, 1) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(t)); return mix(r[i], r[i + 1], t - i);
}
const rampCss = (name) => `linear-gradient(90deg, ${RAMP[name].map((c) => `rgb(${c})`).join(',')})`;

// ---------- state ----------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  t: 17.5 * 3600, playing: !reduce, speed: 30, scenario: 'normal', surge: 9,
  field: 'heat', bmode: 'neutral', view3d: true,
  on: new Set(['buildings', 'traffic', 'subway', 'labels'])
};
const hour = () => state.t / 3600;

// ---------- load data ----------
if (!D) { $('loading').textContent = 'The deck.gl library could not be loaded. Check your connection and reload.'; return; }
const DATA = '/data/city-systems-map/';
// one file per city system, each a JSON array with one record per line
const FILES = ['meta', 'land', 'parks', 'streets', 'labels', 'buildings', 'taxis', 'vans', 'ambulances', 'trucks', 'walkers',
  'subway-lines', 'subway-stations', 'subway-trains', 'bus-routes', 'buses', 'ferry-routes', 'ferries', 'bike-docks', 'commute',
  'crashes', 'parking', 'fields', 'wind', 'trees', 'sewer-outfalls', 'water-mains', 'main-breaks', 'construction', 'substations',
  'feeders', 'steam-mains', 'steam-vents', 'ev-chargers', 'cell-sites', 'litter-baskets', 'residents', 'schools', 'storefronts',
  'hospitals', 'firehouses', 'fire-response', 'requests-311', 'proposals', 'cooling-centers', 'sensors'];
const got = {};
let done = 0;
try {
  await Promise.all(FILES.map((n) => fetch(`${DATA}${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })
    .then((j) => { got[n] = j; $('loading').textContent = `Loading Lower Manhattan… ${Math.round(++done / FILES.length * 100)}%`; })));
} catch (e) {
  $('loading').textContent = "The map data couldn't be loaded. Reload the page to try again.";
  return;
}
const meta = got.meta[0];
const base = { bbox: meta.bbox, land: got.land, parks: got.parks, streets: got.streets, labels: got.labels };
const bld = { b: got.buildings };
const mob = { loop: meta.loop, taxis: got.taxis, vans: got.vans, ambulance: got.ambulances, trucks: got.trucks, walkers: got.walkers,
  subway: { lines: got['subway-lines'], stations: got['subway-stations'], trains: got['subway-trains'] },
  bus: { routes: got['bus-routes'], buses: got.buses }, ferry: { routes: got['ferry-routes'], boats: got.ferries },
  citibike: got['bike-docks'], commute: got.commute, crashes: got.crashes, parking: got.parking };
const sys = { fields: Object.assign({ w: meta.fw, h: meta.fh }, ...got.fields.map((f) => ({ [f.name]: f.data }))),
  species: meta.species, wind: got.wind, trees: got.trees, cso: got['sewer-outfalls'], mains: got['water-mains'], leaks: got['main-breaks'],
  construction: got.construction, subs: got.substations, feeders: got.feeders, steam: got['steam-mains'], vents: got['steam-vents'],
  ev: got['ev-chargers'], cells: got['cell-sites'], baskets: got['litter-baskets'], residents: got.residents, schools: got.schools,
  stores: got.storefronts, hospitals: got.hospitals, fire: got.firehouses, fireResp: got['fire-response'], reqs: got['requests-311'],
  proposals: got.proposals, cooling: got['cooling-centers'], sensors: got.sensors };
try { await document.fonts.ready; } catch (e) {}

const [W, S, E, N] = base.bbox;
const pairs = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; };

// streets
const streets = base.streets.map((s, i) => ({ i, path: [[s[0], s[1]], [s[2], s[3]]], c: s[4], b: s[5],
  mid: [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2], r: ((i * 2654435761) % 1000) / 1000 }));
// buildings
const ZNAME = { fidi: 'Financial District', bpc: 'Battery Park City', tribeca: 'Tribeca', chinatown: 'Chinatown',
  twobridges: 'Two Bridges', les: 'Lower East Side', eastvillage: 'East Village', stuytown: 'Stuyvesant Town',
  village: 'Greenwich Village', westvillage: 'West Village', flatiron: 'Flatiron', chelsea: 'Chelsea', dumbo: 'DUMBO',
  dtbk: 'Downtown Brooklyn', wburg: 'Williamsburg', greenpoint: 'Greenpoint', lic: 'Long Island City' };
const KIND = ['Residential', 'Office & retail', 'Civic & utility'];
const buildings = bld.b.map((r, i) => {
  const poly = pairs(r[0]); let cx = 0, cy = 0; poly.forEach((p) => { cx += p[0]; cy += p[1]; });
  const k = r[2], a = r[6];
  return { i, poly, h: r[1], k, y: r[3], e: r[4], f: r[5], a, rent: r[7], s: r[8], z: r[9], net: r[10], real: r[11],
    c: [cx / poly.length, cy / poly.length], jobs: k === 1 ? a / 22 : k === 2 ? a / 70 : a / 420, res: k === 0 ? a / 68 : 0 };
});
// trips
const tripify = (arr) => arr.map((d, i) => ({ ...d, path: pairs(d.p), i }));
const taxis = tripify(mob.taxis), vans = tripify(mob.vans), amb = tripify(mob.ambulance), trucks = tripify(mob.trucks);
const walkers = tripify(mob.walkers), trains = tripify(mob.subway.trains), buses = tripify(mob.bus.buses), boats = tripify(mob.ferry.boats);
const wind = sys.wind.map((d, i) => { const p = pairs(d.p); const t0 = d.t[0]; const ph = ((i * 7919) % 1000) / 1000 * 12;
  return { path: p, ts: d.t.map((x) => x - t0 + ph), s: d.s }; });
const LOOP = mob.loop;

// fields
const F = sys.fields; const FW = F.w, FH = F.h;
const dec = (b64) => { const s = atob(b64); const a = new Float32Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) / 255; return a; };
const field = {}; ['land', 'heat', 'air', 'noiseD', 'noiseN', 'elev', 'built', 'well'].forEach((k) => { field[k] = dec(F[k]); });
for (let i = 0; i < field.elev.length; i++) field.elev[i] *= 25;          // metres
const landSoft = new Float32Array(field.land.length);
for (let r = 0; r < F.h; r++) for (let q = 0; q < F.w; q++) { let s = 0, n = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) { const rr = r + dr, qq = q + dq; if (rr >= 0 && qq >= 0 && rr < F.h && qq < F.w) { s += field.land[rr * F.w + qq]; n++; } }
  landSoft[r * F.w + q] = s / n; }
const fIdx = (lng, lat) => { const c = Math.floor((lng - W) / (E - W) * FW), r = Math.floor((N - lat) / (N - S) * FH);
  return (c < 0 || r < 0 || c >= FW || r >= FH) ? -1 : r * FW + c; };

// ---------- scenario model ----------
const SCEN = {
  normal: { name: 'Typical day', s: 'Mid-September weekday', tmid: 73.5, tamp: 7.5, pm: 8, traffic: 1, speed: 0,
    note: 'A clear, mild weekday. Watch the morning and evening rush move through traffic, transit and the grid.' },
  heat: { name: 'Heat wave', s: '99°F afternoon high', tmid: 90.5, tamp: 8.5, pm: 15, traffic: 0.95, speed: -1,
    note: 'Air-conditioning pushes the grid toward its limit, cooling centers open and ER waits climb.' },
  storm: { name: 'Coastal storm', s: 'Storm tide and heavy rain', tmid: 70, tamp: 2, pm: 4, traffic: 0.5, speed: -4,
    note: 'Set the storm tide below. Above 9 ft, two waterfront substations flood and lower-Manhattan subway service stops.' },
  grid: { name: 'Grid failure', s: 'Two substations trip', tmid: 88, tamp: 7, pm: 11, traffic: 0.9, speed: -2,
    note: 'At 2:10 PM two substations trip on a hot afternoon. Lights, signals, cell sites and trains in their area go dark.' }
};
const demand = (h) => Math.min(1, 0.14 + 0.64 * g(h, 8.6, 1.2) + 0.42 * g(h, 13, 2.6) + 0.68 * g(h, 17.8, 1.5) + 0.22 * g(h, 21.6, 1.8) + 0.1 * g(h, -0.5, 1.4) + 0.1 * g(h, 24.5, 1.4));
const officeOcc = (h) => 0.04 + 0.92 * sstep(7, 9.6, h) * (1 - sstep(16.8, 19.5, h));
const resOcc = (h) => 0.92 - 0.6 * sstep(6.8, 9, h) * (1 - sstep(16.5, 19.5, h));
const civicOcc = (h) => 0.06 + 0.8 * sstep(7.5, 9, h) * (1 - sstep(17, 20, h));
const occOf = (b, h) => b.k === 0 ? resOcc(h) : b.k === 1 ? officeOcc(h) : civicOcc(h);
const airTemp = (h) => { const s = SCEN[state.scenario]; return s.tmid + s.tamp * Math.cos(2 * Math.PI * (h - 15) / 24); };
function offline() {
  if (state.scenario === 'storm' && state.surge >= 9) return new Set([0, 1]);
  if (state.scenario === 'grid' && hour() >= 14.1667) return new Set([3, 5]);
  return new Set();
}
const OUT_LINES = { storm: ['1', '2 3', '4 5 6', 'A C E', 'B D F M', 'N Q R W', 'J Z', 'L'], grid: ['J Z', 'B D F M'] };
function suspendedLines() {
  if (state.scenario === 'storm' && state.surge >= 8) return new Set(OUT_LINES.storm);
  if (state.scenario === 'grid' && hour() >= 14.1667) return new Set(OUT_LINES.grid);
  return new Set();
}

// sun (NOAA-style approximation), Sep 15 2026, EDT
const DOY = 258;
function sun(h) {
  const gm = 2 * Math.PI / 365 * (DOY - 1 + (h - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(gm) + 0.070257 * Math.sin(gm) - 0.006758 * Math.cos(2 * gm) + 0.000907 * Math.sin(2 * gm);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(gm) - 0.032077 * Math.sin(gm) - 0.014615 * Math.cos(2 * gm) - 0.040849 * Math.sin(2 * gm));
  const tst = h * 60 + eqt + 4 * -74.0 + 240;
  const ha = (tst / 4 - 180) * Math.PI / 180, phi = 40.72 * Math.PI / 180;
  const up = Math.sin(decl) * Math.sin(phi) + Math.cos(decl) * Math.cos(ha) * Math.cos(phi);
  return { alt: Math.asin(clamp(up, -1, 1)) };
}
const daylight = (h) => clamp(Math.sin(sun(h).alt) * 3.2 + 0.25, 0, 1);    // 0 night .. 1 day
function crossing(a, b, rising) { for (let k = 0; k < 40; k++) { const m = (a + b) / 2; const up = sun(m).alt > -0.0145; if (up === rising) b = m; else a = m; } return (a + b) / 2; }
const SUNRISE = crossing(4, 9, true), SUNSET = crossing(16, 21, false);

// ---------- ground overlays ----------
const FIELD_META = {
  heat: { name: 'Surface temperature', ramp: 'orange', unit: '°F' },
  air: { name: 'Fine particles (PM2.5)', ramp: 'violet', unit: 'µg/m³' },
  noise: { name: 'Noise level', ramp: 'magenta', unit: 'dB(A)' },
  flood: { name: 'Flood depth', ramp: 'blue', unit: 'ft' },
  cell: { name: 'Cell signal (RSRP)', ramp: 'aqua', unit: 'dBm' },
  well: { name: 'Well-being index', ramp: 'blue', unit: '/100' }
};
let cellCache = { key: '', v: null };
function cellField() {
  const off = offline(); const key = [...off].join(',');
  if (cellCache.key === key && cellCache.v) return cellCache.v;
  const v = new Float32Array(FW * FH).fill(-140);
  const sites = sys.cells.filter((c) => !siteDown(c, off));
  for (const c of sites) {
    const cx = (c.pos[0] - W) / (E - W) * FW, cy = (N - c.pos[1]) / (N - S) * FH;
    const ptx = c.k === 'macro' ? 46 : 30, cm = 20;  // metres per cell
    const R = c.k === 'macro' ? 90 : 40;
    for (let r = Math.max(0, Math.floor(cy - R)); r < Math.min(FH, cy + R); r++)
      for (let q = Math.max(0, Math.floor(cx - R)); q < Math.min(FW, cx + R); q++) {
        const d = Math.hypot(q - cx, r - cy) * cm / 1000 + 0.02;
        const val = ptx - (128.1 + 37.6 * Math.log10(d)) + 15; const i = r * FW + q;
        if (val > v[i]) v[i] = val;
      }
  }
  for (let i = 0; i < v.length; i++) v[i] -= 14 * field.built[i];
  cellCache = { key, v }; return v;
}
function siteDown(c, off) {
  if (!off.size || c.bk) return false;
  let best = -1, bd = 1e9; sys.subs.forEach((s, i) => { const d = (s.pos[0] - c.pos[0]) ** 2 + (s.pos[1] - c.pos[1]) ** 2; if (d < bd) { bd = d; best = i; } });
  return off.has(best);
}
function fieldValue(name, i, h) {
  const day = daylight(h);
  if (name === 'heat') { const ta = airTemp(h); return ta + field.heat[i] * (5 + 17 * day * (state.scenario === 'storm' ? 0.3 : 1)); }
  if (name === 'air') return SCEN[state.scenario].pm + field.air[i] * 13 * (0.45 + 0.65 * demand(h)) * (state.scenario === 'storm' ? 0.5 : 1);
  if (name === 'noise') { const n = 1 - sstep(20, 23, h) * 1 + sstep(5.5, 7.5, h) * 1; const w = h >= 20.5 || h < 6 ? 1 : 0;
    return 47 + 31 * (w ? Math.max(field.noiseN[i], field.noiseD[i] * 0.55) : field.noiseD[i] * (0.75 + 0.3 * demand(h))) + (state.scenario === 'storm' ? 4 : 0); }
  if (name === 'flood') { const tide = state.scenario === 'storm' ? state.surge : 0; return tide - field.elev[i] * 3.281; }
  if (name === 'cell') return cellField()[i];
  if (name === 'well') { const adj = { normal: 0, heat: -12, storm: -16, grid: -10 }[state.scenario];
    return clamp(100 * field.well[i] + adj - (state.scenario === 'heat' ? 10 * field.heat[i] : 0), 0, 100); }
  return 0;
}
function fieldRange(name, h) {
  if (name === 'heat') { const ta = airTemp(h); return [Math.round(ta), Math.round(ta + 5 + 17 * daylight(h))]; }
  if (name === 'air') return [0, 30];
  if (name === 'noise') return [50, 78];
  if (name === 'flood') return [0, 8];
  if (name === 'cell') return [-120, -70];
  return [0, 100];
}
let fieldImg = { key: '', img: null };
function fieldImage() {
  const name = state.field; if (name === 'none') return null;
  const h = hour(); const key = [name, state.scenario, state.surge, Math.floor(state.t / 600), [...offline()].join()].join('|');
  if (fieldImg.key === key) return fieldImg.img;
  const [lo, hi] = fieldRange(name, h); const meta = FIELD_META[name];
  const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH; const fctx = cv.getContext('2d');
  const img = fctx.createImageData(FW, FH); const d = img.data;
  for (let i = 0; i < FW * FH; i++) {
    const lf = landSoft[i], land = lf > 0.5;
    if (lf < 0.05 && name !== 'air') continue;
    const v = fieldValue(name, i, h);
    if (name === 'flood' && v <= 0.05) continue;
    const t = clamp((v - lo) / (hi - lo), 0, 1);
    const col = ramp(meta.ramp, 0.3 + 0.7 * t);
    const tt = Math.pow(t, 1.35);
    let a = name === 'flood' ? 130 + 100 * t : (land ? 8 + 190 * tt : 6 + 80 * tt);
    if (name !== 'air') a *= Math.min(1, lf * 1.25);
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = a;
  }
  fctx.putImageData(img, 0, 0);
  fieldImg = { key, img: cv };
  return cv;
}

// ---------- KPIs ----------
function vitals() {
  const h = hour(), sc = SCEN[state.scenario], off = offline(), sus = suspendedLines();
  const dem = demand(h) * sc.traffic;
  let speed = 18.5 - 9.5 * dem + sc.speed - (off.size ? 2.5 : 0);
  const vehicles = Math.round(2600 * dem);
  const ta = airTemp(h); const peak = ta + 5 + 17 * daylight(h) * (state.scenario === 'storm' ? 0.3 : 1);
  const cool = clamp((ta - 70) / 24, 0, 1) * 0.36;
  let load = 0.40 + 0.25 * officeOcc(h) + 0.08 * g(h, 20, 2.2) + cool + (state.scenario === 'heat' ? 0.06 : 0);
  if (off.size) load = Math.min(1.04, load + 0.17);
  const ct = state.t % 3600; let trainsNow = 0;
  for (const tr of visibleTrains()) { if (tr.t[0] <= ct && tr.t[tr.t.length - 1] >= ct) trainsNow++; }
  const pm = sc.pm + 13 * (0.45 + 0.65 * demand(h)) * (state.scenario === 'storm' ? 0.5 : 1);
  const reqs = reqsToday().length;
  return { speed, vehicles, ta, peak, load, trainsNow, sus, pm, reqs, off };
}
function status(level) { return { good: 'var(--good)', warning: 'var(--warning)', serious: 'var(--serious)', critical: 'var(--critical)' }[level]; }
function chip(level, text) { return `<span class="chip" style="color:${status(level)}">${text}</span>`; }
function aqi(pm) { return pm <= 9 ? ['good', 'Good'] : pm <= 35.4 ? ['warning', 'Moderate'] : pm <= 55.4 ? ['serious', 'Unhealthy for some'] : ['critical', 'Unhealthy']; }
let lastKpi = 0;
function renderKpis(force) {
  const now = performance.now(); if (!force && now - lastKpi < 300) return; lastKpi = now;
  const v = vitals();
  const sp = v.speed < 6 ? ['critical', 'Gridlock'] : v.speed < 9 ? ['serious', 'Heavy'] : v.speed < 12 ? ['warning', 'Slow'] : ['good', 'Moving'];
  const ld = v.load >= 0.97 ? ['critical', 'Overload'] : v.load >= 0.9 ? ['serious', 'Strained'] : v.load >= 0.8 ? ['warning', 'High'] : ['good', 'Normal'];
  const sub = v.sus.size >= 8 ? ['critical', 'Suspended'] : v.sus.size ? ['serious', 'Partial'] : ['good', 'Running'];
  const hot = v.peak >= 105 ? ['critical', 'Extreme'] : v.peak >= 95 ? ['serious', 'Hot'] : v.peak >= 88 ? ['warning', 'Warm'] : ['good', 'Mild'];
  const aq = aqi(v.pm);
  const tiles = [
    ['Traffic', `${v.speed.toFixed(1)}<small>mph</small>`, `${fmt(v.vehicles)} vehicles moving`, sp],
    ['Subway', `${v.sus.size >= 8 ? 0 : v.trainsNow}<small>trains</small>`, v.sus.size >= 8 ? 'Lower Manhattan service stopped' : v.sus.size ? `${[...v.sus].join(', ')} out` : headway(), sub],
    ['Surface heat', `${Math.round(v.peak)}<small>°F peak</small>`, `Air ${Math.round(v.ta)}°F`, hot],
    ['Power grid', `${Math.round(v.load * 100)}<small>% load</small>`, v.off.size ? `${v.off.size} substations offline` : 'All 7 substations up', v.off.size ? ['critical', 'Outage'] : ld],
    ['Air quality', `${v.pm.toFixed(0)}<small>µg/m³</small>`, 'Peak PM2.5 at street level', aq],
    ['311 requests', `${fmt(v.reqs)}`, `Top today: ${topReq()}`, v.reqs > 1500 ? ['warning', 'Busy'] : ['good', 'Normal']]
  ];
  $('kpis').innerHTML = tiles.map(([k, val, d, st]) =>
    `<div class="kpi" style="--st:${status(st[0])}"><div class="k">${k}${chip(st[0], st[1])}</div><div class="v">${val}</div><div class="d">${d}</div></div>`).join('');
}
function headway() { const h = hour(); return (h >= 6.5 && h < 10) || (h >= 16 && h < 19.5) ? 'Every 4 min at rush hour' : h >= 1 && h < 5.5 ? 'Every 16 min overnight' : 'Every 8 min'; }

// ---------- time-dependent subsets ----------
let trainCache = { key: '', d: null };
function visibleTrains() {
  const h = hour(), sus = suspendedLines();
  const rush = (h >= 6.5 && h < 10) || (h >= 16 && h < 19.5), night = h >= 1 && h < 5.5;
  const key = `${rush}|${night}|${[...sus].join()}`;
  if (trainCache.key === key) return trainCache.d;
  const d = trains.filter((t) => !sus.has(t.l) && (rush || (night ? t.h === 0 : t.h % 2 === 0)));
  trainCache = { key, d }; return d;
}
let subsetCache = {};
function subset(name, arr, frac) {
  const n = Math.round(arr.length * clamp(frac, 0, 1) / 10) * 10;
  const c = subsetCache[name]; if (c && c.n === n) return c.d;
  const d = arr.slice(0, Math.max(0, n)); subsetCache[name] = { n, d }; return d;
}
const REQ_CAT = ['Noise', 'Street & sidewalk', 'Sanitation', 'Other'];
const REQ_SUB = [['Loud music or party', 'Construction after hours', 'Banging or pounding', 'Car horn', 'Loud talking', 'Barking dog'],
  ['Pothole', 'Blocked sidewalk', 'Street light out', 'Illegal parking', 'Broken curb', 'Blocked bike lane'],
  ['Missed collection', 'Overflowing litter basket', 'Rodent sighting', 'Dirty sidewalk', 'Illegal dumping', 'Graffiti'],
  ['Heat or hot water', 'Water leak', 'Damaged tree', 'Traffic signal out', 'Sewer backup', 'Air quality complaint']];
let reqCache = { key: '', d: null };
function reqsToday() {
  const h = hour(), sc = state.scenario;
  const key = `${sc}|${Math.floor(h * 12)}`;
  if (reqCache.key === key) return reqCache.d;
  const extra = sc === 'normal' ? 0.62 : sc === 'heat' ? 0.8 : 0.95;
  const d = sys.reqs.filter((r, i) => r[3] <= h && (i % 100) / 100 < extra);
  reqCache = { key, d }; return d;
}
function topReq() {
  const sc = state.scenario;
  if (sc === 'storm') return 'Sewer backup'; if (sc === 'grid' && hour() > 14.2) return 'Traffic signal out';
  const counts = [0, 0, 0, 0]; reqsToday().forEach((r) => counts[r[2]]++);
  return REQ_CAT[counts.indexOf(Math.max(...counts))];
}

// ---------- building colors ----------
function bColor(b) {
  const h = hour(), off = offline(), dark = b.net >= 0 && off.has(b.net);
  const m = state.bmode;
  if (m === 'neutral' || m === 'power') {
    const day = daylight(h);
    if (m === 'power') {
      if (dark) return [208, 59, 59];
      const ld = (curV || vitals()).load; return ld > 0.9 ? [236, 131, 90] : [120, 128, 138];
    }
    const dayC = [178, 186, 198], nightC = [32, 38, 48];
    let c = mix(nightC, dayC, day);
    if (!dark && day < 0.8) { const glow = occOf(b, h) * (1 - day) * (b.k === 0 ? 0.55 : 0.4); c = mix(c, [255, 190, 110], glow); }
    if (dark) c = mix(c, [18, 20, 24], 0.35 + 0.45 * (1 - day));
    return c;
  }
  if (m === 'energy') return ramp('blue', (b.e - 50) / 170);
  if (m === 'height') return ramp('blue', Math.log(b.h / 5) / Math.log(300 / 5));
  if (m === 'use') return [C.blue, C.orange, C.aqua][b.k];
  if (m === 'rent') return b.k === 0 && b.rent ? ramp('blue', (b.rent - 2000) / 5500) : [58, 64, 74];
  if (m === 'solar') return ramp('orange', b.s / 90000);
  if (m === 'year') return ramp('blue', (b.y - 1830) / 195);
  if (m === 'occ') return ramp('blue', occOf(b, h));
  return [180, 186, 194];
}
const bTrigger = () => [state.bmode, state.scenario, state.surge, state.bmode === 'neutral' || state.bmode === 'occ' || state.bmode === 'power' ? Math.floor(state.t / 300) : 0];

// ---------- lighting ----------
let lightKey = '', lighting = null;
function lights() {
  const key = Math.floor(state.t / 300); if (key === lightKey && lighting) return lighting; lightKey = key;
  const h = hour(), day = daylight(h);
  const ts = Date.UTC(2026, 8, 15, 4, 0, 0) + state.t * 1000;
  const ambient = new D.AmbientLight({ color: [255, 255, 255], intensity: 0.55 + 0.5 * day });
  const sunL = new D._SunLight({ timestamp: ts, color: [255, 244, 228], intensity: 1.6 * day });
  lighting = new D.LightingEffect({ ambient, sunL });
  return lighting;
}

// ---------- layers ----------
const ON = (id) => state.on.has(id);
const TOP = { depthCompare: 'always', depthWriteEnabled: false };
const EMPTY = [];
const SUBS = sys.subs.map((s, i) => ({ ...s, i }));
let curV = null;
function layers() {
  const h = hour(), t = state.t, sc = state.scenario, off = offline(), sus = suspendedLines(), dem = demand(h) * SCEN[sc].traffic;
  curV = vitals();
  const day = daylight(h), L = [];
  const landC = mix([15, 18, 23], [24, 29, 36], day), parkC = mix([16, 30, 22], [27, 54, 37], day);
  L.push(new D.SolidPolygonLayer({ id: 'land', data: base.land, getPolygon: (d) => d, getFillColor: landC, updateTriggers: { getFillColor: [Math.round(day * 20)] } }));
  L.push(new D.SolidPolygonLayer({ id: 'parks', data: base.parks, getPolygon: (d) => d.polygon, getFillColor: parkC, pickable: true, updateTriggers: { getFillColor: [Math.round(day * 20)] } }));
  const img = fieldImage();
  if (img) L.push(new D.BitmapLayer({ id: 'field', image: img, bounds: [W, S, E, N], opacity: 1, pickable: true }));
  if (ON('fire')) L.push(new D.LineLayer({ id: 'fire', data: sys.fireResp, getSourcePosition: (d) => [d[0], d[1]], getTargetPosition: (d) => [d[2], d[3]],
    getColor: (d) => d[4] <= 240 ? [...ramp('orange', 1 - d[4] / 300), 230] : [90, 60, 55, 140], getWidth: 3, widthMinPixels: 2, pickable: true }));
  // streets
  const congest = ON('congestion');
  L.push(new D.PathLayer({ id: 'streets', data: streets, getPath: (d) => d.path,
    getColor: (d) => congest && d.c >= 1 && !d.b ? speedColor(d, h, dem, off) : d.b ? mix([70, 80, 94], [104, 116, 132], day) : mix([30, 35, 43], [[44, 50, 60], [56, 64, 76], [72, 82, 96], [92, 104, 120]][d.c], 0.4 + 0.6 * day),
    getWidth: (d) => congest && d.c >= 1 ? [6, 9, 12, 16][d.c] : [5, 7, 10, 14][d.c], widthUnits: 'meters', widthMinPixels: congest ? 1.5 : 0.6, capRounded: true,
    updateTriggers: { getColor: [congest, Math.floor(t / 300), sc, Math.round(day * 10)], getWidth: [congest] } }));
  if (ON('mains')) L.push(new D.PathLayer({ id: 'mains', data: sys.mains, getPath: (d) => streets[d[0]].path,
    getColor: (d) => d[1] < 50 ? C.warning : ramp('blue', (d[1] - 45) / 32), getWidth: 6, widthUnits: 'meters', widthMinPixels: 2, pickable: true, parameters: TOP }));
  if (ON('steam')) L.push(new D.PathLayer({ id: 'steam', data: sys.steam, getPath: (i) => streets[i].path, getColor: [224, 138, 79, 210], getWidth: 6, widthUnits: 'meters', widthMinPixels: 2, pickable: true, parameters: TOP }));
  if (ON('grid')) L.push(new D.PathLayer({ id: 'feeders', data: sys.feeders, getPath: (d) => d.p,
    getColor: (d) => off.has(d.s) ? [70, 74, 82, 200] : loadColor(Math.min(1.05, d.r * curV.load * 1.18)), getWidth: 3, widthUnits: 'pixels', jointRounded: true, pickable: true,
    updateTriggers: { getColor: [sc, Math.floor(t / 600), [...off].join()] }, parameters: TOP }));
  // buildings
  if (ON('buildings')) L.push(new D.SolidPolygonLayer({ id: 'buildings', data: buildings, getPolygon: (d) => d.poly, extruded: state.view3d,
    getElevation: (d) => d.h, getFillColor: bColor, pickable: true, autoHighlight: true, highlightColor: [240, 180, 41, 140],
    material: { ambient: 0.42, diffuse: 0.62, shininess: 24, specularColor: [50, 54, 60] }, updateTriggers: { getFillColor: bTrigger() } }));
  if (ON('construction')) {
    L.push(new D.ColumnLayer({ id: 'cranes', data: sys.construction, getPosition: (d) => d.pos, getElevation: (d) => buildings[d.b].h * 1.35 + 18,
      radius: 3.5, diskResolution: 4, extruded: true, getFillColor: [240, 180, 41], pickable: true }));
    L.push(new D.ScatterplotLayer({ id: 'construction', data: sys.construction, getPosition: (d) => d.pos, getRadius: 26, radiusUnits: 'meters', stroked: true, filled: true,
      getFillColor: [240, 180, 41, 50], getLineColor: [240, 180, 41, 230], lineWidthMinPixels: 1.5, pickable: true, parameters: TOP }));
  }
  // nature
  if (ON('trees')) L.push(new D.ScatterplotLayer({ id: 'trees', data: sys.trees, getPosition: (d) => [d[0], d[1]], getRadius: (d) => 1.2 + d[3] / 7, radiusUnits: 'meters', radiusMinPixels: 1,
    getFillColor: (d) => d[4] === 2 ? [201, 133, 0, 220] : d[4] === 1 ? [126, 160, 80, 220] : [76, 160, 92, 220], pickable: true }));
  if (ON('residents')) L.push(new D.ScatterplotLayer({ id: 'residents', data: sys.residents, getPosition: (d) => d, radiusUnits: 'pixels', getRadius: 1.6,
    getFillColor: (d) => sc === 'storm' && floodAt(d) > 0 ? [134, 182, 239, 255] : [200, 208, 218, 150], parameters: TOP, updateTriggers: { getFillColor: [sc, state.surge] } }));
  if (ON('jobs')) L.push(new D.HexagonLayer({ id: 'jobs', data: buildings, getPosition: (d) => d.c, getColorWeight: (d) => d.jobs, colorAggregation: 'SUM',
    getElevationWeight: (d) => d.jobs, elevationAggregation: 'SUM', radius: 140, coverage: 0.9, extruded: false, opacity: 0.55, upperPercentile: 99,
    colorRange: RAMP.blue.slice(1, 7), pickable: true, parameters: TOP }));
  // mobility
  if (ON('peds')) L.push(new D.HeatmapLayer({ id: 'pedheat', data: pedPoints, getPosition: (d) => d.p, getWeight: (d) => d.w * pedFactor(d, h),
    radiusPixels: 28, intensity: 1, threshold: 0.05, colorRange: RAMP.violet.slice(2).map((c, i) => [...c, 40 + i * 40]), updateTriggers: { getWeight: [Math.floor(t / 900), sc] } }));
  if (ON('commute')) {
    const am = h < 13;
    L.push(new D.ArcLayer({ id: 'commute', data: mob.commute, getSourcePosition: (d) => am ? d.s : d.t, getTargetPosition: (d) => am ? d.t : d.s,
      getSourceColor: (d) => [...[C.blue, C.orange, C.aqua][d.m], 30], getTargetColor: (d) => [...[C.blue, C.orange, C.aqua][d.m], 230],
      getWidth: (d) => 0.6 + d.v / 900 * (0.35 + 0.9 * dem), widthUnits: 'pixels', getHeight: 0.6, pickable: true, updateTriggers: { getSourcePosition: [am], getTargetPosition: [am], getWidth: [Math.floor(t / 900), sc] } }));
  }
  if (ON('bus')) {
    L.push(new D.PathLayer({ id: 'busroutes', data: mob.bus.routes, getPath: (d) => d.p, getColor: [...C.blue, 120], getWidth: 4, widthUnits: 'meters', widthMinPixels: 1.5, jointRounded: true, pickable: true }));
    L.push(new D.TripsLayer({ id: 'buses', data: subset('bus', buses, h >= 1 && h < 5.5 ? 0.45 : 1), getPath: (d) => d.path, getTimestamps: (d) => d.t,
      getColor: [134, 182, 239], widthMinPixels: 5, capRounded: true, jointRounded: true, trailLength: 40, currentTime: t % 3600, fadeTrail: true }));
  }
  if (ON('ferry')) {
    L.push(new D.PathLayer({ id: 'ferryroutes', data: mob.ferry.routes, getPath: (d) => d.p, getColor: [120, 160, 200, 110], getWidth: 2, widthUnits: 'pixels', jointRounded: true, pickable: true }));
    L.push(new D.TripsLayer({ id: 'boats', data: sc === 'storm' ? EMPTY : boats, getPath: (d) => d.path, getTimestamps: (d) => d.t, getColor: [210, 225, 240],
      widthMinPixels: 6, capRounded: true, trailLength: 140, currentTime: t % 3600, fadeTrail: true }));
  }
  if (ON('subway')) {
    L.push(new D.PathLayer({ id: 'sublines', data: mob.subway.lines, getPath: (d) => d.p, getColor: (d) => sus.has(d.n) ? [90, 94, 102, 200] : hex(d.c),
      getWidth: 7, widthUnits: 'meters', widthMinPixels: 2.5, jointRounded: true, capRounded: true, pickable: true, parameters: TOP, updateTriggers: { getColor: [[...sus].join()] } }));
    L.push(new D.TripsLayer({ id: 'trains', data: visibleTrains(), getPath: (d) => d.path, getTimestamps: (d) => d.t, getColor: (d) => mix(hex(d.c), [255, 255, 255], 0.35),
      widthMinPixels: 5, capRounded: true, trailLength: 75, currentTime: t % 3600, fadeTrail: true, parameters: TOP }));
    L.push(new D.ScatterplotLayer({ id: 'stations', data: mob.subway.stations, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: (d) => 2.5 + Math.sqrt(d.e / 1000) * 0.55,
      getFillColor: [238, 241, 244], getLineColor: [17, 21, 27], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP }));
    L.push(new D.TextLayer({ id: 'bullets', data: subBullets, getPosition: (d) => d.pos, getText: (d) => d.n, getSize: 11, sizeUnits: 'pixels', fontWeight: 600,
      fontFamily: '"Public Sans", system-ui, sans-serif', characterSet: 'auto', getColor: (d) => d.dark ? [17, 21, 27] : [255, 255, 255], background: true,
      getBackgroundColor: (d) => sus.has(d.n) ? [90, 94, 102] : hex(d.c), backgroundPadding: [5, 2, 5, 2], getPixelOffset: [0, -14], parameters: TOP,
      updateTriggers: { getBackgroundColor: [[...sus].join()] } }));
  }
  if (ON('traffic')) {
    const sub = subset('taxi', taxis, dem * 1.1);
    L.push(new D.TripsLayer({ id: 'taxiA', data: sub, getPath: (d) => d.path, getTimestamps: (d) => d.t, getColor: (d) => d.v ? [34, 176, 125] : [240, 172, 32],
      widthMinPixels: 2.2, capRounded: true, jointRounded: true, trailLength: 120, currentTime: t % LOOP, fadeTrail: true, opacity: 0.9 }));
    L.push(new D.TripsLayer({ id: 'taxiB', data: sub, getPath: (d) => d.path, getTimestamps: (d) => d.t, getColor: (d) => d.v ? [240, 172, 32] : [34, 176, 125],
      widthMinPixels: 2.2, capRounded: true, jointRounded: true, trailLength: 120, currentTime: (t + 1250) % LOOP, fadeTrail: true, opacity: 0.9 }));
  }
  if (ON('vans')) L.push(new D.TripsLayer({ id: 'vans', data: subset('vans', vans, sstep(5, 7, h) * (1 - sstep(19, 21, h)) + 0.1), getPath: (d) => d.path, getTimestamps: (d) => d.t,
    getColor: [217, 89, 38], widthMinPixels: 3, capRounded: true, trailLength: 70, currentTime: t % LOOP, fadeTrail: true }));
  if (ON('ambulance')) L.push(new D.TripsLayer({ id: 'ambulance', data: subset('amb', amb, sc === 'normal' ? 0.5 : 1), getPath: (d) => d.path, getTimestamps: (d) => d.t,
    getColor: [255, 92, 92], widthMinPixels: 4, capRounded: true, trailLength: 45, currentTime: t % LOOP, fadeTrail: true }));
  if (ON('waste')) {
    L.push(new D.ScatterplotLayer({ id: 'baskets', data: sys.baskets, getPosition: (d) => [d[0], d[1]], radiusUnits: 'pixels', getRadius: 2.2,
      getFillColor: (d) => basketFill(d, h) >= 0.9 ? C.serious : ramp('aqua', 0.2 + 0.8 * basketFill(d, h)), pickable: true, updateTriggers: { getFillColor: [Math.floor(t / 900)] } }));
    L.push(new D.TripsLayer({ id: 'trucks', data: subset('trucks', trucks, h >= 21 || h < 7 ? 1 : 0.15), getPath: (d) => d.path, getTimestamps: (d) => d.t,
      getColor: [116, 210, 173], widthMinPixels: 4, capRounded: true, trailLength: 60, currentTime: t % LOOP, fadeTrail: true }));
  }
  if (ON('peds')) L.push(new D.TripsLayer({ id: 'walkers', data: subset('walk', walkers, 0.15 + 0.85 * demand(h)), getPath: (d) => d.path, getTimestamps: (d) => d.t,
    getColor: [230, 228, 255], widthMinPixels: 2, capRounded: true, trailLength: 50, currentTime: t % LOOP, fadeTrail: true }));
  if (ON('wind')) L.push(new D.TripsLayer({ id: 'wind', data: wind, getPath: (d) => d.path, getTimestamps: (d) => d.ts, getColor: [220, 230, 242, 150],
    widthMinPixels: 1.4, trailLength: 4, currentTime: windClock % 20, fadeTrail: true, parameters: TOP }));
  // points of interest
  if (ON('citibike')) L.push(new D.ScatterplotLayer({ id: 'citibike', data: mob.citibike, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 4.5,
    getFillColor: (d) => { const f = bikeFill(d, h); return f < 0.06 ? [17, 21, 27] : ramp('aqua', 0.25 + 0.75 * f); },
    getLineColor: (d) => bikeFill(d, h) < 0.06 ? C.critical : [17, 21, 27], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP,
    updateTriggers: { getFillColor: [Math.floor(t / 900)], getLineColor: [Math.floor(t / 900)] } }));
  if (ON('parking')) {
    L.push(new D.ScatterplotLayer({ id: 'parking', data: mob.parking, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 8, getFillColor: [26, 32, 41],
      getLineColor: (d) => loadColor(parkOcc(d, h)), stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2, pickable: true, parameters: TOP, updateTriggers: { getLineColor: [Math.floor(t / 900)] } }));
    L.push(new D.TextLayer({ id: 'parkingP', data: mob.parking, getPosition: (d) => d.pos, getText: () => 'P', getSize: 10, fontWeight: 600, getColor: [238, 241, 244],
      fontFamily: '"Public Sans", system-ui, sans-serif', parameters: TOP }));
  }
  if (ON('crashes')) L.push(new D.ScatterplotLayer({ id: 'crashes', data: mob.crashes, getPosition: (d) => d.pos, radiusUnits: 'meters', getRadius: (d) => 10 + Math.sqrt(d.n) * 6,
    getFillColor: [208, 59, 59, 70], getLineColor: [208, 59, 59, 230], stroked: true, lineWidthMinPixels: 1.5, pickable: true, parameters: TOP }));
  if (ON('grid')) L.push(new D.ScatterplotLayer({ id: 'subs', data: SUBS, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 9,
    getFillColor: (d) => off.has(d.i) ? [40, 44, 52] : loadColor(Math.min(1.05, curV.load * 1.04)), getLineColor: (d) => off.has(d.i) ? C.critical : [17, 21, 27],
    stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2.5, pickable: true, parameters: TOP, updateTriggers: { getFillColor: [sc, Math.floor(t / 600), [...off].join()], getLineColor: [[...off].join()] } }));
  if (ON('steam')) L.push(new D.ScatterplotLayer({ id: 'vents', data: sys.vents, getPosition: (d) => d.pos, radiusUnits: 'meters', getRadius: (d, { index }) => 9 + 5 * Math.sin(windClock * 2 + index),
    getFillColor: [240, 236, 230, 70], getLineColor: [224, 138, 79, 220], stroked: true, lineWidthMinPixels: 1, pickable: true, parameters: TOP, updateTriggers: { getRadius: [Math.floor(windClock * 6)] } }));
  if (ON('ev')) L.push(new D.ScatterplotLayer({ id: 'ev', data: sys.ev, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 4,
    getFillColor: (d) => evState(d, h, off) === 2 ? [96, 102, 112] : evState(d, h, off) === 1 ? C.blue : C.aqua, getLineColor: [17, 21, 27], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1, pickable: true,
    parameters: TOP, updateTriggers: { getFillColor: [Math.floor(t / 900), [...off].join()] } }));
  if (ON('cells')) L.push(new D.ScatterplotLayer({ id: 'cells', data: sys.cells, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: (d) => d.k === 'macro' ? 5.5 : 3,
    getFillColor: (d) => siteDown(d, off) ? [40, 44, 52] : [220, 230, 242], getLineColor: (d) => siteDown(d, off) ? C.critical : [17, 21, 27], stroked: true,
    lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP, updateTriggers: { getFillColor: [[...off].join()], getLineColor: [[...off].join()] } }));
  if (ON('cso')) L.push(new D.ScatterplotLayer({ id: 'cso', data: sys.cso, getPosition: (d) => d.pos, radiusUnits: 'pixels',
    getRadius: sc === 'storm' ? 6 + 3 * Math.sin(windClock * 3) : 5, getFillColor: sc === 'storm' ? [208, 59, 59, 220] : [96, 102, 112, 200], getLineColor: [17, 21, 27], stroked: true,
    lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP, updateTriggers: { getFillColor: [sc] } }));
  if (ON('mains')) L.push(new D.ScatterplotLayer({ id: 'leaks', data: sys.leaks, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 6, getFillColor: C.critical,
    getLineColor: [255, 255, 255], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP }));
  if (ON('stores')) L.push(new D.ScatterplotLayer({ id: 'stores', data: sys.stores, getPosition: (d) => [d[0], d[1]], radiusUnits: 'pixels', getRadius: (d) => 1.6 + Math.sqrt(d[3]) / 18,
    getFillColor: (d) => [...[C.blue, C.orange, C.aqua][d[2]], storeOpen(d, h) ? 230 : 70], pickable: true, parameters: TOP, updateTriggers: { getFillColor: [Math.floor(t / 1800)] } }));
  if (ON('reqs')) L.push(new D.ScatterplotLayer({ id: 'reqs', data: reqsToday(), getPosition: (d) => [d[0], d[1]], radiusUnits: 'pixels', getRadius: 2.6,
    getFillColor: (d) => [...[C.blue, C.orange, C.aqua, [150, 158, 168]][d[2]], 220], pickable: true, parameters: TOP }));
  if (ON('schools')) L.push(new D.ScatterplotLayer({ id: 'schools', data: sys.schools, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 7, getFillColor: [26, 32, 41],
    getLineColor: (d) => d.enr / d.cap > 1.05 ? C.serious : [134, 182, 239], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2.5, pickable: true, parameters: TOP }));
  if (ON('proposals')) L.push(new D.ScatterplotLayer({ id: 'proposals', data: sys.proposals, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: (d) => 4 + Math.sqrt(d.votes) / 9,
    getFillColor: (d) => divColor(d.sup), getLineColor: [17, 21, 27], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP }));
  if (ON('cooling')) L.push(new D.ScatterplotLayer({ id: 'cooling', data: sys.cooling, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 8,
    getFillColor: coolingOpen(h) ? [...C.aqua, 230] : [40, 60, 54, 200], getLineColor: [212, 243, 230], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true,
    parameters: TOP, updateTriggers: { getFillColor: [sc, Math.floor(h)] } }));
  if (ON('sensors')) L.push(new D.ScatterplotLayer({ id: 'sensors', data: sys.sensors, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 3.2,
    getFillColor: (d) => [C.blue, C.orange, C.aqua, [150, 158, 168]][d.k], getLineColor: [238, 241, 244], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 0.8, pickable: true, parameters: TOP }));
  if (ON('hospitals') || ON('ambulance')) L.push(new D.TextLayer({ id: 'hospitals', data: sys.hospitals, getPosition: (d) => d.pos, getText: () => 'H', getSize: 13, fontWeight: 600,
    getColor: [255, 255, 255], background: true, getBackgroundColor: C.critical, backgroundPadding: [5, 3, 5, 3], fontFamily: '"Public Sans", system-ui, sans-serif', pickable: true, parameters: TOP }));
  if (ON('fire')) L.push(new D.ScatterplotLayer({ id: 'firehouses', data: sys.fire, getPosition: (d) => d.pos, radiusUnits: 'pixels', getRadius: 6, getFillColor: C.critical,
    getLineColor: [255, 255, 255], stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, pickable: true, parameters: TOP }));
  if (ON('labels')) L.push(new D.TextLayer({ id: 'labels', data: base.labels, getPosition: (d) => d.pos, getText: (d) => d.kind === 'hood' ? d.name.toUpperCase() : d.name,
    getSize: (d) => d.kind === 'hood' ? 10.5 : d.kind === 'water' ? 12 : 13, getColor: (d) => d.kind === 'water' ? [92, 132, 170, 220] : d.kind === 'boro' ? [170, 179, 190, 220] : [150, 160, 172, 210],
    fontFamily: '"Public Sans", system-ui, sans-serif', fontWeight: 500, characterSet: 'auto', fontSettings: { sdf: true }, outlineWidth: 3, outlineColor: [11, 15, 20, 230], parameters: TOP }));
  return L;
}

// layer helpers
function speedColor(d, h, dem, off) {
  const busy = (d.c / 3) * 0.6 + d.r * 0.5; let v = dem * busy * 1.25 + (state.scenario === 'storm' ? 0.35 : 0) + (off.size && outageNear(d.mid, off) ? 0.6 : 0);
  return v > 0.85 ? C.critical : v > 0.62 ? C.serious : v > 0.4 ? C.warning : C.good;
}
function outageNear(p, off) {
  let best = -1, bd = 1e9; sys.subs.forEach((s, i) => { const d = (s.pos[0] - p[0]) ** 2 + (s.pos[1] - p[1]) ** 2; if (d < bd) { bd = d; best = i; } });
  return off.has(best);
}
function loadColor(x) { return x >= 0.97 ? C.critical : x >= 0.9 ? C.serious : x >= 0.8 ? C.warning : C.good; }
function divColor(s) { const t = (s - 0.5) * 2; const mid = [96, 100, 108];
  return t >= 0 ? mix(mid, C.blue, clamp(t * 1.6, 0, 1)) : mix(mid, C.red, clamp(-t * 1.6, 0, 1)); }
function floodAt(p) { if (state.scenario !== 'storm') return 0; const i = fIdx(p[0], p[1]); return i < 0 ? 0 : state.surge - field.elev[i] * 3.281; }
function bikeFill(d, h) { const am = g(h, 8.6, 1.3), pm = g(h, 18, 1.6); const dir = d.z ? 1 : -1;
  return clamp(d.b + dir * 0.5 * am - dir * 0.45 * pm, 0, 1); }
function parkOcc(d, h) { return clamp(0.25 + (d.z ? 0.7 * officeOcc(h) : 0.35 + 0.4 * resOcc(h) - 0.2 * officeOcc(h)), 0, 1); }
function basketFill(d, h) { return clamp(d[2] * 0.6 + 0.5 * sstep(9, 21, h) - (h < 7 ? 0.3 : 0), 0, 1); }
function storeOpen(d, h) { return d[2] === 0 ? h >= 7 && h < 23.5 : h >= 9.5 && h < 21; }
function evState(d, h, off) { if (d.off || outageNear(d.pos, off)) return 2; const f = (d.pos[0] * 1e5 % 7) / 7; return f < 0.35 + 0.4 * g(h, 21, 3) + 0.2 * officeOcc(h) ? 1 : 0; }
function coolingOpen(h) { return (state.scenario === 'heat' || state.scenario === 'grid') && h >= 9 && h < 21; }
function pedFactor(d, h) { const base = d.k === 'st' ? 0.4 + 0.9 * demand(h) : d.k === 'store' ? (h >= 9 && h < 22 ? 0.5 + 0.6 * g(h, 13.5, 3) + 0.4 * g(h, 19, 2) : 0.08) : 0.2 + 0.5 * daylight(h);
  return base * (state.scenario === 'storm' ? 0.25 : state.scenario === 'heat' ? 0.7 : 1); }
const pedPoints = [
  ...mob.subway.stations.map((s) => ({ p: s.pos, w: s.e / 4000, k: 'st' })),
  ...sys.stores.map((s) => ({ p: [s[0], s[1]], w: s[3] / 900, k: 'store' })),
  ...base.parks.map((pk) => ({ p: pk.polygon[0], w: 3, k: 'park' }))
];
const subBullets = mob.subway.lines.map((l) => { const p = l.p[Math.min(l.p.length - 1, Math.floor(l.p.length / 2))];
  return { n: l.n, c: l.c, pos: p, dark: l.c === '#FCCC0A' || l.c === '#A7A9AC' }; });

// ---------- tooltips ----------
const row = (k, v) => `<div class="tt-r"><span>${k}</span><b>${v}</b></div>`;
function tip({ object, layer, coordinate }) {
  if (!layer) return null;
  const h = hour(), id = layer.id, o = object, off = offline();
  let html = null;
  if (id === 'field' && coordinate) {
    const i = fIdx(coordinate[0], coordinate[1]); if (i < 0 || state.field === 'none') return null;
    const v = fieldValue(state.field, i, h), m = FIELD_META[state.field];
    if (state.field === 'flood' && v <= 0) html = `<div class="tt-t">${m.name}</div>${row('Here', 'dry')}`;
    else html = `<div class="tt-t">${m.name}</div>${row('Here', `${state.field === 'well' || state.field === 'cell' || state.field === 'noise' ? Math.round(v) : v.toFixed(1)} ${m.unit}`)}`;
  } else if (!o) return null;
  else if (id === 'buildings') {
    const occ = Math.round(occOf(o, h) * 100), dark = o.net >= 0 && off.has(o.net);
    html = `<div class="tt-t">${KIND[o.k]} · ${o.f} floors</div>${row('Neighborhood', ZNAME[o.z] || '')}${row('Height', `${Math.round(o.h)} m`)}${row('Built', o.y)}
      ${row('Energy use', `${Math.round(o.e)} kBtu/ft²·yr`)}${o.k === 0 && o.rent ? row('Median 1BR rent', `$${fmt(o.rent)}/mo`) : ''}${row('Rooftop solar', `${fmt(o.s / 1000)} MWh/yr`)}
      ${row('People inside now', `${occ}% of usual`)}${o.net >= 0 ? row('Power', dark ? '<span style="color:var(--critical)">Outage</span>' : `Substation ${o.net + 1}`) : ''}
      <div class="tt-m">${o.real ? 'Real footprint and height from sample data' : 'Simulated footprint'}; all readings simulated</div>`;
  } else if (id === 'parks') html = `<div class="tt-t">${esc(o.name)}</div>${row('Shade cools by', `${state.scenario === 'heat' ? 9 : 6}°F`)}${row('Visitors now', fmt(400 * (0.15 + daylight(h)) * (state.scenario === 'storm' ? 0.1 : 1)))}`;
  else if (id === 'sublines' || id === 'bullets') html = `<div class="tt-t">${esc(o.n)} line</div>${row('Service', suspendedLines().has(o.n) ? '<span style="color:var(--critical)">Suspended</span>' : headway())}`;
  else if (id === 'stations') html = `<div class="tt-t">${esc(o.n)}</div>${row('Lines', esc(o.l.join(' · ')))}${row('Weekday entries', fmt(o.e))}${row('Entering now', `${fmt(o.e / 1000 * 60 * demand(h) * 0.9)}/hr`)}`;
  else if (id === 'busroutes') html = `<div class="tt-t">${esc(o.n)} bus</div>${row('Buses in service', fmt(buses.filter((b) => b.l === o.n).length / 2))}${row('Avg speed', `${(7.8 - 2.2 * demand(h)).toFixed(1)} mph`)}`;
  else if (id === 'ferryroutes') html = `<div class="tt-t">${esc(o.n)}</div>${row('Status', state.scenario === 'storm' ? '<span style="color:var(--critical)">Suspended</span>' : 'Running')}`;
  else if (id === 'citibike') { const f = bikeFill(o, h); const bikes = Math.round(f * o.d);
    html = `<div class="tt-t">Bike share dock ${esc(o.id)}</div>${row('Bikes available', `${bikes} of ${o.d}`)}${row('E-bikes', Math.round(bikes * 0.35))}${f < 0.06 ? '<div class="tt-m" style="color:var(--critical)">Empty — rebalancing truck dispatched</div>' : ''}`; }
  else if (id === 'parking' ) html = `<div class="tt-t">Parking garage</div>${row('Spaces', fmt(o.cap))}${row('Occupied', `${Math.round(parkOcc(o, h) * 100)}%`)}${row('First hour', `$${o.rate}`)}`;
  else if (id === 'crashes') html = `<div class="tt-t">Crash hotspot</div>${row('Crashes, last 12 months', o.n)}${row('People injured', o.inj)}${row('Pedestrians struck', o.ped)}`;
  else if (id === 'commute') html = `<div class="tt-t">${esc(o.o)} → ${esc(o.d)}</div>${row('Weekday commuters', fmt(o.v))}${row('Main mode', ['Transit', 'Car', 'Ferry, PATH or bike'][o.m])}`;
  else if (id === 'subs') html = `<div class="tt-t">${esc(o.n)}</div>${row('Capacity', `${o.cap} MW`)}${row('Load now', off.has(o.i) ? '<span style="color:var(--critical)">Offline</span>' : `${Math.round(o.cap * Math.min(1.04, vitals().load))} MW`)}`;
  else if (id === 'feeders') html = `<div class="tt-t">Feeder from substation ${o.s + 1}</div>${row('Loading', off.has(o.s) ? 'De-energized' : `${Math.round(Math.min(1.05, o.r * vitals().load * 1.18) * 100)}%`)}`;
  else if (id === 'steam') html = `<div class="tt-t">Steam main</div>${row('Pressure', '150 psi')}${row('Serves', 'Heating, cooling, hot water')}`;
  else if (id === 'vents') html = `<div class="tt-t">Steam vent stack</div>${row('Line pressure', `${o.psi} psi`)}`;
  else if (id === 'mains') html = `<div class="tt-t">Water main</div>${row('Pressure', `${o[1]} psi`)}${o[1] < 50 ? '<div class="tt-m" style="color:var(--warning)">Low pressure for upper floors</div>' : ''}`;
  else if (id === 'leaks') html = `<div class="tt-t">Water main break</div>${row('Estimated loss', `${o.gpm} gal/min`)}${row('Crew', 'On site')}`;
  else if (id === 'cso') html = `<div class="tt-t">Sewer overflow outfall ${esc(o.id)}</div>${row('Status', state.scenario === 'storm' ? '<span style="color:var(--critical)">Overflowing</span>' : 'Dry weather')}${state.scenario === 'storm' ? row('Overflow so far', `${o.mg} M gal`) : ''}`;
  else if (id === 'construction' || id === 'cranes') html = `<div class="tt-t">${esc(o.k)}</div>${row('Floors', o.f)}${row('Progress', `${o.pct}%`)}${row('Completion', o.q)}${row('Work hours', '7 AM–6 PM')}`;
  else if (id === 'trees') html = `<div class="tt-t">${esc(sys.species[o[2]])}</div>${row('Trunk diameter', `${o[3]} in`)}${row('Health', ['Good', 'Fair', 'Poor'][o[4]])}${row('Shade cooling', `${(o[3] / 6).toFixed(1)}°F`)}`;
  else if (id === 'ev') { const st = evState(o, h, off); html = `<div class="tt-t">EV charger · ${o.kw} kW</div>${row('Ports', o.ports)}${row('Status', ['Available', 'Charging', 'Offline'][st])}`; }
  else if (id === 'cells') html = `<div class="tt-t">${o.k === 'macro' ? 'Rooftop cell site' : 'Small cell'}</div>${row('Battery backup', o.bk ? 'Yes' : 'No')}${row('Status', siteDown(o, off) ? '<span style="color:var(--critical)">Down</span>' : 'On air')}`;
  else if (id === 'baskets') html = `<div class="tt-t">Litter basket</div>${row('Fill level', `${Math.round(basketFill(o, h) * 100)}%`)}`;
  else if (id === 'schools') html = `<div class="tt-t">${esc(o.n)} · ${esc(o.lvl)}</div>${row('Enrollment', fmt(o.enr))}${row('Capacity', fmt(o.cap))}${row('Utilization', `${Math.round(o.enr / o.cap * 100)}%`)}`;
  else if (id === 'stores') html = `<div class="tt-t">${['Food and drink', 'Retail', 'Services'][o[2]]}</div>${row('Visits per day', fmt(o[3]))}${row('Open now', storeOpen(o, h) ? 'Yes' : 'No')}`;
  else if (id === 'reqs') { const sub = state.scenario === 'storm' && o[2] === 3 ? 'Sewer backup' : state.scenario === 'grid' && o[2] === 3 ? 'Traffic signal out' : REQ_SUB[o[2]][o[4]];
    html = `<div class="tt-t">311 · ${esc(sub)}</div>${row('Category', REQ_CAT[o[2]])}${row('Received', clockText(o[3] * 3600))}`; }
  else if (id === 'proposals') html = `<div class="tt-t">${esc(o.k)}</div>${row('Support', `${Math.round(o.sup * 100)}%`)}${row('Neighbors voting', fmt(o.votes))}`;
  else if (id === 'cooling') html = `<div class="tt-t">Cooling center</div>${row('Capacity', `${o.cap} people`)}${row('Status', coolingOpen(h) ? 'Open until 9 PM' : 'Opens during heat emergencies')}`;
  else if (id === 'sensors') { const i = fIdx(o.pos[0], o.pos[1]); const names = ['Traffic camera', 'Air monitor', 'Flood sensor', 'Noise monitor'];
    const reading = o.k === 0 ? `${Math.round(10 + 40 * demand(h))} vehicles/min` : o.k === 1 ? `${fieldValue('air', i, h).toFixed(1)} µg/m³` : o.k === 2 ? (floodAt(o.pos) > 0 ? `${floodAt(o.pos).toFixed(1)} ft water` : 'Dry') : `${Math.round(fieldValue('noise', i, h))} dB(A)`;
    html = `<div class="tt-t">${names[o.k]}</div>${row('Latest reading', reading)}`; }
  else if (id === 'hospitals') { const er = Math.round(o.er * (0.6 + 0.6 * g(h, 19, 4)) * ({ normal: 1, heat: 1.6, storm: 1.4, grid: 1.5 }[state.scenario]));
    html = `<div class="tt-t">${esc(o.n)}</div>${row('Beds', o.beds)}${row('ER wait', `${er} min`)}${row('Ambulances inbound', Math.round(1 + 4 * demand(h)))}`; }
  else if (id === 'firehouses') html = `<div class="tt-t">${esc(o.n)}</div>${row('Engine', 'In quarters')}${row('Avg response', '4 min 10 s')}`;
  else if (id === 'fire') html = `<div class="tt-t">Fire response time</div>${row('From nearest firehouse', `${Math.floor(o[4] / 60)} min ${o[4] % 60} s`)}`;
  else if (id === 'jobs') html = `<div class="tt-t">Jobs in this hexagon</div>${row('Workers', fmt(o.colorValue || 0))}`;
  else return null;
  return { html, style: { background: 'rgba(17,21,27,.97)', border: '1px solid #262d37', borderRadius: '10px', padding: '9px 11px', color: '#eef1f4', maxWidth: '280px' } };
}
function clockText(sec) { const m = Math.floor(sec / 60) % 1440; const h = Math.floor(m / 60), mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`; }

// ---------- panel ----------
const GROUPS = [
  ['Climate and environment', [['wind', 'Wind flow', '#c9d3dd', sys.wind.length], ['trees', 'Street trees', '#4ca05c', sys.trees.length]]],
  ['Water', [['mains', 'Water mains and breaks', '#5598e7', sys.mains.length], ['cso', 'Sewer overflow outfalls', '#7c8692', sys.cso.length]]],
  ['Buildings and land', [['buildings', 'Buildings in 3D', '#c4cbd3', buildings.length], ['construction', 'Construction sites', '#f0b429', sys.construction.length]]],
  ['Getting around', [['traffic', 'Traffic: yellow cabs and app rides', '#c98500', taxis.length], ['congestion', 'Road congestion', '#ec835a'],
    ['subway', 'Subway lines and trains', '#EE352E', mob.subway.stations.length], ['bus', 'Buses', '#3987e5', mob.bus.routes.length], ['ferry', 'Ferries', '#9fc3e8', mob.ferry.routes.length],
    ['citibike', 'Bike share docks', '#199e70', mob.citibike.length], ['peds', 'Pedestrians', '#9085e9', walkers.length], ['vans', 'Freight and deliveries', '#d95926', vans.length],
    ['parking', 'Parking garages', '#aab3be', mob.parking.length], ['crashes', 'Crash hotspots', '#d03b3b', mob.crashes.length], ['commute', 'Commuter flows across the region', '#86b6ef', mob.commute.length]]],
  ['Energy, telecom and waste', [['grid', 'Power grid', '#fab219', sys.subs.length], ['steam', 'Steam system', '#e08a4f', sys.vents.length], ['ev', 'EV chargers', '#199e70', sys.ev.length],
    ['cells', 'Cell sites', '#dce6f2', sys.cells.length], ['waste', 'Litter baskets and trucks', '#74d2ad', sys.baskets.length]]],
  ['People', [['residents', 'Residents', '#c8d0da', sys.residents.length], ['schools', 'Schools', '#86b6ef', sys.schools.length]]],
  ['Economy', [['jobs', 'Jobs density', '#2a78d6'], ['stores', 'Storefronts', '#d95926', sys.stores.length]]],
  ['Health and safety', [['hospitals', 'Hospitals', '#d03b3b', sys.hospitals.length], ['fire', 'Fire response in 4 minutes', '#eb7a4e', sys.fire.length],
    ['ambulance', 'Ambulances', '#ff5c5c', amb.length], ['reqs', '311 requests today', '#3987e5']]],
  ['Civic life', [['proposals', 'Neighborhood proposals', '#5598e7', sys.proposals.length], ['cooling', 'Cooling centers', '#199e70', sys.cooling.length]]],
  ['Sensors and map', [['sensors', 'Sensor network', '#dce6f2', sys.sensors.length], ['labels', 'Place names', '#96a0ac']]]
];
$('groups').innerHTML = GROUPS.map(([name, items]) => `<div class="group"><h2>${name}</h2>${items.map(([id, label, sw, n]) =>
  `<label class="layer" for="ly-${id}"><input type="checkbox" id="ly-${id}" data-id="${id}" ${state.on.has(id) ? 'checked' : ''}><span class="sw" style="background:${sw}"></span><span class="n">${label}</span><span class="c">${n ? fmt(n) : ''}</span></label>`).join('')}</div>`).join('');
$('groups').addEventListener('change', (e) => { const id = e.target.dataset.id; if (!id) return; e.target.checked ? state.on.add(id) : state.on.delete(id); renderLegend(); });

$('scen').innerHTML = Object.entries(SCEN).map(([k, s]) => `<button type="button" data-k="${k}" aria-pressed="${k === state.scenario}">${s.name}<span class="s">${s.s}</span></button>`).join('');
$('scen').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setScenario(b.dataset.k); });
function setScenario(k) {
  state.scenario = k; [...$('scen').children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  $('scenNote').textContent = SCEN[k].note; $('surgeBox').style.display = k === 'storm' ? 'block' : 'none';
  if (k === 'storm') { setField('flood'); if (!state.on.has('residents')) toggleLayer('residents', true); }
  if (k === 'heat') { setField('heat'); toggleLayer('cooling', true); }
  if (k === 'grid') { setBmode('neutral'); toggleLayer('grid', true); if (hour() < 14.2) setTime(17.5 * 3600); }
  renderKpis(true); renderLegend();
}
function toggleLayer(id, on) { on ? state.on.add(id) : state.on.delete(id); const el = $('ly-' + id); if (el) el.checked = on; }
$('surge').addEventListener('input', (e) => { state.surge = +e.target.value; $('surgeVal').textContent = `${state.surge} ft`; renderKpis(true); });
$('fields').innerHTML = [['none', 'None'], ['heat', 'Surface heat'], ['air', 'Air quality'], ['noise', 'Noise'], ['flood', 'Flood depth'], ['cell', 'Cell signal'], ['well', 'Well-being']]
  .map(([k, n]) => `<button type="button" data-k="${k}" aria-pressed="${k === state.field}">${n}</button>`).join('');
$('fields').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setField(b.dataset.k); });
function setField(k) { state.field = k; [...$('fields').children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); renderLegend(); }
const BMODES = [['neutral', 'Time of day (lights at night)'], ['energy', 'Energy use intensity'], ['use', 'Land use'], ['height', 'Height'], ['rent', 'Median rent'],
  ['solar', 'Rooftop solar potential'], ['year', 'Year built'], ['occ', 'People inside now'], ['power', 'Power status']];
$('bmode').innerHTML = BMODES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('bmode').addEventListener('change', (e) => setBmode(e.target.value));
function setBmode(k) { state.bmode = k; $('bmode').value = k; renderLegend(); }
$('play').addEventListener('click', () => { state.playing = !state.playing; $('play').textContent = state.playing ? 'Pause' : 'Play'; });
$('speed').addEventListener('change', (e) => { state.speed = +e.target.value; });
$('tod').addEventListener('input', (e) => setTime(+e.target.value * 60));
function setTime(sec) { state.t = sec; subsetCache = {}; renderKpis(true); }
$('togglePanel').addEventListener('click', () => { const p = $('panel'); const c = p.classList.toggle('collapsed'); $('togglePanel').textContent = c ? 'Show controls' : 'Hide controls'; $('togglePanel').setAttribute('aria-expanded', String(!c)); });
if (!state.playing) $('play').textContent = 'Play';

// ---------- legend ----------
function rampBlock(title, rampName, lo, hi) { return `<div><h3>${title}</h3><div class="ramp" style="background:${rampCss(rampName)}"></div><div class="rampl"><span>${lo}</span><span>${hi}</span></div></div>`; }
function keys(title, items) { return `<div><h3>${title}</h3><div class="keys">${items.map(([c, n]) => `<span class="key"><span class="sw" style="background:${c}"></span>${n}</span>`).join('')}</div></div>`; }
function renderLegend() {
  const h = hour(), out = [];
  if (state.field !== 'none') { const m = FIELD_META[state.field], [lo, hi] = fieldRange(state.field, h);
    out.push(state.field === 'flood' && state.scenario !== 'storm' ? `<div><h3>${m.name}</h3><div class="rampl" style="margin:0">No flooding today. Pick Coastal storm to raise the tide.</div></div>`
      : rampBlock(m.name, m.ramp, `${lo} ${m.unit}`, `${hi}${state.field === 'flood' ? '+' : ''} ${m.unit}`)); }
  const bm = state.bmode;
  if (ON('buildings')) {
    if (bm === 'energy') out.push(rampBlock('Building energy use', 'blue', '50 kBtu/ft²', '220+'));
    else if (bm === 'height') out.push(rampBlock('Building height', 'blue', '5 m', '300+ m'));
    else if (bm === 'rent') out.push(rampBlock('Median 1BR rent', 'blue', '$2,000', '$7,500') + keys('', [['#3a404a', 'Not residential']]));
    else if (bm === 'solar') out.push(rampBlock('Rooftop solar potential', 'orange', '0', '90+ MWh/yr'));
    else if (bm === 'year') out.push(rampBlock('Year built', 'blue', '1830', '2025'));
    else if (bm === 'occ') out.push(rampBlock('People inside now', 'blue', '0%', '100% of usual'));
    else if (bm === 'use') out.push(keys('Land use', [['#3987e5', 'Residential'], ['#d95926', 'Office and retail'], ['#199e70', 'Civic and utility']]));
    else if (bm === 'power') out.push(keys('Power status', [['#78808a', 'Supplied'], ['#ec835a', 'Grid strained'], ['#d03b3b', 'Outage']]));
    else out.push(keys('Buildings', [['#cdd3db', 'Daylight'], ['#ffbe6e', 'Lit windows at night'], ['#1c1f25', 'Dark in an outage']]));
  }
  if (ON('subway')) out.push(`<div><h3>Subway</h3><div class="keys">${mob.subway.lines.map((l) => `<span class="key"><span class="bullet" style="background:${l.c};color:${l.c === '#FCCC0A' || l.c === '#A7A9AC' ? '#11151b' : '#fff'}">${esc(l.n)}</span></span>`).join('')}</div></div>`);
  if (ON('traffic')) out.push(keys('Traffic', [['#f0ac20', 'Yellow cab'], ['#22b07d', 'App ride']]));
  if (ON('congestion') || ON('grid') || ON('parking')) out.push(keys(ON('congestion') ? 'Road speed' : 'Load', [['#0ca30c', ON('congestion') ? 'Free flow' : 'Under 80%'], ['#fab219', ON('congestion') ? 'Slow' : '80–90%'], ['#ec835a', ON('congestion') ? 'Heavy' : '90–97%'], ['#d03b3b', ON('congestion') ? 'Stopped' : 'Over 97%']]));
  if (ON('reqs')) out.push(keys('311 requests', REQ_CAT.map((n, i) => [['#3987e5', '#d95926', '#199e70', '#969ea8'][i], n])));
  if (ON('stores')) out.push(keys('Storefronts', [['#3987e5', 'Food and drink'], ['#d95926', 'Retail'], ['#199e70', 'Services']]));
  if (ON('commute')) out.push(keys(h < 13 ? 'Morning commute, into downtown' : 'Evening commute, heading home', [['#3987e5', 'Transit'], ['#d95926', 'Car'], ['#199e70', 'Ferry, PATH or bike']]));
  if (ON('ev')) out.push(keys('EV chargers', [['#199e70', 'Available'], ['#3987e5', 'Charging'], ['#606670', 'Offline']]));
  if (ON('sensors')) out.push(keys('Sensors', [['#3987e5', 'Traffic camera'], ['#d95926', 'Air monitor'], ['#199e70', 'Flood sensor'], ['#969ea8', 'Noise monitor']]));
  if (ON('proposals')) out.push(`<div><h3>Proposal support</h3><div class="ramp" style="background:linear-gradient(90deg,#e66767,#60646c,#3987e5)"></div><div class="rampl"><span>Mostly against</span><span>Mostly for</span></div></div>`);
  if (ON('citibike')) out.push(rampBlock('Bikes available', 'aqua', 'Empty', 'Full'));
  if (ON('fire')) out.push(rampBlock('Fire response time', 'orange', '4 min', '1 min'));
  if (ON('jobs')) out.push(rampBlock('Jobs per hexagon', 'blue', 'Fewer', 'More'));
  $('legend').innerHTML = out.join('') || '<div class="rampl" style="margin:0">Turn on a layer to see its key.</div>';
}

// ---------- deck ----------
const isNarrow = innerWidth < 760;
const HOME = { longitude: -73.9985, latitude: isNarrow ? 40.7125 : 40.7165, zoom: isNarrow ? 12.9 : 13.85, pitch: 52, bearing: -18 };
const BOUNDS = { minLng: -74.12, maxLng: -73.86, minLat: 40.63, maxLat: 40.80 };
const deckgl = new D.Deck({
  parent: $('map'), views: new D.MapView({ repeat: false }), initialViewState: HOME, controller: { dragRotate: true, inertia: true },
  layers: [], getTooltip: tip,
  onViewStateChange: ({ viewState }) => ({ ...viewState, longitude: clamp(viewState.longitude, BOUNDS.minLng, BOUNDS.maxLng), latitude: clamp(viewState.latitude, BOUNDS.minLat, BOUNDS.maxLat),
    zoom: clamp(viewState.zoom, 10.5, 18), pitch: clamp(viewState.pitch, 0, 70) })
});
$('resetView').addEventListener('click', () => deckgl.setProps({ initialViewState: { ...HOME, pitch: state.view3d ? 52 : 0, transitionDuration: 900, transitionInterpolator: new D.FlyToInterpolator() } }));
$('view3d').addEventListener('click', () => { state.view3d = !state.view3d; $('view3d').setAttribute('aria-pressed', String(state.view3d));
  const vp = deckgl.getViewports()[0]; deckgl.setProps({ initialViewState: { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, bearing: state.view3d ? -18 : 0, pitch: state.view3d ? 52 : 0, transitionDuration: 700 } }); });

// ---------- loop ----------
let windClock = 0, last = performance.now(), lastClock = '', lastLegendHour = -1;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) { state.t = (state.t + dt * state.speed) % 86400; }
  windClock += dt * (state.scenario === 'storm' ? 2.6 : 1);
  const m = Math.floor(state.t / 60); const txt = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  if (txt !== lastClock) { lastClock = txt; $('clock').textContent = txt; $('tod').value = m; $('tod').setAttribute('aria-valuetext', clockText(m * 60)); }
  const hh = Math.floor(hour()); if (hh !== lastLegendHour) { lastLegendHour = hh; renderLegend(); }
  renderKpis(false);
  deckgl.setProps({ layers: layers(), effects: [lights()] });
  requestAnimationFrame(frame);
}
$('sunTxt').textContent = `daylight ${clockText(SUNRISE * 3600)} to ${clockText(SUNSET * 3600)}`;
$('dataVersion').textContent = `Data ${meta.version}, seeds ${meta.seeds.buildings} and ${meta.seeds.systems}.`;
setScenario('normal');
$('loading').classList.add('done');
requestAnimationFrame(frame);
})();
