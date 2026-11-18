# Universe shell and contextual navigation

Homepage entry is `/?app=worldline&...`; no selected app means directory only. `registry.js` lists the 29 original experiences; the Tools directory app, Blog, and Twitch robot remain standalone and are excluded. Individual experiences hosted under `/tools/` are included. Causal World, inspector, and research hub are contextual links outside the 29-entry catalog.

`navigation.js` exports:

- `contextFromURL(url)`: validates canonical navigation keys through the foundation runtime. Missing base keys get the browsing defaults `universe:hbl:main`, `world:hbl:main`, `scenario:hbl:baseline`. Invalid IDs, duplicate context keys, and invalid ticks throw; they never silently become local IDs. The shell visibly reports invalid links and suppresses automatic entry.
- `contextURL(route, context)`: same-origin standalone link, retaining the destination's local query and hash while replacing canonical context keys.
- `shellURL(experienceId, context)`: registered experience link within the shell.
- `navigationMessage(type, context, extra)`: shared v1 envelope for app bridges.
- `createFrameBridge(...)`: exact same-origin + active iframe source validation, shared schema validation, universe/world boundary checks, and stale scenario/run/branch/tick checks for selections/navigation. Explicit `context` updates may change scenario within the same world. Unknown destinations and intervention messages have no navigation effects. Returns a disposer.

Foundation `NavigationContext` is authoritative: `universeId`, `worldId`, `scenarioId`, optional `experimentId`, `runId`, `branchId`, `tick`, `entityId`. Tick is simulation time, not wall-clock time. Run IDs never imply a seed/model version: browsing defaults are not a recorded `RunContext`.

`connected-navigation.js` exports `mountUniverseNavigation(container, {experienceId, onContext})`. Use it inside standalone apps for shared chrome and parent handshakes. Returned methods: `getContext()`, `select(canonicalEntityId)`, `navigate(registryId)`, `dispose()`. Apps must explicitly resolve canonical IDs through their domain mapping before loading local state. Carrying a household/person ID does not prove a destination supports that entity; entity actions retain context and domain panels validate availability. Native local `experiment`/`run` query parameters remain separate from canonical `experimentId`/`runId`.

The shell only instantiates the selected experience; the preserved gallery retains its existing proximity-based loading. Motion in the shell respects reduced motion. Gallery standalone links retain current context. Observed world geometry, synthetic model outputs, and fictional narratives are described separately; the shell does not infer causation or mutate model state. The separately owned opt-in local counter module receives only approved action strings from UI handlers.

Server integration exposes exactly `/shared/causality/index.js`, not the shared directory. Other feature owners may add explicitly reviewed public files independently.

Checks:

```sh
bun test test/universe-shell.test.js test/local-journeys.test.js
bunx playwright test --config test/e2e/universe-shell.config.js
bun /path/to/typescript/bin/tsc -p world/universe/tsconfig.json
bun build world/universe/shell.js world/universe/connected-navigation.js --target browser --outdir /tmp/hbl-universe-build
git diff --check
```

The type check verifies the exported API declarations against the shared TypeScript contract; JavaScript behavior is covered by runtime/unit/browser checks. Browser tests use same-origin fixture app documents to isolate shell behavior from GPU startup, upstream services, and individual model availability. They do not certify all app models or automatically install chrome into all 29 standalone apps.

### Optional contextual hints

`contextual-hints.js` mounts one inline, closed-by-default disclosure in the
existing standalone navigation; `/routes` mounts it beside directory tools.
It discovers native labeled buttons/fields and links only on request, excludes
hidden, inert, disabled and navigation controls, prefers actions over links, and
rechecks availability before focusing. It never clicks, changes inputs, reads
model state, advances time or runs an experiment. Labels come from the actual
controls, not inferred simulation evidence. Focus scrolls instantly, including
with reduced motion. No polling, animation or automatic prompt is added.

Dismissal uses `hbl-hints:v1:<experienceId>` in localStorage. It closes the panel
and retains a manually reopenable “dismissed” handle across reloads. Storage
failure keeps session dismissal usable. Native button keyboard activation and
Escape work; there is no focus trap or duplicate overlay. Shared bootstrap
coverage follows `registeredHTMLFiles()`; unrelated standalone documents and
the homepage shell require their own integration. Generic DOM order is a first
slice, not a claim that every workspace has an authored tutorial.

Checks: `bun test test/contextual-hints.test.js test/html-navigation.test.js
 test/universe-shell.test.js test/local-journeys.test.js` and
`bunx playwright test --config test/e2e/contextual-hints.config.js`.
The browser suite serves local documents through request interception and does
not fabricate model/API responses or certify live services. Optional
`HBL_HINT_BROWSER` selects an installed Chromium executable.

Homepage **Surprise Me** uses `surprise.js` and the ordered `curated-wonders.1`
curation: Future Machine (Canvas2D), Reverse Simulator and Reality Breakpoints.
These existing local City entry points require no account or live provider.
Same version, unsigned 32-bit selection seed and available subset reproduce the
choice. Unknown IDs/routes cannot introduce destinations. All three are currently
available; a future availability source must be local and explicit.

Results label the synthetic preset and native model seed separately from the
selection seed. **Change world** opens the existing independent preset; it does
not transfer or rewrite active run context, IDs, clocks or stored results.
Choosing does not fetch, persist, prewarm, run a model or animate. Editing the
seed clears the previous link. Empty curation disables selection and points to
existing navigation; without JavaScript, Play Demo and the directory remain.
Checks: `bun test test/surprise-wonder.test.js` and
`bunx playwright test --config test/surprise-wonder.browser.config.js`.

