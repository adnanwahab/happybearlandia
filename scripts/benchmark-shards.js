import os from 'node:os';
import { runShardSpike } from '../world/shard-spike/run.js';
const results=[];
for(const latencyMs of [0,5]) for(const workers of [1,2,4,8]) results.push(await runShardSpike({workers,latencyMs}));
console.log(JSON.stringify({measuredAt:new Date().toISOString(),command:'bun scripts/benchmark-shards.js',machine:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,logicalCPUs:os.cpus().length,runtime:process.versions},measurement:'One cold run each; startup, serialization, barrier and oracle validation included. Bytes are UTF-8 JSON payload estimates, not transport wire bytes.',results},null,2));
