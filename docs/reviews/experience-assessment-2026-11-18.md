# HappyBearLandia experience assessment, 18 November 2026

Scope: what a first-time visitor experiences, judged against the defining journey
IDEA → SIMULATE → 100 FUTURES → COMPARE → ENTER A FUTURE → UNDERSTAND WHY →
CHANGE AN ASSUMPTION → RUN AGAIN.

## Evidence base

- **Production `/world` in a real browser**: happybearlandia.fly.dev in desktop
  Chrome with a hardware GPU, 729×737 window. First frame 0.88 s, ready 1.13 s,
  detailed geometry 3.96 s, 59–60 FPS. 250 resource requests, including 240 JS
  modules (1.66 MB transferred), 110 MB JS heap, 535 buttons and 24 panels in the
  DOM. Exercised: arrival, Get started, the resident inspector, Quests and
  Legends ("Recorded lives").
- **Local `main` at f521542** in headless Chromium 153 (SwiftShader WebGPU) at
  1440×900 and an iPhone 13 profile: `/`, `/world`, `/world?renderer=webgl2`
  (static city), `/world/decision.html?demo=1`, `/world/impact`.
- **The legacy World model run headlessly** (Gulfton, 40 residents, recorded
  history) to read actual resident days.
- **Repository review**: design, implementation plan, model ODD inventory,
  City X-Ray review (`docs/reviews/SHE-1045.md`), policy impact preview, about 60
  open PRs and their file inventories.

Also verified, small: `world/render.js` imports `./render/renderer/canvas-renderer.js`
under `?renderer=canvas`, and that file does not exist **[D]**.

Key: **[D]** verified defect · **[W]** design weakness · **[S]** speculative
opportunity.

## Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Visual quality and cinematic impact | 5 | Real-GPU World renders a dense extruded city with trees at 60 FPS, but lighting is flat, identical "Food spot · 0" billboards clutter the skyline, and residents are not legible from the arrival camera. Decision Studio and the landing page are typographically polished. Policy Impact uses a separate light theme. The WebGL2 fallback is clean but has no life. |
| Fun and replayability | 3 | Arrival offers no core loop. Get started follows a resident into overlapping panels. Quests are threshold notices ("social is 30/100"). About 60 open PRs add separate mini-games (Zoning Jury, Pop-up Café, Supply Chain Domino…) rather than deepening one loop. |
| Ease of understanding | 3 | 535 buttons and 24 panels in `/world`. Jargon on first screens ("Selection seed", "Seed: 42", "Source: Legacy World social.ties · Run: legacy:29.7286,-95.4746:default:360"). Decision Studio's demo page carries about 58,000 characters of text, with 504 buttons on mobile. "Legends" printed raw JSON (fixed by this change). |
| Quality of resident behaviors | 6 | The models underneath are rich: utility-based choices from needs, traits, schedules, prices and travel; household cash with nightly housing costs and shortfall stress; sidewalk routing and transit fares; encounters; relationship ties, memories, goals and promises; a 10,000-agent living population. Weaknesses: duplicate names inside one household **[D]** ("Maria Williams and Maria Williams caught up"); seven-hour TV-and-chat loops; two resident models with different identities, and Get started silently switches between them. |
| Quality of simulation visualization | 4 | Overlays sit behind Advanced settings. The city event feed is hidden in launch mode (`#feed{display:none}`). Trips and decisions are not visible by default. City X-Ray exists only as a contract plus a Canvas2D diagnostic; its GPU effect was never run (SHE-1045). |
| Scientific credibility | 7 | Strong discipline: ODD descriptions for 10+ models, seeds and run IDs everywhere, matched seeds and 100-run batches in Decision Studio, explicit synthetic labelling, retention notices, deterministic replay tests. Detractors: provenance prose overwhelms users, there is no visible identity or clock mapping between the two population models, and there is no empirical calibration (acknowledged in the docs). |
| Performance | 7 | Sub-1.2 s to an interactive World and 60 FPS on a real GPU. Costs: 240 unbundled JS modules and a 110 MB heap. Headless SwiftShader lost the device during first render and left a blank canvas, while building-progress text replaced the error UI. **[D]** in SwiftShader; behaviour on a real GPU that loses its device is unverified. |
| Emotional engagement | 3 | Residents have names, traits, money, needs and relationships, but the UI presented them as meters and ledgers, with no narrative and no "what happens next". |
| First-time user experience | 4 | The landing headline ("Choose a housing policy. Watch two possible futures. Discover why they differ.") and its 60-second CTA are strong. The World arrives with 11 navigation entries, status chips and seed text. `/world/impact` without a preview ID is a dead end **[D]**. The Decision Studio demo puts its payoff below the fold on mobile. |
| Overall product coherence | 3 | World, Decision Studio, Policy Impact, static city, City Lab, text adventure, a 31-experience directory and about 60 pending mini-features, in three visual languages. The defining journey's ENTER A FUTURE step has no handoff from Decision Studio futures into the World; `docs/design.md` notes an adapter is still required. |

## The 20 most valuable improvements

Ranked by expected user impact ÷ implementation effort (each 1–5).

