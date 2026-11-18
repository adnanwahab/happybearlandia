import { readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { readStores } from './read-stores.js';
import { reviewDraft } from './queue.js';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
if (import.meta.main) {
  const [command, first, second, third, output] = process.argv.slice(2);
  try {
    let result, destination;
    if (command === 'prepare' && output) {
      result = readStores({ countsPath: first, patchPath: second, backlog: read(third) });
      destination = output;
    } else if (command === 'review' && third) {
      result = reviewDraft(read(first), read(second));
      destination = third;
    } else throw new Error('usage');
    // Everything, including link decisions, stays under the private root.
    const root = resolve('.hbl-private');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const path = resolve(destination);
    const rel = relative(root, path);
    if (!rel || rel.startsWith('..' + sep) || rel === '..' || resolve(root, rel) !== path || dirname(path) !== root || realpathSync(root) !== root) throw new Error('private output required');
    writeFileSync(path, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Local review artifact saved. No ticket opened.');
  } catch {
    console.error('Triage preparation failed. Check private inputs, review revision and unused .hbl-private output path.');
    process.exitCode = 1;
  }
}
