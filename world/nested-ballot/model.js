function createModel(h3) {
  const LEVELS = ['Global', 'Country', 'City', 'Neighborhood', 'Block'];
  const QUESTIONS = [
    'Fund a shared climate-adaptation pool that every country pays into?',
    'Guarantee 12 weeks of paid family leave nationwide?',
    'Run buses every 10 minutes on the 20 busiest routes?',
    'Turn the vacant lot into a community garden and shade pavilion?',
    'Add speed humps and a crosswalk on our street?'
  ];
  const PROMPTS = [
    'What should the whole planet decide together?',
    'What does this country need that no city can do alone?',
    'What would make this city work better for you this year?',
    'What do you notice walking around this neighborhood?',
    'What happened on your block this week?'
  ];

  // Named places. center [lat, lng], display res, ring size k.
  const NAMED = {
    'global': { children: [
      ['usa', 'United States', 39.5, -98.5, 2, 5],
      ['mex', 'Mexico', 23.5, -102.5, 2, 3],
      ['bra', 'Brazil', -10, -52, 2, 5],
      ['gbr', 'United Kingdom', 53.8, -2.2, 2, 1],
      ['deu', 'Germany', 51, 10.4, 2, 1],
      ['nga', 'Nigeria', 9.1, 8.1, 2, 2],
      ['ken', 'Kenya', 0.3, 37.9, 2, 2],
      ['ind', 'India', 21.5, 78.9, 2, 4],
      ['jpn', 'Japan', 36.5, 138.5, 2, 2],
      ['aus', 'Australia', -25, 134, 2, 5]
    ]},
    'global/usa': { children: [
      ['houston', 'Houston', 29.76, -95.55, 5, 3],
      ['austin', 'Austin', 30.27, -97.74, 5, 2],
      ['nyc', 'New York', 40.71, -74.0, 5, 3],
      ['chicago', 'Chicago', 41.88, -87.63, 5, 3],
      ['sf', 'San Francisco', 37.77, -122.42, 5, 2],
      ['seattle', 'Seattle', 47.6, -122.33, 5, 2],
      ['atlanta', 'Atlanta', 33.75, -84.39, 5, 2]
    ]},
    'global/usa/houston': { children: [
      ['katy', 'Katy', 29.786, -95.824, 7, 3],
      ['energy', 'Energy Corridor', 29.78, -95.63, 7, 2],
      ['sugarland', 'Sugar Land', 29.62, -95.63, 7, 3],
      ['heights', 'The Heights', 29.80, -95.40, 7, 1],
      ['downtown', 'Downtown', 29.758, -95.365, 7, 1],
      ['montrose', 'Montrose', 29.743, -95.393, 7, 1],
      ['thirdward', 'Third Ward', 29.722, -95.355, 7, 1],
      ['pasadena', 'Pasadena', 29.69, -95.21, 7, 2]
    ]}
  };

  const ROOT = {
    id: 'global', name: 'Earth', level: 0,
    hexes: [], center: [10, 0]
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function rand(seed) { // deterministic 0..1
    let x = hash(seed);
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return (x % 100000) / 100000;
  }
  function centroid(hexes) {
    let la = 0, ln = 0;
    for (const h of hexes) { const [a, b] = h3.cellToLatLng(h); la += a; ln += b; }
    return [la / hexes.length, ln / hexes.length];
  }
  function bounds(hexes) {
    let minLa = 90, maxLa = -90, minLn = 180, maxLn = -180;
    for (const h of hexes) for (const [a, b] of h3.cellToBoundary(h)) {
      if (a < minLa) minLa = a; if (a > maxLa) maxLa = a;
      if (b < minLn) minLn = b; if (b > maxLn) maxLn = b;
    }
    return [[minLn, minLa], [maxLn, maxLa]];
  }

  const cache = new Map();
  cache.set('global', ROOT);

  function childrenOf(node) {
    if (node.level >= LEVELS.length - 1) return [];
    if (node._children) return node._children;
    let kids = [];
    const named = NAMED[node.id];
    if (named) {
      const claimed = new Set();
      for (const [slug, name, lat, lng, res, k] of named.children) {
        const disk = h3.gridDisk(h3.latLngToCell(lat, lng, res), k).filter(h => !claimed.has(h));
        disk.forEach(h => claimed.add(h));
        kids.push({ id: node.id + '/' + slug, name, level: node.level + 1, hexes: disk });
      }
    } else {
      // Procedural: split this region by coarser H3 parents, refine one resolution down.
      const res = h3.getResolution(node.hexes[0]);
      const groups = new Map();
      for (const h of node.hexes) {
        const p = h3.cellToParent(h, Math.max(0, res - 1));
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(h);
      }
      let sorted = [...groups.values()].sort((a, b) => b.length - a.length);
      const label = node.level + 1 === 4 ? (i) => 'Block ' + String.fromCharCode(65 + i)
        : node.level + 1 === 3 ? (i) => 'Neighborhood ' + (i + 1)
        : node.level + 1 === 2 ? (i) => 'City region ' + (i + 1)
        : (i) => 'Region ' + (i + 1);
      sorted.forEach((g, i) => {
        const fine = g.flatMap(h => h3.cellToChildren(h, res + 1));
        kids.push({ id: node.id + '/' + (i + 1), name: label(i), level: node.level + 1, hexes: fine });
      });
    }
    for (const k of kids) {
      k.center = centroid(k.hexes);
      k.parent = node;
      cache.set(k.id, k);
    }
    node._children = kids;
    return kids;
  }

  function get(id) {
    if (cache.has(id)) return cache.get(id);
    const parts = id.split('/');
    let node = ROOT;
    for (let i = 1; i < parts.length; i++) {
      const next = childrenOf(node).find(c => c.id === parts.slice(0, i + 1).join('/'));
      if (!next) return null;
      node = next;
    }
    return node;
  }

  // Seeded "other residents" tally for how region `childId` votes on the question asked at `askedAt`.
  function seededTally(childId, askedAt) {
    const node = get(childId);
    const size = node ? node.hexes.length : 10;
    const scale = [40000, 9000, 1400, 160, 22][node ? node.level : 4];
    const voters = Math.round(scale * (0.4 + rand(childId + '#n') ) * Math.sqrt(size) / 3) + 3;
    const lean = 0.25 + 0.55 * rand(childId + '|' + askedAt);
    const yes = Math.round(voters * lean);
    return { yes, no: voters - yes };
  }

  return { LEVELS, QUESTIONS, PROMPTS, ROOT, childrenOf, get, bounds, centroid, seededTally };
}
if (typeof module !== 'undefined') module.exports = { createModel };