| # | Improvement | Type | Impact | Effort |
| --- | --- | --- | --- | --- |
| 1 | Unique resident names within a household (generator collision) | D | 3 | 1 |
| 2 | `/world/impact` without a preview: offer the latest public previews or the Decision Studio demo instead of a dead end | D | 3 | 1 |
| 3 | Repair or retire drifted tests: 4 of 5 `world-first-run.e2e.js` and 1 `text-adventure.test.js` fail on `main` | D | 3 | 1 |
| 4 | **Life Story: a narrated, inspectable resident day with nudges, replacing raw-JSON "Recorded lives" (delivered in this change)** | W | 5 | 2 |
| 5 | Pause new HBL-FUN mini-games; integrate the best three into one progression | W | 5 | 2 |
| 6 | Arrival handoff: ease the camera to the Get started resident with their Life Story open | W | 4 | 2 |
| 7 | City story ticker: narrated city events using the Life Story facts/narration pattern, visible in launch mode | W | 4 | 2 |
| 8 | Decision Studio demo shows the 100-futures result first, especially on mobile | W | 4 | 2 |
| 9 | Device-loss and initialization recovery that progress text cannot overwrite | D | 4 | 2 |
| 10 | Cluster or zoom-gate repeated place billboards ("Food spot · 0") | W | 3 | 2 |
| 11 | Plain-language provenance everywhere: run, seed and model moved into a "Model facts" disclosure | W | 3 | 2 |
| 12 | Life Story for living-population residents: publish routine intervals and decision reasons from the population runtime | W | 4 | 3 |
| 13 | ENTER A FUTURE: open the World at a Decision Studio future's scenario and year with a resident's story | S | 5 | 4 |
| 14 | Resident goals with stakes (rent shortfall → job search, side gig, roommate), with an ODD update | S | 4 | 4 |
| 15 | Lazy-mount World panels to cut 535 buttons and 24 panels at load | W | 3 | 3 |
| 16 | Production bundle for the 240 World modules | W | 3 | 3 |
| 17 | Diversify idle-time routines (seven-hour TV/chat loops), with an ODD update | W | 3 | 3 |
| 18 | One visual language across World, Decision Studio and Policy Impact | W | 3 | 3 |
| 19 | Shareable Life Story links (run recipe + resident + minute → same digest) | S | 3 | 3 |
| 20 | Integrate the City X-Ray contract into the WebGPU renderer as a real toggle | S | 3 | 4 |

Why #4 was built now: items 1–3 are small fixes that do not change the
experience. #5 is a process decision for the coordinator. Among code changes,
Life Story has the highest impact at bounded effort. It turns the existing
resident models into an observable, influenceable story (the UNDERSTAND WHY step
at the scale of a single person). It needs no model change and only two additive
lines in the contended `world/render.js`.

## Next ten implementation-ready tasks

Each task is independent. Workers own the listed files, record evidence in
`docs/reviews/<ISSUE-ID>.md` and leave `docs/implementation-plan.md` to the
coordinator.

1. **Unique household names.** Own `world/gen.js` (name assignment) and a new
   `test/resident-names.test.js`. Accept: no duplicate full names within a
   household for seeds 0–49 at 30, 100 and 300 residents. Existing name-based
   fixtures still pass. Verify: `bun test test/resident-names.test.js test/legacy-checkpoint.test.js`.
2. **Policy Impact empty state.** Own `world/policy-impact.html` and
   `world/policy-impact.js` (empty state only). Accept: `/world/impact` with no
   preview links to the Decision Studio demo and to the latest public preview
   when one exists; no network write. Verify: a new
   `test/e2e/policy-impact-empty.e2e.js` at desktop and 390 px.
3. **Test drift.** Own `test/e2e/world-first-run.e2e.js` and
   `test/text-adventure.test.js`. Accept: each failing assertion is updated to
   current intended behaviour, or the test is retired with a recorded reason;
   suite green on `main`. Verify: run both suites before and after.
4. **Arrival handoff to Life Story.** Own the `action('start')` path in
   `world/launch-shell.js` and one camera hunk in `world/render.js`
   (`followResident`). Accept: one click from arrival frames the resident within
   2 s (reduced motion: cut), Life Story open, no other panels overlapping at
   1440 and 390 px. Verify: Life Story e2e plus a WebGPU smoke test on a
   real-GPU runner.
5. **City story ticker.** Own a new `world/stories/city-ticker.js` and its CSS.
   Reuse `life-story.js` patterns (facts and narration, versioned templates).
   Accept: `WORLD_*` and household-shortfall events narrated at most once per
   5 s; click opens facts; hidden under `embed=1`; no new model state. Verify:
   unit tests for templates and traceability, plus a fixture e2e.
6. **Decision Studio result-first demo.** Own `world/decision*.css` and the demo
   layout code only. Accept: at 390×844 with `?demo=1`, the 100-futures summary
   and comparison chart are above the fold; assumptions collapsed but one tap
   away. Verify: existing decision e2e plus a new mobile screenshot assertion.
7. **GPU recovery.** Own `world/renderer-entry.js` and the loading and error UI.
   Accept: after a forced `device.destroy()` or init failure, a persistent
   recovery panel (Try again / City view) stays visible and progress text cannot
   replace it. Verify: SwiftShader e2e that destroys the device after the first
   frame.
8. **Billboard clustering.** Own the module that creates "Food spot · N"
   labels. Accept: at most 6 place labels on screen at the arrival camera;
   labels for places with zero visitors appear only on hover or zoom; no FPS
   regression beyond 1 ms per frame on the performance budget test. Verify:
   `bun test test/performance-budgets.test.js` plus a screenshot.
9. **Living-population life stories.** Own the population history query path
   (`world/population/runtime.js` activity-history payload and its worker
   handler). Accept: `actorTimeline.intervals` and decision reasons published
   for tracked actors under the existing retention limits; `buildLifeStory`
   yields routine moments for living residents; `docs/models/population.md`
   retention section updated. Verify: population history tests plus a Life
   Story unit test on a recorded living fixture.
10. **Shareable Life Story.** Own `world/stories/share.js` and the Life Story
    footer. Accept: "Copy story link" encodes run recipe, resident, minute and
    command schedule; opening it replays to the same `factsDigest` or explains
    which input is missing. Verify: a digest-equality test across two
    simulated loads.
