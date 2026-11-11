# Compatibility track

Baseline: 1b19358. Owned slice adds network-free transport boundary regressions against the actual provider transport. No shared integration callsite changes required: `bun test test/backlog-provider-compatibility.test.js test/world-edit-providers.test.js`.

Ready-to-apply status: tickets 63 and 64 remain Partial. Existing adapters, validation, privacy, timeout and concurrency tests pass; mocked transport contracts do not establish live vendor compatibility. Live validation requires explicit paid-call authorization and configured credentials and remains pending. No provider calls made.

Ticket 191 remains Partial. Host cache contains Chromium 1243 and no Firefox/WebKit. Safari is distinct from WebKit. This worktree has no node_modules; browser execution has not been verified in this slice. Coordinator should run existing build-world.e2e.js using its installed dependencies and isolated ports, then run available Firefox/WebKit engines where installed. Do not claim browser acceptance from these unit checks.

No empirical model calibration claims, model changes or new mappings. Original checkout untouched. No deployment, pushes, package installs or paid calls.

## Follow-up evidence

INTEGRATION-READY tests/harness; EXTERNAL-BLOCKED live-provider and full browser matrix acceptance.

Added operator-only `world/decision/backlog-provider-compatibility/live.js`. Default returns skipped with zero calls. Authorization requires `HBL_AUTHORIZE_PAID_VALIDATION=I_AUTHORIZE_ONE_PAID_REQUEST`, `HBL_LIVE_PROVIDER=openai|anthropic|gemini` plus that adapter's existing API_KEY and MODEL variables. Run `bun world/decision/backlog-provider-compatibility/live.js` only after operator authorization. Budget is one request, no retries, ten-second deadline plus abort; errors never print vendor details or credentials. It generates only a synthetic proposal and never applies it. No live calls were made. Schema success remains subject to independent existing validator.

Actual checks: 23 unit tests passed (102 assertions), including invalid JSON, 401/403/429/500/503 redaction, cancellation/redirect transport boundaries and zero-default live harness. Existing vendor schema/privacy/refusal/timeout regressions included.

Installed Chromium 1243: real preview/reject browser journey passed, preserving serialized currentInput; screenshot `/private/tmp/hbl-compatibility-chromium.png`. Dedicated config uses port 3193 and `/private/tmp/hbl-compatibility-store`. Invocation: `HBL_COMPAT_PLAYWRIGHT=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.js bun /Users/wahabma/happybearlandia/node_modules/@playwright/test/cli.js test --config test/e2e/backlog-provider-compatibility.config.js`. Override HBL_COMPAT_BROWSER for an installed engine. Shared dependencies read only; no installs. Firefox/WebKit absent, Safari not tested. Chromium local demo success is not evidence of remote provider success. No shared production integration required.
