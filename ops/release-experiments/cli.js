import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from 'node:fs';
import { applyEvent, replay, results } from './system.js';

export function run(command, file, input) {
  if (!['create', 'observe', 'decide', 'status'].includes(command) || !file) throw Error('Usage: bun ops/release-experiments/cli.js <create|observe|decide|status> <private-history.json> [input.json]');
  if (command === 'status') { const state = replay(JSON.parse(readFileSync(file, 'utf8'))); return { ...state, results: results(state) }; }
  // Single-host private operator store. Fail closed on concurrent writers/crashed lock.
  const lock = file + '.lock';
  mkdirSync(lock, { mode: 0o700 });
  const temp = file + '.tmp';
  try {
    if (command === 'create' && existsSync(file)) throw Error('History already exists');
    const events = command === 'create' ? [] : JSON.parse(readFileSync(file, 'utf8'));
    const state = events.length ? replay(events) : null;
    const payload = JSON.parse(readFileSync(input, 'utf8'));
    const event = command === 'create' ? { type: 'create', spec: payload } : command === 'observe' ? { type: 'observe', observation: payload } : { type: 'decide', decision: payload };
    const next = applyEvent(state, event);
    writeFileSync(temp, JSON.stringify([...events, event], null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temp, file);
    return { status: next.status, proposal: next.proposal, results: results(next) };
  } finally { rmSync(temp, { force: true }); rmSync(lock, { recursive: true }); }
}
if (import.meta.main) {
  try { console.log(JSON.stringify(run(...process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
