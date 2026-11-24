import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXPERIENCES } from '../world/universe/registry.js';
import { experienceFromLocation, isRegisteredHTMLFile } from '../world/universe/html-navigation.js';

const DATA = 'data/city-systems-map';
const read = name => JSON.parse(readFileSync(join(DATA, name + '.json'), 'utf8'));
const page = readFileSync('tools/city-systems-map.html', 'utf8');
const script = readFileSync('tools/city-systems-map.js', 'utf8');
const pageFiles = JSON.parse(script.match(/const FILES = (\[[\s\S]*?\]);/)[1].replaceAll("'", '"'));
const meta = read('meta')[0];
const [W, S, E, N] = meta.bbox;
const nearMap = ([lng, lat]) => lng > W - 0.01 && lng < E + 0.01 && lat > S - 0.01 && lat < N + 0.01;
const inRegion = ([lng, lat]) => lng > -74.3 && lng < -73.7 && lat > 40.5 && lat < 40.95;
const pairs = flat => flat.reduce((out, value, i) => (i % 2 ? out[out.length - 1].push(value) : out.push([value]), out), []);

test('the page loads exactly the versioned data files that the generator writes', () => {
  const onDisk = readdirSync(DATA).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
  expect([...pageFiles].sort()).toEqual(onDisk);
  for (const name of onDisk) {
    const records = read(name);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
  }
  expect(script).toContain("const DATA = '/data/city-systems-map/';");
});

