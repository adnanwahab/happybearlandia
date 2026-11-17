# Playfulness v1 — local dry run

Entry: `/world`, World controls → Optional playfulness study. Ships hidden and
**disabled** (`#playfulness[data-enabled=false]`). Changing that literal is a local
review/testing operation here; live activation requires owner authorization.
Disable it again to erase participation on the next World load. Existing open
pages require reload; this is not a remote instantaneous kill service.

After explicit unchecked consent, crypto randomness assigns plain versus playful
static inspection wording 50/50. It never changes model randomness or results.
No animation, sound, rewards, identity, networking, telemetry API or sharing.
The same task and controls appear in both arms. Only wording differs.

`hbl.playfulness.v1` stores version, arm, latest UTC day and bounded outcome counters
in localStorage. No person/session identifier, URL, source entity, free text or
individual event history is retained. A shared browser is one enrollment; clearing
storage or re-enrolling restarts it. Return visits mean at least one load on a later
UTC day, not verified human retention. Task and meaningful replay are explicit
self-reports, not verified model executions or evidence of thoughtful exploration.
Definitions and eligible denominators are shown before consent and in the local
summary. Zero task completers means replay denominator zero (undefined rate).

Unchecking erases persisted data. The current page retains only arm plus withdrawal
1/1 in memory; leaving loses that observation too. Cross-tab deletion prevents
stale writes. There is no central aggregate, export or population opt-out estimate.
A future reviewed aggregate design must solve deletion, missing withdrawals,
eligibility, consent bias and sample-size privacy before making any causal claim.
Storage denial leaves normal exploration available and measurements unavailable.
Malformed/version-mismatched counters are erased. No modeled result is created;
existing engine provenance and versioned runs remain authoritative and untouched.

Checks: `bun test test/playfulness.test.js test/onboarding-experiment.test.js`.
Browser dry run: `bunx playwright test --config test/playfulness.browser.config.js`.
The browser test enables the control only in an intercepted local response.
