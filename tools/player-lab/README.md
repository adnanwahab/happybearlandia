# AI Player Testing Lab

These bounded scripted players use Playwright against the application's public
Riverside Bakery controls. They inspect the closure, choose an intervention and
reopen the shared future. Alternatives test the last successful month, a late
intervention and an unsupported recipe. This is a regression and broken-state
lab. It cannot infer confusion, enjoyment, or replace human sessions SHE-29/SHE-62.
No language model, player telemetry or dispatch service is used.

Install repository dependencies and Playwright Chromium, then start the normal
application server in another terminal:

```sh
PORT=3100 HBL_WORLD_DB_PATH=:memory: bun --no-env-file run server.js
bun tools/player-lab/run.js run 2911 /tmp/hbl-player-lab
bun tools/player-lab/run.js replay /tmp/hbl-player-lab/first-play-2911.json /tmp/hbl-player-replay
bun test test/player-lab.test.js test/bakery-journey.test.js test/bakery-scenario.test.js
```

`HBL_PLAYER_LAB_URL` overrides the local URL. The existing
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override is supported. Each policy runs in
a fresh context with fixed locale/time zone. Use a separate output directory per
batch: artifacts with identical strategy/seed names are overwritten.

JSON records contain ordered actions and observations, failures, final state,
policy seed, model version/seed and source fingerprint (HEAD plus tracked diff
and untracked lab sources). The seed selects timing; bakery-v1 has fixed model
inputs and no random draws. Traces contain browser snapshots and screenshots.
Replay reruns the policy, compares its recorded observations, and refuses a source
fingerprint mismatch. A failed run or divergent replay exits nonzero. Model state
is represented by visible evidence and the share recipe; this is not a Population
or CityState checkpoint. Navigation failures can have a null final observation.
Timeout messages may differ on replay even for the same underlying fault.

Preview a failed run's Linear issue, then explicitly submit it:

```sh
bun tools/player-lab/triage.js /tmp/hbl-player-lab/first-play-2911.json
bun tools/player-lab/triage.js /tmp/hbl-player-lab/first-play-2911.json TEAM_UUID --submit
```

Submission requires `LINEAR_API_KEY` in the environment. It resolves a team state
of type `triage`, refuses a backlog fallback, and creates an unassigned issue
without labels, approval or dispatch. It makes no remote change during lab runs
or preview. A local exclusive `.triage.json` receipt blocks repeat submission.
If submission fails, inspect Linear before removing a pending receipt; an ambiguous
network failure may already have created an issue. Equivalent findings from other
run files still require human deduplication. Review run artifacts before sharing;
use the local synthetic scenario rather than authenticated production sessions.

Verification in SHE-187: unit/contract tests run locally; Chromium launch is
blocked by macOS sandbox MachPortRendezvous permission denial. Browser completion
and live Linear submission remain unverified. Do not treat the scripted suite as
completed human acceptance or a passing browser run.

Package shortcuts: `bun run --bun test:player-lab`, `bun run --bun player-lab run 2911 /tmp/hbl-player-lab` (or the direct commands above). The `--bun` option
avoids this checkout's uninitialized local Bun package shim.
