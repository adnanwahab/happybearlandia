// bun scripts/benchmark-spatial-neighbors.js [count<=1000000] [uint32 seed] [repeats<=10]
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fixture, buildIndex, bruteForce, VERSION } from '../world/spatial/neighbor-index.js';
const args = process.argv.slice(2);
const child = args[0] === '--sample';
const [count = 1000000, seed = 42, repeats = 3] = (child ? args.slice(1,4) : args).map(Number);
if ((!child && args.length > 3) || !Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new RangeError('Expected count, seed, repeats (1..10)');
const hash = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const sorted = values => values.slice().sort((a,b) => a-b);
if (child) {
  const method = args[4], hubFraction = Number(args[5]);
  const p = fixture({count,seed,hubFraction});
  const inputHash = createHash('sha256').update(p.x).update(p.y).digest('hex');
  Bun.gc(true);
  const before = process.memoryUsage();
  const start = performance.now();
  const index = buildIndex(p,method);
  const buildMs = performance.now()-start;
  Bun.gc(true);
  const after = process.memoryUsage();
  const batches = [];
  const queryResults = [];
  for (const [stratum,size] of [['population',count],['hub',p.hubCount]]) {
    if (!size) continue;
    const latencies = []; let candidates = 0, collisions = 0;
    for (let q = 0; q < Math.min(256,size); q++) {
      const id = Math.floor(q * size / Math.min(256,size));
      const begin = performance.now();
      const result = index.query(id,4);
      latencies.push((performance.now()-begin)*1000);
      candidates += result.candidates; collisions += result.neighbors.length;
      queryResults.push([stratum,id,sorted(result.neighbors),result.candidates]);
    }
    latencies.sort((a,b) => a-b);
    batches.push({stratum,queries:latencies.length,p50Us:latencies[Math.floor(latencies.length*0.5)],
      p95Us:latencies[Math.floor(latencies.length*0.95)],maxUs:latencies.at(-1),
      candidates,collisionMatches:collisions});
  }
  // Full independent oracle on a bounded fixture; sampled oracle on the measured data.
  let oracleQueries = 0;
  for (const source of [fixture({count:Math.min(256,count),seed,hubFraction}),p]) {
    const target = source === p ? index : buildIndex(source,method);
    const n = source === p ? Math.min(8,count) : source.x.length;
    for (let q=0;q<n;q++) {
      const id = source === p ? Math.floor(q*count/n) : q;
      if (JSON.stringify(sorted(target.query(id,4).neighbors)) !== JSON.stringify(bruteForce(source,id,4))) throw new Error('oracle mismatch');
      oracleQueries++;
    }
  }
  console.log(JSON.stringify({method,hubFraction,hubCount:p.hubCount,inputHash,buildMs,
    memory:{before,after,retainedHeapDeltaBytes:after.heapUsed-before.heapUsed,rssDeltaBytes:after.rss-before.rss},
    stats:index.stats,batches,resultHash:hash(queryResults),oracleQueries,oracleMismatches:0}));
} else {
  // Validate before launching any workload.
  fixture({count:0,seed});
  if (!Number.isInteger(count) || count < 0 || count > 1000000) throw new RangeError('count');
  const samples = [];
  for (const hubFraction of [0,0.01,0.1]) for (let repeat=0;repeat<repeats;repeat++) for (const method of ['hash','sorted']) {
    const result = spawnSync(process.execPath,[import.meta.path,'--sample',String(count),String(seed),String(repeats),method,String(hubFraction)],{encoding:'utf8',maxBuffer:4*1024*1024});
    if (result.status !== 0) throw new Error(result.stderr || `sample failed: ${result.status}`);
    samples.push({...JSON.parse(result.stdout),repeat});
  }
  for (const sample of samples) {
    const reference = samples.find(s => s.hubFraction === sample.hubFraction);
    if (sample.inputHash !== reference.inputHash || sample.resultHash !== reference.resultHash) throw new Error('cross-method/replay mismatch');
  }
  console.log(JSON.stringify({version:VERSION,source:'synthetic-lcg32-four-hubs.v1',rules:'euclidean-inclusive-radius.v1',
    measuredAt:new Date().toISOString(),command:process.argv,count,seed,repeats,tileSize:16,radius:4,
    units:'integer coordinate units; microseconds per query; milliseconds per build; bytes',
    machine:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,
      logicalCPUs:os.cpus().length,memoryBytes:os.totalmem(),runtime:process.versions},
    protocol:'fresh Bun subprocess per method/skew/repeat, GC before/after build; build excludes fixture and GC; query includes result allocation, excludes sorting/hash/oracle; 256 deterministic queries per stratum, no warmup',
    limitations:['Synthetic snapshot indices, no production movement/contact integration or scalar-oracle equivalence.',
      'Candidate checks and radius matches are directed geometric counts, not modeled interactions or collision resolution.',
      'Population queries are evenly spaced IDs; hub queries deliberately oversample hubs. No all-pairs million-agent correctness claim.',
      'Memory deltas are noisy runtime observations; RSS includes allocator/build high-water effects. Typed bytes exclude JS containers and temporary sort storage.',
      'Single local machine, sequential cold builds, no GPU/browser/workers or sustained timestep throughput.'],samples},null,2));
}
