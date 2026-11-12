# SHE-58 accessibility audit — 2026-11-12

Branch: `mini/SHE-58`. No PR created, deployment or merge performed.
Status: **partial; browser acceptance blocked; critical contrast correction pending ownership integration**.

## Baseline and scope

Read product design, implementation plan, World Visual Pass interfaces and first-run repair notes, Future Machine UI documentation, primary panel manager/accessibility/guide styles and tests. No architecture.md exists. Source audit covers World controls, guide, inspector, cycle comparison, experiment and activity sheets, plus Future Machine setup, timeline, metrics and evidence presentation. This is not a whole-application conformance claim; House, Business, FlowMap and other linked experiences require separate route audits.

SHE-19 (HBL-W1-014) remains In Review in Linear; completion is not established. Existing visual-pass work already implements nonmodal navigation, inert suppressed sheets, Escape dismissal, trigger restoration, live status text, static reduced-motion camera framing and 44px minimum control heights. Reuse it. The original accessibility browser smoke checks viewport overflow and a media query but does not establish contrast, target geometry, narration equivalence or actual reduced animation.

This slice owns only this report, `test/e2e/she-58-accessibility.e2e.js` and `test/she-58.browser.config.js`. Existing interface notes reserve shared integration/styles to their owners. No simulation, seed, recorded result, disclaimer or runtime code changed.

## Findings against WCAG 2.2

| Area | Source observation | Assessment / remaining verification |
| --- | --- | --- |
| Text contrast (1.4.3 AA) | World quick-demo button uses `--bg:#f4f1ea` on `--accent:#2f6fd6` in light mode, at ordinary 14px bold text. | **Fails: 4.26:1**, below 4.5:1. Assign an opaque white button foreground (about 4.81:1) or darken the button; preserve dark-mode contrast. `world/first-run-guide.css` belongs to shared integration, so correction requires that owner's integration. No claim this critical finding is fixed. |
| Other contrast (1.4.3, 1.4.11) | World muted text #6b6a64 on white: 5.43:1; dark muted #9a9993 on #18191e: 6.14:1. Future Machine muted #adbed0 on #101c2b: 9.04:1; focus #83ceff on #101c2b: 10.01:1. | Token calculations only. World panels are translucent over a scene; these samples do not certify composited text, borders, focus rings or every state. |
| Keyboard/focus (2.1.1, 2.4.3, 2.4.7, 2.4.11) | Panel manager focuses opened sheets and suppresses siblings with inert; Escape closes. Native controls and focus-visible styles exist. | Unit regressions pass. A trigger inside a suppressed guide cannot receive focus after closing the inspector; manager intentionally skips inert sources. Browser journey must establish a useful fallback rather than relying on body focus. |
| Target size (2.5.8 AA) | World primary sheet buttons/selects/inputs have 44px minimum height; Future Machine buttons have 46px. | Height alone does not establish 24×24 CSS px or spacing exceptions. Inline links, summary/disclosures, compact controls, clipping and overlaps need geometry checks. 44×44 is the stronger 2.5.5 AAA target, not AA's minimum. |
| Motion (2.3.3 AAA; 2.2.2 AA where applicable) | World listens to live reduced-motion changes and frames a resident once. Sheet CSS removes transitions/animations. Future Machine focus reads current preference, while visual effects capture it when created. | World unit behavior passes. Future Machine preference changes during existing effects need browser verification; an OS media-query match alone proves nothing about animation. Pause/stop controls need reachable browser checks. |
| Narration alternatives (1.2.1/1.2.2 where applicable; 1.3.1) | Guide shows observation, numeric matched results, source/seed and live status. Future Machine captions, metrics and evidence are textual. | Existing text alternatives retained. No verified inventory of every audio/narration path or equivalent transcript; no screen-reader listening session performed. |
| Non-motion progress (4.1.3) | Guide uses polite status with actual stage/fraction or indeterminate text. Future Machine documents indeterminate progress unless a measured fraction exists, plus error text. | Source and unit evidence only; browser announcement timing and duplicate announcements remain unverified. Never manufacture completion estimates. |

Ratios use sRGB linearization and `(lighter luminance + .05)/(darker luminance + .05)`, no rounding before comparison. Static token samples are observations from source, not rendered measurements or model results.

## Added browser audit

The new test uses the real synthetic World route and real comparison worker under reduced motion. It activates the demo with Enter, checks completion/status/provenance text, opens the resident inspector, then examines all five registered primary sheets for focus, Tab visibility and Escape restoration to a stable toolbar trigger. It records rendered control sizes/colors/text and mobile screenshots in `/tmp/hbl-she-58`. Direct manager opening tests sheet infrastructure; it does **not** establish feature content loading or a normal-entry journey for cycle, experiment and activity. Measurements are candidates for review, not automatic conformance assertions. This test has not executed past server startup here.

## Actual verification

- `bun test test/world-visual-accessibility.test.js test/world-visual-panels.test.js test/world-visual-camera.test.js test/future-machine-ui.test.js`: **22 passed, 1 skipped, 0 failed; 130 assertions**. Browser component case skipped by its existing environment gate.
- `HBL_VISUAL_PASS_PORT=39958 bunx playwright test --config test/she-58.browser.config.js`: **blocked before tests**, Bun server listen EADDRINUSE.
- Same command with port `41987`: identical startup failure.
- `HBL_FM_BROWSER=1 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test test/future-machine-ui.test.js`: **6 passed, 1 failed**, browser case fails creating `Bun.serve({port:0})` with EADDRINUSE. Even ephemeral server startup is unavailable in this execution environment. No existing server was stopped.
- Reused the available parent node_modules through a local ignored symlink; no dependency manifest or lockfile changed.
- No screenshots generated; no browser, assistive technology or full WCAG pass claimed.

## Completion prerequisites

Integrate the quick-demo contrast correction with the shared stylesheet owner and verify both themes. Run the added browser test where local server binding works; inspect artifacts, resolve failures and add normal-entry coverage for loaded cycle/experiment/activity and Future Machine WHY/share/split/time controls. Verify focus fallback, contrast over actual backgrounds, zoom/reflow, target geometry and live preference changes. Complete narration inventory and keyboard/screen-reader review with SHE-19 before closing SHE-58.
