# Life Story

**Life story** (in the selected resident's action bar next to *Play as
resident*, and in the World navigation) opens a narrated, inspectable account
of one resident's recorded day: what they did, where, what it
did to their needs and money, why the model chose it, and what is pressing now.
Players can change the day with **Change their day** nudges and watch the
consequences arrive as new moments.

## Files

| File | Role |
| --- | --- |
| `life-story.js` | Pure builder: `buildLifeStory(source)` → moments, now, hooks, gaps, provenance, facts digest |
| `legacy-source.js` | Read-only source for the legacy World (`world/sim.js`), plus the nudge passthrough to `world.commandPerson` |
| `life-story-view.js` | Panel renderer with live refresh; mounted by `world/launch-shell.js` |
| `world/people/person-command-menu.js` | **Life story** button in the resident action bar; dispatches `hbl:open-life-story` |
| `life-story.css` | Panel styles, reduced-motion aware |

`world/render.js` exposes two host methods on `window.hblWorldActivity`:
`getLifeStorySource(id)` (legacy mode; `null` for the living population) and
`commandResident(id, option)`. Both lazy-load `legacy-source.js`.

## Facts and narration are separate

Every moment carries `facts` and `narration`.

- **Facts** are copied from recorded evidence (`recorded routine interval`,
  `recorded event`, `decision trace`, `current model state`, `social model
  record`) or are `derived` with the formula shown beside the value.
- **Narration** is cosmetic text produced by versioned templates
  (`life-story-narration.v1`) from those facts only. It adds no model state and is
  never fed back into any simulation. **Show narration** off hides it and opens
  the facts.
- A test checks that every number told in narration is supported by a listed
  fact (a duration of "2 h 5 min" counts as 125 minutes).

## Reproducibility

`buildLifeStory` is a pure function. `factsDigest` (FNV-1a over canonical facts,
excluding narration) identifies the story: seed-matched replays of an unnudged
legacy run produce the same digest and identical narration. A nudged run
reproduces given the same command schedule, as `docs/models/legacy.md` states for
all person commands. The footer shows run ID, seed, model version, story and
narration versions and the digest.

## What the builder does with recorded data

- Routine intervals (≤96 per resident, time-averaged needs) become moments.
  Same-activity bouts separated only by idle or sub-2-minute travel merge; travel
  of 2+ minutes becomes a trip moment.
- Four or more consecutive short moments (≤30 min) at one place with at most
  three activities roll up into one routine moment ("switching between watching
  TV and chatting with Hana Kim"). The facts list each activity's count and
  minutes and the number of moments summarized.
- Need changes compare the recorded bouts just before and just after a moment.
  Gains are told only when the activity's own rate in `ACTIONS` restores that
  need; declines only for stretches of 60+ minutes.
- "Why?" uses the decision trace: needs at decision time, the chosen activity and
  scored runners-up. The need named is the one with the most room the activity
  restores (rate × (100 − need)); work and study are named as scheduled
  obligations; when every option scored below 1 the story says nothing was
  pressing.
- Player commands (`USER_COMMAND_*`, `PLAYER_WALK_REQUESTED`, interrupted trips)
  are influence moments. Unknown event types are described in words with their
  scalar fields as facts, never as JSON.
- Plain "caught up" conversation memories fold into routine moments; other
  relationship memories (misunderstandings, reconciliations, promises) appear as
  their own moments with the social model's text marked as such.

## Limits

- The living population (default 10,000-resident mode) records trips and
  activity starts but not routine intervals or decision traces, so its stories
  are events-only and say so. **Get started** follows a classic-neighborhood
  resident, which has full detail; it still opens the inspector, as the World
  panel manager allows one foreground panel.
- Event detail shares a bounded global log; older moments keep routine facts but
  lose place names and prices. The story states how many were not retained and
  never reconstructs them.
- The social model is inspected only after the host has created it, so opening a
  story never adds social state.
- Chat partners come from relationship memories in the same time window, not
  from the encounter itself.

## Tests

```sh
bun test test/life-story.test.js
npx playwright test test/e2e/life-story.e2e.js
```

The unit suite includes real legacy-model checks: names, prices and decision
matches; a read-only check (a watched world stays byte-identical to an unwatched
one); seed-matched replay; a nudge flowing through the existing command; and a
refresh budget. The browser journey runs the real launch shell and the real
legacy model in the page (no GPU) on desktop and mobile.
