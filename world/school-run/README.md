# School-Run Rush Hour

Open `/world/challenges.html`, then **Play School-Run Rush Hour**. This independent
local authored toy does not change the six illustrative missions or write their
completion storage. `model.js` owns the pinned fixture, executor and replay;
`ui.js` mounts its own section and accepts an injectable asynchronous source loader
for unavailable/cancelled integration checks. No service, map or real school data
is needed. No source replacement is synthesized after a load failure.

See [the ODD description](../../docs/models/school-run.md) for mechanisms,
assumptions and invariants. Version/source/seed and full trip outcomes are retained
in deeply frozen session checkpoints. They are lost on reload; no persistent
sharing or Population/City mapping is claimed. The existing six-mission progress
counter deliberately excludes this separate toy. The UI reports synthetic model
observations, never measured real traffic. The introductory story is scripted
flavor; no computed pupil feelings or school facts are inferred.

Run `bun test test/school-run.test.js test/challenge-contract.test.js test/challenge-ui.test.js`.
Browser navigation and unavailable/cancelled source checks:
`bunx playwright test --config test/school-run.browser.config.js`.
Use `HBL_FM_PORT` to isolate the local server as in the inherited browser config.
