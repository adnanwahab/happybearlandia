# Mini Symphony PR hygiene

Each worker owns one issue and exclusive source paths. Per-issue plans, test evidence and unresolved work go in `docs/reviews/<ISSUE-ID>.md` and the PR/workpad. The integration coordinator alone updates `docs/implementation-plan.md` and owns shared integration surfaces. If another active PR reserves an interface, hold dispatch instead of racing.

Do not commit `.mini-symphony-evidence/`, `test-results/`, `playwright-report/` or generated screenshots/traces. Capture browser evidence in a trusted CI job using `actions/upload-artifact@v4` with the exact PR head SHA and test routes. `.github/workflows/core-journeys.yml` already retains browser evidence. Mini Symphony's local before/after screenshots are not automatically CI artifacts: CI must recapture them, or an approved durable store must retain them. Deliberate golden baseline fixtures are allowed.

The trusted `pull_request_target` workflow reads PR file metadata without running untrusted head code. PRs created before **2026-11-17 11:00 UTC** get warnings rather than failed checks (legacy backlog); newer PRs fail for shared-file conflicts or newly committed evidence. Run `node --test scripts/pr-hygiene.test.cjs`.

For old PRs: confirm the worker has finished, preserve existing screenshots and tested SHA in an actual artifact/store, untrack only generated evidence from the PR using trusted Git ownership, rebase and reverify. `.gitignore` does not untrack old files. Never force-push an active worker branch.

After human review require the `PR hygiene` check in GitHub branch protection. This code does not grant merge or deployment authority.
