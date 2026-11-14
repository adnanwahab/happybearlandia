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
