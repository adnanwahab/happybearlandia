# Resident Life Story (claude/resident-life-story)

Plan: make residents feel alive by narrating what the existing models already
record, separating cosmetic narration from model facts, and letting players nudge
a resident's day and watch the consequences. One bounded slice; no model rule
changes. The assessment that chose this slice, the ranked roadmap and the next
ten tasks are in
[experience-assessment-2026-11-18.md](experience-assessment-2026-11-18.md).

## Owned files

New: `world/stories/{life-story.js,legacy-source.js,life-story-view.js,life-story.css,README.md}`,
`test/life-story.test.js`, `test/e2e/life-story.e2e.js`, this record and the
assessment.

Edited:
- `world/launch-shell.js`: Legends becomes **Life story**; Get started opens it;
  `close()` stops its refresh. No open PR touches this file.
- `world/render.js`: two additive methods at the top of `window.hblWorldActivity`,
  inserted above the context lines that open PR #514 changes.

`docs/implementation-plan.md` and `docs/models/README.md` are not edited.

## Behaviour delivered

- **Get started** follows the first resident (unchanged) and opens their Life
  Story: name, age, trait and household cash; now-line and needs meters; hooks
  (lowest need, scheduled promise, unmet goal, shortfall); nudges; the day,
  newest first. Each moment has optional **Why?** (decision trace) and **Model
  facts** disclosures.
- **Show narration** off hides all narration and opens the facts.
- Nudges list the nearest distinct park and restaurant options from
  `world.getPersonCommandOptions`, with distance and price, and send the choice
  through `world.commandPerson`. The resulting `USER_COMMAND_*` and trip events
  appear as influence moments ("You asked…", "…, as you asked").
- The panel refreshes at most once per second while open and does nothing while
  closed. Open disclosures and keyboard focus survive refreshes.
- Living-population residents get an events-only story with a notice.

## Model review (ODD)

No model rule, coefficient, input, RNG, schedule, identity or retention change.
Life Story is a view that narrates existing records. `docs/models/README.md`
already scopes such views as acquiring no resident-state authority. The nudge
uses the existing legacy person command documented in `docs/models/legacy.md`;
reproduction of a nudged run needs that command schedule, as stated there.
`test/life-story.test.js` checks that reading stories leaves a seed-matched world
byte-identical: positions, needs, money, stats and event log after 480
minutes.

## Verification (actual results)

- `bun test test/life-story.test.js`: 14 pass, 0 fail, 123 assertions. Covers
  moment construction, decision explanations, obligation and idle wording,
  unknown events without JSON, determinism and digest behaviour, retention gaps,
  events-only sources, the now section and hooks, nudge selection, real-model
  names, prices and decisions, narration-number traceability across four
  residents, read-only behaviour, seed-matched replay, a nudge consequence and a
  refresh budget.
- `npx playwright test test/e2e/life-story.e2e.js`: 4 pass. Desktop 1440×900
  and mobile 390×844 Get started journeys; a nudge and its consequences;
  facts-only mode; an open explanation surviving refresh; the empty state. The
  journeys run the real launch shell and the real legacy model in the page,
  because this sandbox's SwiftShader WebGPU loses its device during the full
  World's first render.
- Related suites: `launch-gameplay`, `activity-history`, `legacy-checkpoint`
  and `comparison-pinboard` pass. Pre-existing failures, identical on unmodified
  `main` f521542: `text-adventure.test.js` (1, static-city link) and
  `world-first-run.e2e.js` (4).
- Browser performance (Chromium, real legacy model, history recording on):
  panel refresh, which is source plus build plus DOM, takes 6.1 ms at 40
  residents and 7.8 ms at 200. Source plus build alone takes 2.4–2.6 ms, with
  about 750–880 DOM nodes. One refresh per second while open; none while
  closed.
- Before/after: same in-page legacy world and resident (Aisha Chen, seed
  29.7286,-95.4746). Before, Legends showed raw JSON events with bare minute
  numbers. After, a narrated day with places, prices, need changes, reasons and
  nudges. Screenshots were captured outside the repository, following PR
  hygiene; reproduce with
  `HBL_LIFE_STORY_SHOTS=<dir> npx playwright test test/e2e/life-story.e2e.js`.

## Not verified / limits

- The full WebGPU World path (`render.js` host methods inside the live renderer)
  was not exercised in a browser here. The methods are two lines delegating to
  the module the tests cover. A real-GPU smoke run of Get started → Life story
  is the first reviewer check.
- Living-population stories are events-only until the population runtime
  publishes routine intervals (roadmap task 9).
- Chat partners are inferred from relationship memories in the same window, not
  from the encounter record.
