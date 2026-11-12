import { branchCity } from './builder.js';
import { createQuestScenario, replayCommuteSample, runCommuteEnsemble } from './quests.js';

const actions = {
  branch: branchCity,
  open: createQuestScenario,
  compare: runCommuteEnsemble,
  replay: replayCommuteSample,
};

self.addEventListener('message', async ({ data }) => {
  const { id, action, options } = data;
  try {
    const run = actions[action];
    if (!Object.hasOwn(actions, action)) throw new Error('Unknown simulation request.');
    const result = await run(options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
});
