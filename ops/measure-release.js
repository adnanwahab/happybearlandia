const [origin, samplesArg = '20', ...extra] = process.argv.slice(2);
const samples = Number(samplesArg);
let base;
try {
  base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      extra.length || !Number.isInteger(samples) || samples < 1 || samples > 100) throw new Error();
} catch {
  console.error('Usage: bun ops/measure-release.js <http-origin> [sample-count 1–100]');
  process.exit(1);
}

function percentile(sorted, value) {
  return Math.round(sorted[Math.ceil(sorted.length * value) - 1] * 100) / 100;
}

const results = [];
for (const path of ['/api/health', '/api/ready', '/tools/simulation-health/', '/']) {
  const elapsed = [];
  const statuses = {};
  let bytes = 0;
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(5000) });
      bytes += (await response.arrayBuffer()).byteLength;
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
    } catch {
      statuses.error = (statuses.error ?? 0) + 1;
    }
    elapsed.push(performance.now() - start);
  }
  elapsed.sort((a, b) => a - b);
  results.push({ path, samples, statuses, p50Ms: percentile(elapsed, .50), p95Ms: percentile(elapsed, .95),
    meanResponseBytes: Math.round(bytes / samples) });
}
console.log(JSON.stringify(results, null, 2));
if (results.some(row => row.statuses[200] !== samples)) process.exitCode = 1;
