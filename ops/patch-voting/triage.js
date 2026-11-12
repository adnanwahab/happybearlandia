// Local operator only. No public endpoint or automatic implementation handoff.
import { createPatchVotingStore } from './api.js';
const [command = 'list', source, target] = process.argv.slice(2);
const store = createPatchVotingStore();
try {
  if (command === 'merge' && source && target) store.mergeIdeas(source, target);
  else if (command !== 'list') throw new Error('Usage: bun ops/patch-voting/triage.js [list | merge SOURCE TARGET]');
  console.log(JSON.stringify({ votes: store.triageVotes(), feedback: store.listSuggestions() }, null, 2));
} finally { store.close(); }
