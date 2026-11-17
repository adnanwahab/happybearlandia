// Opt-in, engine-only experiment. No server registration or persistent run writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createCity} from '../../world/city/seed.js';
import {createEngine, addIntervention} from '../../world/city/engine.js';
import {VERSION} from '../../world/city/contracts.js';
import {canonicalJSON} from '../../world/replay/engine.js';

const bytes = value => Buffer.byteLength(JSON.stringify(value));
const hash = value => createHash('sha256').update(canonicalJSON(value)).digest('hex');
export function runCase(seed = 42) {
  const engine = createEngine(undefined, {trace:true});
  const initial = engine.initialize(createCity({seed, households:30}));
  const original = hash(initial), frames = [initial], recorded = [];
  let state = initial;
  for (let month=1; month<=24; month++) {
    const result = engine.step(state);
    recorded.push(result); frames.push(result.state); state=result.state;
  }
  const policy = {type:'housing', districtId:'d1', amount:24, cost:1000000};
  // Inputs occur AFTER month 12, before stepping month 13. Parent is immutable.
  function branch(start, from) {
    let state = structuredClone(start), steps = 0;
    const output = [];
    for (let month=from; month<24; month++) {
      if (month===12) state=addIntervention(state, policy);
      const result=engine.step(state); output.push(result); state=result.state; steps++;
    }
    return {state, output, steps};
  }
  const timed = fn => {const start=performance.now();const result=fn();return {...result, ms:performance.now()-start};};
  const checkpointHash=hash(frames[12]);
  const a=timed(()=>branch(initial,0)), b=timed(()=>branch(frames[12],12));
  assert.deepEqual(b.output,a.output.slice(12), 'Every suffix state and trace must agree');
  assert.equal(hash(initial),original);
  assert.equal(hash(frames[12]),checkpointHash);
  // A state-only local edit is deliberately invalid: governance, queues and
  // downstream allocations cannot be recovered by copying a displayed metric.
  const naive=structuredClone(frames[24]);naive.units=structuredClone(b.state.units);
  return {seed, initialHash:original, targetDigest:hash(b.state),
    controlDigest:hash(frames[24]), changed:hash(b.state)!==hash(frames[24]),
    A:{steps:a.steps,ms:a.ms,bytes:bytes({initial,inputs:[{afterMonth:12,policy}]})},
    B:{steps:b.steps,ms:b.ms,bytes:bytes({checkpoint:frames[12],inputs:[{afterMonth:12,policy}]})},
    archive:{monthlyStatesBytes:bytes(frames),eventsBytes:bytes(recorded.map(r=>r.events)),causalRecordsBytes:bytes(recorded.map(r=>r.causalRecords))},
    C:{status:'unsupported: no complete executable dependency/invalidation contract',
      conservativeFallbackSteps:b.steps, naiveUnitsOnlyMatches:hash(naive)===hash(b.state)},
    suffixEqual:true,parentUnchanged:true};
}
if (import.meta.main) {
  runCase(42); // warmup excluded
  const sources=['world/city/seed.js','world/city/contracts.js','world/city/engine.js','world/city/systems.js','world/replay/engine.js','experiments/she-234/benchmark.mjs'];
  console.log(JSON.stringify({schemaVersion:'she234-benchmark.v1',modelVersion:VERSION,
    runtime:Bun.version,platform:process.platform,arch:process.arch,rules:createEngine().manifest,
    sources:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')])),
    scenario:{households:30,months:24,branchAfterMonth:12,seeds:[7,42,2911],repeats:3},
    cases:[7,42,2911].flatMap(seed=>Array.from({length:3},()=>runCase(seed))),
    limits:['Synthetic uncalibrated model','Engine only; timings exclude IO, hashing and serialization','A replays scheduled inputs by recomputing, not descriptive output events','C has no executable prototype; units-only edit is a negative control','Raw JSON sizes; no compression, indexes or persistence overhead']},null,2));
}