## Command-K travel and action palette (SHE-444)

The homepage shell and registered standalone bootstrap mount `command-palette.js`.
Cmd/Ctrl-K opens/toggles a native modal dialog. Its labeled combobox exposes a
listbox, active descendant and live result count; arrows select, Enter executes,
Escape restores the opener, and the native dialog contains Tab focus. Presentation
is instant for all motion preferences. Route search uses the entire current
registry (33 entries, superseding the ticket's 31); navigation retains validated
canonical scope through `contextURL`, without inventing model identity mappings.
Invalid URL context fails closed.

Owning views opt actual native buttons in with `data-palette-action` (`follow`,
`compare`, `why`, `photo`). `data-palette-context` identifies the owner selection /
run / month where a button can survive a context change. The palette checks
visibility, disabled/aria-disabled state, node identity, scope and URL context
again immediately before calling the existing handler. Native command admission,
authorization, busy guards and media persistence remain the owner's responsibility.
No arbitrary iframe commands or cross-model person mappings are added. World
resident Follow, Future Machine family Follow / comparison / metric WHY and
House date photo controls opt in. Missing, hidden, unsupported or unavailable
controls are absent; the homepage alone has travel results only.

Verification:

```sh
bun test test/command-palette.test.js test/universe-shell.test.js test/html-navigation.test.js test/future-machine-ui.test.js test/future-machine-family-card.test.js world/house/date-memory.test.js
bunx playwright test --config test/command-palette.config.js
```

The DOM interaction test additionally runs when `HBL_PALETTE_DOM` points to an
installed `happy-dom` entry module. The optional `HBL_PALETTE_STATIC=1` browser
transport serves actual source documents with Playwright route fulfillment when
local listening is unavailable; it does not verify Bun serving or simulation APIs.
See `docs/reviews/SHE-444.md` for actual evidence and outstanding browser gates.

## Native route accessibility (SHE-630)

`navigation-accessibility.js` runs once in the top-level home, `/routes`, World
and Future Machine documents. Native links own navigation. On `pageshow`, it
focuses a visible h1 (or creates a visible title heading), or restores the exact
href/ordinal opener recorded in the current history entry on Back/Forward. Missing
or hidden openers fall back to the heading. Existing history state is retained;
no model context, URL, seed or clock is changed. A visible directory link provides
an exit, and Escape inside expanded standalone universe navigation closes it and
returns to its toggle. Modal Escape remains owned by the modal.

One persistent polite status exposes `data-destination` and
`data-restored-focus`; the focus target exposes `data-navigation-focus` as
`heading` or `restored`. Focus supplies the destination/control name; the live
text reports readiness without repeating that name. No storage is required by this helper;
portal session storage remains visual-only. History failure falls back to heading focus. No animation,
requestAnimationFrame or view-transition event gates accessibility. Portal retains
visual capture cleanup only. Embedded apps and same-document shell switches are
outside this document-navigation slice.

Checks: `HBL_NAV_DOM=<installed happy-dom/lib/index.js> bun test
 test/navigation-accessibility.test.js` and `bunx playwright test --config
 test/navigation-accessibility.browser.config.js`. `HBL_BUN_BIN` can select the
installed Bun binary; `HBL_STARTUP_SMOKE_PORT` overrides the local test port.
`HBL_NAV_STATIC=1` serves actual source documents via Playwright interception when
listening is blocked; it does not supply model API fixtures or qualify server/model
startup. See the issue review for actual executed evidence and browser blockers.

### Opt-in voice commands (SHE-783)

Open Search / voice or Command-K, then explicitly click Use voice. Recognition
requires `processLocally` support and is configured local-only before starting.
English (`en-US`) needs an installed local language pack and microphone access.
No cloud fallback, model download, audio upload, transcript persistence, analytics
or sharing is introduced. Unsupported or denied recognition offers typed search.
Cancel, close/Escape, visibility loss, pagehide, disposal and a 15-second timeout
abort recognition. Closing clears the query; late callbacks are ignored.

Speech filters the same palette rows as typing. Click a result or press Enter to
confirm; existing native owner guards remain authoritative. The grammar strips
“show/open/find (the)” and maps “why did rent change?” to `why rent`. It never
generates an answer. World has no registered rent WHY producer, so that question
reports missing evidence. Owners may opt in `inspect` actions alongside existing
follow/compare/why/photo actions using `data-palette-context` identity guards.

World shell Search and Command-K now use the shared palette; Search / voice sits
in the mobile-scrollable navigation. Native navigation buttons register as inspect
commands. `school-command.js` adds a normal school button using the first school
in source order, labeled by actual name. It consumes `hblWorldTileSource` like Tile
view and rechecks run, geometry and entity identity before `selectBuilding`.
Missing identity/school, duplicate IDs or changed scope fail closed. No model
result, clock, rule, seed, source record or cross-model mapping changes.

Checks: set `HBL_PALETTE_DOM=/path/to/happy-dom/lib/index.js` when running
`bun test test/voice-navigation.test.js test/command-palette.test.js`; this follows
the existing optional DOM-test convention. Browser suite:
`bunx playwright test --config test/voice-navigation.browser.config.js`.
Mocks exercise lifecycle and handlers, not physical speech accuracy. Actual
results and remaining prerequisites: `docs/reviews/SHE-783.md`.