test('meta records the data version, seeds and checksummed public sources', () => {
  expect(meta.version).toBe('city-systems-map.1');
  expect(meta.seeds).toEqual({ buildings: 7, systems: 42 });
  expect(meta.sources.map(source => source.file)).toEqual(['buildings.json', 'trips-v7.json', 'manhattan.json']);
  for (const source of meta.sources) {
    expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(source.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/visgl\/deck\.gl-data\/[0-9a-f]{40}\//);
  }
  expect(meta.observed.length && meta.derived.length && meta.synthetic.length).toBeTruthy();
  const config = readFileSync('scripts/city-systems-map/config.py', 'utf8');
  expect(config).toContain(`VERSION = '${meta.version}'`);
  expect(config).toContain(`SEED_BUILDINGS = ${meta.seeds.buildings}`);
  expect(config).toContain(`SEED_SYSTEMS = ${meta.seeds.systems}`);
  for (const source of meta.sources) expect(config).toContain(source.sha256);
});

test('buildings keep the 999 real footprints apart from synthetic ones', () => {
  const buildings = read('buildings'), substations = read('substations');
  expect(buildings.filter(row => row[11] === 1)).toHaveLength(999);
  for (const [polygon, height, kind, year, eui, floors, area, rent, solar, zone, network, real] of buildings) {
    expect(polygon.length % 2).toBe(0);
    expect(polygon.length).toBeGreaterThanOrEqual(6);
    expect(pairs(polygon).every(nearMap)).toBe(true);
    expect(height).toBeGreaterThan(0);
    expect([0, 1, 2]).toContain(kind);
    expect(year).toBeGreaterThanOrEqual(1830);
    expect(eui).toBeGreaterThan(0);
    expect(floors).toBeGreaterThanOrEqual(1);
    expect(area).toBeGreaterThan(0);
    expect(rent).toBeGreaterThanOrEqual(0);
    expect(solar).toBeGreaterThanOrEqual(0);
    expect(typeof zone).toBe('string');
    expect(network).toBeGreaterThanOrEqual(-1);
    expect(network).toBeLessThan(substations.length);
    expect([0, 1]).toContain(real);
  }
});

test('every moving vehicle has one timestamp per point, in time order, inside the region', () => {
  for (const name of ['taxis', 'vans', 'ambulances', 'trucks', 'walkers', 'subway-trains', 'buses', 'ferries', 'wind']) {
    for (const trip of read(name)) {
      expect(trip.p.length).toBe(2 * trip.t.length);
      expect(trip.t.length).toBeGreaterThanOrEqual(2);
      expect(trip.t.every((time, i) => i === 0 || time >= trip.t[i - 1])).toBe(true);
      expect(pairs(trip.p).every(inRegion)).toBe(true);
    }
  }
});

test('point layers sit on the map and street references resolve', () => {
  for (const name of ['bike-docks', 'cell-sites', 'construction', 'cooling-centers', 'crashes', 'ev-chargers',
    'firehouses', 'hospitals', 'main-breaks', 'parking', 'proposals', 'schools', 'sensors', 'sewer-outfalls',
    'steam-vents', 'substations', 'subway-stations']) {
    expect(read(name).every(row => nearMap(row.pos))).toBe(true);
  }
  for (const name of ['trees', 'storefronts', 'litter-baskets', 'requests-311', 'residents']) {
    expect(read(name).every(row => nearMap(row))).toBe(true);
  }
  const streets = read('streets');
  expect(read('steam-mains').every(index => Number.isInteger(index) && streets[index])).toBe(true);
  expect(read('water-mains').every(([index, psi]) => streets[index] && psi > 0)).toBe(true);
  expect(read('commute').every(row => inRegion(row.s) && inRegion(row.t) && row.v > 0)).toBe(true);
});

test('ground fields decode to one byte per grid cell', () => {
  const fields = read('fields');
  expect(fields.map(field => field.name)).toEqual(['land', 'heat', 'air', 'noiseD', 'noiseN', 'elev', 'built', 'well']);
  for (const field of fields) expect(Buffer.from(field.data, 'base64')).toHaveLength(meta.fw * meta.fh);
});

test('the map is a registered experience with a pinned deck.gl bundle', () => {
  const app = EXPERIENCES.find(row => row.id === 'city-systems-map');
  expect(app).toMatchObject({ category: 'worlds', route: '/tools/city-systems-map', preview: '/tools/city-systems-map', evidence: 'mixed' });
  expect(experienceFromLocation('/tools/city-systems-map')?.id).toBe('city-systems-map');
  expect(isRegisteredHTMLFile('tools/city-systems-map.html')).toBe(true);
  expect(page).toContain('src="https://cdn.jsdelivr.net/npm/deck.gl@9.4.1/dist.min.js"');
  expect(page).toMatch(/integrity="sha384-[A-Za-z0-9+/]{64}"\s+crossorigin="anonymous"/);
  expect(page).toContain('<script type="module" src="/tools/city-systems-map.js"></script>');
  expect(page).toContain('href="/tools/city-systems-map.css"');
});

test('the production server serves the map, its script and its data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hbl-city-map-test-'));
  const server = Bun.spawn([process.execPath, '--no-env-file', 'run', 'server.js'], {
    env: {
      PATH: process.env.PATH, PORT: '0', NODE_ENV: 'test', HBL_WORLD_DB_PATH: ':memory:',
      DECISION_STORE_DIR: join(directory, 'decision'), HBL_JOURNAL_ROOT: join(directory, 'journals'),
      HBL_SERVER_LOG_DIR: join(directory, 'server-logs'), HBL_DETECTIVE_ROOT: join(directory, 'detective'),
    },
    stdout: 'pipe', stderr: 'pipe',
  });
  const timer = setTimeout(() => server.kill(), 10000);
  try {
    const reader = server.stdout.getReader(), decoder = new TextDecoder();
    let startup = '', port;
    while (!port) {
      const { value, done } = await reader.read();
      if (done) throw new Error('HappyBearLandia did not start');
      startup += decoder.decode(value, { stream: true });
      port = startup.match(/HappyBearLandia running at http:\/\/localhost:(\d+)\r?\n/)?.[1];
    }
    reader.releaseLock();
    const origin = 'http://127.0.0.1:' + port;
    const html = await fetch(origin + '/tools/city-systems-map');
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(await html.text()).toContain('<script type="module" src="/world/universe/app-bootstrap.js"></script>');
    const js = await fetch(origin + '/tools/city-systems-map.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    const data = await fetch(origin + '/data/city-systems-map/meta.json');
    expect(data.status).toBe(200);
    expect((await data.json())[0].version).toBe(meta.version);
  } finally {
    clearTimeout(timer);
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
