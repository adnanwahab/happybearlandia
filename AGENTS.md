# HappyBearLandia engineering instructions

Build reliable, maintainable features that work through the application’s normal entry points. Finish an integrated, tested slice before broadening a substantial change. Apply implementation instructions when the user asks for implementation. For reviews and design discussions, deliver the requested analysis.

## Read before changing code

- Read [the product design](docs/design.md) and [the implementation plan](docs/implementation-plan.md) for the affected feature. Read `docs/architecture.md` when present and check the nearest module documentation and any more specific agent instructions.
- Inspect the code, tests, contracts, and dependencies. Identify what works, what is partial, and what is missing. Use the code as evidence of current behavior and the design as the target. Investigate discrepancies and record material decisions.
- Discover actual files, routes, APIs, and commands in the checkout. Reuse established interfaces and infrastructure where they satisfy the task.

## Plan and implement

- For substantial features, record the next end-to-end slice, prerequisites, acceptance criteria, and material risks. The coordinating agent owns `docs/implementation-plan.md` and other shared roadmap files. Issue workers record their plan, owned files, acceptance evidence and unresolved work in `docs/reviews/<ISSUE-ID>.md`; edit shared planning files only when explicitly assigned their ownership. Break the work into independently verifiable tasks.
- Carry implementation requests through code, integration, verification, and review. Follow existing conventions, preserve working behavior and compatible data contracts, and keep changes small. Update affected interface documentation and add tests for meaningful behavior and regressions.
- Preserve unrelated changes. Keep credentials and sensitive data out of code, fixtures, and output. Obtain explicit authorization for deployment and production data changes. Make routine reversible decisions locally and ask when a consequential choice cannot be resolved from the available evidence.

## Parallel work

When independent implementation tasks justify delegation and the environment permits it, use up to six agents within its concurrency limit. Map dependencies first. Give each agent an isolated worktree or branch, owned files and interfaces, acceptance criteria, and verification commands. Assign shared interfaces to one owner and integrate completed work in dependency order. The coordinating agent owns architecture, integration, and the final verification.

## Parallel PR hygiene

- `mini/*` and `symphony/*` workers must not edit `docs/implementation-plan.md`; keep issue records in `docs/reviews/<ISSUE-ID>.md`.
- Reserve shared source interfaces and files to one owner. Park work on overlapping active PRs until reconciliation.
- Do not commit generated `.mini-symphony-evidence/`, `test-results/`, `playwright-report/` screenshots or traces. Use trusted CI artifacts tied to tested head SHA. Reviewed golden fixtures are distinct.
- See [PR hygiene](docs/pr-hygiene.md). Human review, branch protection, and release authorization remain separate.

## Simulation requirements

- Maintain the [ODD model inventory and descriptions](docs/models/README.md). Every new agent-based social model needs all seven ODD elements. Update affected descriptions in the same change as model rules, assumptions, inputs or scheduling. Before approval, reviewers must compare the description and linked subsystem contracts against executable code and record paths checked, discrepancies resolved and verification evidence in the PR. State assumptions beside the mechanism that uses them.

- Distinguish observations, synthetic assumptions, modeled results, and narrative interpretation. Record data sources, model and rules versions, scenario inputs, and random seeds.
- Preserve event provenance and causal dependencies. Test deterministic replay and seed-matched comparisons where relevant. Verify invariants, transitions, missing observations, and boundary cases.
- Reuse the same versioned run data across views. Explicitly map entity identities and time across models. Document uncertainty and limitations alongside the relevant result.

## Verify and report

- Review the diff against the request. Run the repository’s relevant tests, existing lint and type checks where available, and integration tests after combining independent changes. Verify important failure paths and fix introduced regressions.
- Skip Playwright when the change does not affect browser behavior, when the user asks to skip it, or when browser or local server setup blocks the run. For browser-facing changes, use an available browser smoke check or focused integration tests and report what was verified and what remains unverified. If the user explicitly requires Playwright and setup blocks it, report the blocker.
- The coordinator updates the implementation plan with actual status, acceptance evidence, unresolved work, and commit or PR references. Issue workers update their per-issue record instead. If a large scope remains, leave a working increment and document its dependencies and limits.
- Report delivered behavior, changed files, actual check results, material architectural decisions, limitations, and the next action when work remains.
