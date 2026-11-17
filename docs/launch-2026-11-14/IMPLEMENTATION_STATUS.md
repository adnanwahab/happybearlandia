# Implementation status — civic launch candidate

These statuses refer to local source and executed checks, not deployment. P0 has priority; P1/P2 remain held until the whole first-time journey and release gates are accepted.

| Item | Delivered/current evidence | Remaining launch acceptance |
|---|---|---|
| HBL01 | Port of missing sprint Run lifecycle to main being integrated; real worker repeat/timeout/cancel checks | Combined verification evidence below; production parity |
| HBL02 | Exact requested hero/CTA and retained catalog; real keyboard demo start at1440/390/320 passed | Approved release |
| HBL03 | Existing deterministic housing golden and recorded comparison reused | Production golden Month16/24homes visual proof not newly claimed |
| HBL04 | Existing reviewed laws21/22/23/83 preserved; law83 .5→1 real worker browser run and stable baseline verified | Full supported-law browser matrix |
| HBL05 | Existing bounded stable actor receipt reused and rendered natively in Civic | Wider household journeys/representativeness remain unsupported |
| HBL06 | Existing recorded metrics/provenance and model limits retained | Every major metric-to-project causal journey not exhaustively requalified |
| HBL07 | Shared recipe no longer requires map/package network; existing fallbacks preserved | Full Chrome/Safari/Firefox GPU-outage matrix |
| CIVIC01–03 | Native explorer, first action, bounded reviewed amendment and cross-app recipe integration in companion branch | Real browser results and exact companion commit in final report |
| CIVIC04–08 | Existing advisory/revisions/navigation/objections/outcomes reused; no vote or institutional outcome fabricated | Complete proposal-card, human-comment and outcome lifecycle acceptance remains open |
| SHARED01–03 | Strict public versioned recipe, fixed origins, same-seed playback, mismatch failure, synthetic/assumption labels | Full flagship housing-recipe-to-saved-civic-proposal binding is not implemented |
| SHARED04 | No private fields added; privacy/governance protections preserved; bounded API deadline and exact CSP origin | Comprehensive legacy journal consent/auth review remains a release gate |
| SHARED05 | New320px reduced-motion real worker check and landing keyboard tests pass | Full app keyboard/a11y/browser matrix |
| SHARED06 | Existing opt-in instrumentation retained | Requested shared aggregate funnel not implemented; no invented usage statistics |

## Scope discipline

No new agent model, payload expansion, arbitrary legal-text compiler, production deployment, civic vote or automatic merge. Scoped source changes target the current main integration gap. P1 enhancements and all P2 work remain backlog; do not delay reliability/release qualification for them.

## Outreach

20 personalized drafts and20 verified official organization routes prepared in a private0700 directory outside Git; only3 named roles verified.17 individual-recipient selections and4 obfuscated/phone-only channel resolutions require review. All approval states pending; zero sends, calls, form submissions, replies or interviews claimed.

---

## Earlier independent sprint audit (historical evidence)

The following records the earlier checkout and observations named within it.
Later integration evidence above supersedes its implementation-status statements;
production and acceptance gaps remain explicit. Both source reports are retained.

# Implementation status — 2026-11-14

Statuses distinguish local code evidence, GitHub merge records, and live behavior. “Merged” is not the same as “deployed” or “accepted.”

## P0 HappyBearLandia

