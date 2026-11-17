# Civic engagement launch audit — 2026-11-14

## Scope and evidence boundary

This audit covers the local HappyBearLandia checkout at `00e974bdecf65e4a94b99eb34529574bfaa77e30`, the readable local Dear Congress checkout at `174187454778d8130c19824fd93064c4f7260741`, four GitHub PR records, and read-only pages on both production hosts. The local checkouts have unrelated uncommitted work; it was preserved. The Dear Congress checkout is outside this workspace's writable roots. No merge, release, deployment, production write, vote, or outreach message occurred.

## What works or is present

- **HBL first entry:** production homepage exposes a prominent `Play Demo` link to `/world/future-machine.html?demo=1`, followed by a broader catalog. It says the city is synthetic. This is discoverable, though copy differs from the requested “Try the 60-second simulation.”
- **HBL paired future:** the local Future Machine uses the monthly City authority, seed/model/run provenance, shared Month 0, a 120-month horizon, and records a 24-home project at Month 16 in the documented seed-42 golden case. Existing unit/API/browser suites cover replay, evidence, share, and fallbacks. Local documentation labels replay as manifest recomputation, not independent checkpoint equivalence.
- **HBL `/world` run lifecycle:** local `world/render.js` now displays Running/Completed/Failed/Cancelled, reports worker progress, provides cancellation and retry, and enforces a 120-second deadline. The implementation plan records the change and its still-missing browser acceptance.
- **GitHub merge records:** HBL PR #305 is merged to `sprint/one-city-two-futures-20261111`; HBL PR #316 is merged to `main`; Dear Congress PRs #120 and #121 are merged to `main`. A PR merge alone does not show that the associated change is in the deployed image.
- **Civic repository voting:** production `/vote/happybearlandia?view=prs` loads four open PR entries and clearly labels responses non-binding. It reports governance paused, 0/100 approved accounts, quorum 10, 24-hour exposure, no allowed bases, and no required checks configured. Entries on a non-allowlisted sprint base are blocked; one item is a draft. This is an intentional fail-closed state.

## Critical gaps and discrepancies

- **Native HBL-to-Civic experience is not live.** Production `/synth` at inspection time showed the frozen package-capture comparison and generic synthesis controls, but no native law-behavior editor, actor timeline, or recorded paired receipt. Its footer reported `Build unknown` and a production build timestamp earlier than PR #120's merge. Therefore PR #120 is not verified as deployed.
- **The current Civic checkout predates PR #120.** It is at `174187454778d8130c19824fd93064c4f7260741`; it does not contain `src/client/LawBehaviorExplorer.tsx`, `docs/live-law-behavior-loop.md`, or merge commit `61e285a56dd4c5d2b94175c30c3154adccf3aafd`. The local checkout also predates the PR #121 merge. This checkout cannot serve as evidence for the merged PR implementation.
- **HBL law-behavior API parity is unknown.** PR #316 describes `POST /api/law-behavior`, but no live request was made and the current HBL local branch lacks the PR's focused API/playback tests. The Civic `/synth` page does not prove API availability.
- **Cross-app context is incomplete/unverified.** No acceptance evidence shows proposal ID/revision, law parameter, seed, and model version survive between the two applications. The supported model sandbox is explicitly separate from the frozen legal text; arbitrary legal prose is not compiled into model rules.
- **Launch quality remains unverified on the production journey.** The landing page is visible, but no live simulation was started. There is no live baseline for request duration, deterministic replay, dependency outage, mobile/reduced-motion behavior, or native GPU fallback in this audit.
- **Release identity is incomplete.** Civic `/version` renders `Build unknown`. Its checked-in `fly.toml` currently names `civic-synthesis`, but the approved release tag, image SHA, and serving SHA have not been reconciled. HBL's `fly.toml` names `happybearlandia`; that is configuration evidence, not proof of serving version.

## Current recommendation

Do not promote the connected launch as an integrated civic simulation yet. Keep participation advisory and governance paused. First reconcile the approved source/tag/build on both services, confirm HBL API availability, deploy the already-merged Civic #120/#121 only through the repository's human-reviewed release process, then run the cross-origin acceptance path and outage/privacy tests. Keep incomplete features clearly marked as unavailable.

## References

- [HBL PR #305](https://github.com/adnanwahab/happybearlandia/pull/305), [HBL PR #316](https://github.com/adnanwahab/happybearlandia/pull/316)
- [Dear Congress PR #120](https://github.com/adnanwahab/dear_congress/pull/120), [Dear Congress PR #121](https://github.com/adnanwahab/dear_congress/pull/121)
- [HBL production homepage](https://happybearlandia.fly.dev/), [Civic production simulation](https://civic-synthesis.fly.dev/synth), [Civic developer preview](https://civic-synthesis.fly.dev/vote/happybearlandia?view=prs)
- Local design, release, and implementation constraints: `docs/design.md`, `docs/implementation-plan.md`, `docs/future-machine.md`, `docs/release-checklist.md`, `docs/release-operations.md`.
