# Local City Builder Tournament

Normal entry: `/world/challenges.html`, City Builder Tournament panel.
Owned modules: `tournament.js` (pure recipe/replay orchestration) and
`tournament-ui.js` (ephemeral local submissions). This is an explicit opt-in
same-device bracket, not authenticated multiplayer or an anti-cheat service.
No network publication, invitations or persistent participant records exist.
Delete clears in-memory submissions/results; downloaded copies require manual deletion.

`submitRecipe(entries, selection, true)` snapshots and deeply freezes each
submission. `runTournament({rule: RULE, challenges, entries})` snapshots input
before awaiting and validates both challenge envelopes. Supported brackets have
2 or 4 ordered plans, two distinct seeds and equal engine/horizon/budget/action/
metric/guard/reference definitions. Each plan runs on every supplied initial
state. Invalid selections or missing consent disqualify with reasons; budget or
guard failures disqualify with full runs retained. Missing observations or
execution failures reject the bracket without a winner. No supplied scores are
trusted. The receipt retains the input recipe and all executed verification runs.

Version `city-bracket.v1` scores the sum of final unhoused households, lower is
better. Adjacent single elimination uses earlier submission on exact ties,
explicitly a normative game rule rather than a fairness inference. The default
fixture uses `createCity({households:6,seed})` for seeds 42/73, 12 monthly steps,
$5,000 illustrative public capital cap and two registered interventions. It
reuses the Monthly City model and unchanged challenge guard/metric contracts;
there is no new agent behavior or clock. Costs exclude private construction and
operations. These synthetic outputs cannot establish real-world policy merit.

Each receipt embeds complete initial states, challenge digests, engine versions,
metric definitions/sources, seeds, selections, final states and capital ledgers.
Retain the generating source revision alongside a receipt: engine version alone
is not a code archive. Hashes detect changes, not authorship or server authority.
To independently recompute an exported receipt in the matching checkout:

```js
import {runTournament} from './world/challenges/tournament.js';
const saved = await Bun.file('private-city-bracket.json').json();
const recomputed = await runTournament(saved.recipe);
console.log(JSON.stringify(recomputed) === JSON.stringify(saved));
```

No import UI is offered in this slice. Export is an explicit local download and
has no social sharing rights grant. Authenticated remote participation, signed
submission timestamps, public sharing/deletion and historical engine retention
require separate reviewed storage/authorization contracts.
