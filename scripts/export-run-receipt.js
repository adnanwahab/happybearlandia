import { loadExperiment } from '../world/future-machine/data/index.js';
import { createRunReceipt, canonicalReceiptJSON } from '../world/future-machine/share/run-receipt.js';

// Explicit origin; never silently contact a production service.
export async function exportRunReceiptCLI(args, {stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text)} = {}) {
  const originalFetch = globalThis.fetch;
  try {
    if (args.length !== 3) throw new Error('Usage: bun scripts/export-run-receipt.js <http-origin> <city_id> <month 0..120>');
    const [origin, id, selected] = args;
    const url = new URL(origin);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an HTTP origin without credentials, path, query or fragment');
    if (!/^city_[\w-]{1,96}$/.test(id) || !/^(0|[1-9][0-9]{0,2})$/.test(selected) || Number(selected) > 120) throw new Error('Invalid experiment ID or month');
    globalThis.fetch = (path, options) => originalFetch(new URL(path, url.origin), options);
    const history = await loadExperiment(id);
    const receipt = await createRunReceipt(history, {month:Number(selected)});
    stdout(canonicalReceiptJSON(receipt) + '\n');
    return 0;
  } catch (error) {
    stderr(`Run receipt export failed: ${error.message}\n`);
    return 1;
  } finally { globalThis.fetch = originalFetch; }
}
if (import.meta.main) process.exitCode = await exportRunReceiptCLI(process.argv.slice(2));
