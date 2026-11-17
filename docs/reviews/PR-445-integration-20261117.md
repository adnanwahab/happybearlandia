# PR445 integration — 17 November 2026

Scope: reconcile the existing Mini Symphony branch with its sprint base and main,
retain all independent work and runtime receipts, and leave acceptance/review
gates intact. No force pushes or deployment. Repairs have separate focused PRs;
this record owns integration only, not shared planning.

## Source reconciliation

- Original head d1aa67ae (contains merged #495/#498); sprint c229a74f; main
  aaa2f558. Parent #445 targets sprint, not main.
- 0fa76f98 merges sprint, retaining storm rescue and isolated feedback storage.
  Syntax verification caught duplicate feedback initialization; 95fdcd19 retains
  one shared handler with the configured disposable directory.
- 19a6bbdd merges main. All main and sprint commits are ancestors afterwards;
  zero main-only commits remain. Scene stats retain both SHE63 Canvas painted
  pick targets and main's renderCallsLastArm diagnostic. Both existing scene
  documentation sections and shared-plan text were mechanically retained during
  the merge; no new shared-plan text was authored.
- Startup acceptance exposed an older sprint integration regression: commit
  204b19812 retained `streetJourney.update` but dropped the SHE604 import,
  initialization and cleanup from 255a4f3b. This caused a ReferenceError on every
  first World frame. Restore the existing mounting contract and pagehide cleanup,
  rather than removing the frame call or swallowing errors. No model rules,
  camera route geometry or authoritative simulation state change.

## Verification

Street journey safety/read-only/cancel/reduced-motion tests: 4 passed,
3024 assertions. Native World startup desktop/mobile remains the integration
regression and is rerun after this restoration; strict pageerror and GPU console
assertions stay enabled. Other counts and CI remain pending until their exact
source revisions are known. Main/sprint scene/queue/export contracts on 19a6bbdd:
46 passed, 3 opt-in browser tests unrun (not passing coverage), 9130 assertions.

Branch protection API returned404 `Branch not protected`; repository rulesets
returned an empty list. No reviews, comments or unresolved threads were recorded
at the initial audit. Absence of enforced policy does not make acceptance pass.
The owner's explicit acceptance gate holds #445 while browser/startup tests or
required integration CI remain red/pending. Keep it draft and do not deploy.