| Item | Status | Evidence / remaining acceptance |
|---|---|---|
| HBL-01 Run reliability | **Implemented locally; browser gate pending** | `world/render.js` has progress, cancellation, errors, retry and 120-second bound. Fresh focused tests pass after this audit's test-fixture repair. Normal `/world` Playwright journey has not run here; production `/world` run not attempted. PR #305 is merged to the sprint branch, not evidence of production. |
| HBL-02 Primary entry | **Partially met** | Production homepage has a primary `Play Demo` CTA to the flagship and retains the catalog. It does not use the exact proposed copy or “Try the 60-second simulation” label. |
| HBL-03 Recorded divergence | **Implemented in local documented slice; fresh targeted verification passed** | Seed-42, 30-household, 120-month housing case; documented 24 homes complete at Month 16. Current focused Future Machine tests: see `TEST_RESULTS.md`. Hosted replay and browser-visible result remain unverified. |
| HBL-04 Edit/rerun/replay | **Merged upstream; absent from this local branch; production unverified** | PR #316 is merged to `main`. Its description specifies reviewed laws 22/23/83, fixed law 21, and seed-matched actor playback. Local `world/laws` checkout does not have the PR's `BEHAVIOR_PLAYBACK.md` or focused playback/API tests. |
| HBL-05 Human consequences | **Partially implemented upstream; integration unverified** | PR #316 describes up to 12 stable synthetic actors and recorded fields. No production evidence that users can inspect the same actor across branches. |
| HBL-06 WHY evidence | **Partially met in Future Machine** | Existing exact event/project receipts are documented and locally tested. End-to-end evidence for each major HBL/Civic result is not established. |
| HBL-07 Service/graphics fallback | **Existing code and historical tests; launch verification pending** | Local project contains Canvas2D/WebGL fallback work. Current live service-outage and browser-without-GPU acceptance were not run. |

## P0 Civic Synthesis

| Item | Status | Evidence / remaining acceptance |
|---|---|---|
| CIVIC-01 Native HBL integration | **Merged upstream; not live** | PR #120 is merged, but production `/synth` lacks the native behavior explorer. Local checkout predates that PR. Verify approved release SHA and deploy only after human release review. |
| CIVIC-02 One clear Simulate action | **Not met on live page** | Live `/synth` still exposes frozen capture, many scoring controls, budget, and experimental settings above/beside the main action. |
| CIVIC-03 Structured amendment editor | **Not implemented as specified** | Current supported-law sandbox does not compile arbitrary text or bind an edited clause to a proposal revision. Do not imply otherwise. |
| CIVIC-04 Advisory participation | **Existing, non-binding prototype; verified participation unavailable** | Production clearly labels the developer preview non-binding; approved roster is 0/100 and governance is paused. Preserve that state. |
| CIVIC-05 Developer PR navigation | **PR merged; live navigation acceptance pending** | PR #121 is merged upstream. Direct PR route is live; `/votes` reciprocal navigation has not been verified. |
| CIVIC-06 Trustworthy proposal cards | **Partial** | Existing proposal and provenance components exist; this audit did not establish all required sourced tradeoffs, costs, evidence quality, and status labels for every launch proposal. |
| CIVIC-07 Amendments/objections | **Partial** | Local components/tests exist; a complete user journey through saved amendment, concern, and evidence response was not run. |
| CIVIC-08 Outcomes traceability | **Partial** | `/outcomes` is linked in production navigation. A proposal lifecycle with verified versus sample events was not accepted here. |

## Shared, P1, P2

- **SHARED-01:** partial; reciprocal links and safe versioned proposal/run context are unverified.
- **SHARED-02:** HBL recipe sharing exists; cross-app re-open/version mismatch behavior is not established.
- **SHARED-03:** labels for synthetic/advisory/demo content are visible; audit did not establish consistent labeling on every page.
- **SHARED-04:** non-binding and fail-closed governance are visible; full production privacy/security acceptance remains outstanding.
- **SHARED-05:** keyboard, mobile, reduced-motion, and fallback tests exist historically; fresh launch matrix not run.
- **SHARED-06:** HBL homepage's browser-only counters are opt-in; the requested privacy-conscious shared funnel is not established.
- **P1/P2:** remain backlog. Do not start until the P0 native integration/release identity gap is closed.

## Next integrated slice

1. Reconcile PR #120/#121 source files and current released SHA in the Civic checkout.
2. Verify the existing HBL `/api/law-behavior` endpoint and CORS/request boundaries on an approved staging pair.
3. Make one supported law-83 edit, run identical-seed baseline/amended worlds, scrub actual receipts, inspect missing data and provenance.
4. Verify timeout, malformed receipt, stale request, rate limit, unavailable HBL, 390px, keyboard, reduced motion, and no private journal/vote fields.
5. Complete human review and release parity before any production rollout.
