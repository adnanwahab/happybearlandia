import { runLocalIdea, validateLocalIdea, LOCAL_IDEA_RULES } from '../civilization/ideas/local.js';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

// The checkpoint is copied and frozen; predictions never enter model execution.
export function createDiffusionTag(checkpoint) {
  if (!checkpoint) throw Error('No source data. Load the authored demo to predict.');
  const pinned = structuredClone(checkpoint);
  if (pinned.recipe.model !== LOCAL_IDEA_RULES.model || pinned.recipe.rules !== LOCAL_IDEA_RULES.rules)
    throw Error('Replay mismatch: unsupported model or rules.');
  validateLocalIdea(pinned);
  const source = freeze(pinned);
  if (source.recipe.ticks !== 0) throw Error('Replay mismatch: expected tick-zero checkpoint.');
  let state = 'predicting';
  return {
    source,
    cancel() { state = 'cancelled'; return { state }; },
    reveal(predictions, expected) {
      if (state !== 'predicting') throw Error('Load the demo before predicting again.');
      const ids = new Set(source.recipe.residents.map(r => r.id));
      if (!Array.isArray(predictions) || predictions.some(id => !ids.has(id) || id === source.recipe.originId))
        throw Error('Choose recipients from the frozen graph.');
      const actual = runLocalIdea({ ...source.recipe, ticks: 1 });
      if (expected !== undefined && JSON.stringify(expected) !== JSON.stringify(actual))
        throw Error('Replay mismatch: no result revealed.');
      const events = actual.events.filter(e => e.tick === 1);
      const recipients = events.map(e => e.receiverId).sort();
      const selected = [...new Set(predictions)].sort();
      state = 'revealed';
      return freeze({ state, actual, events, correct: JSON.stringify(selected) === JSON.stringify(recipients) });
    },
  };
}
