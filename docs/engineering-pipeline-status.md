# Engineering pipeline status

Authoritative branch: sprint/one-city-two-futures-20261111; last accepted baseline: 779c3600bf67081da88f52b9a635961759a2614d.

- READY execution pool: U01, U02, U03, U05, U08, R13, R14, R15
- Dispatchable now (capacity three): None
- Active assignments: None
- Verification queue: U16 (evidence-worker), NB-district-candidate (backlog-triage), NB-grid-fixture (backlog-triage)
- Blocked/unconfigured: U06, U14, U15, U17
- Independently integrated: U10 (receipts-worker)
- Test failures: None recorded
- Next executable action: Integrate verification queue

## Accepted evidence

- U10 → 779c3600bf67081da88f52b9a635961759a2614d; 2 independently executed checks; Reviewed the one-file diff against U10. Actual monthly City histories test repeated selection and historical receipt labels; no renderer or simulation changes. No new visual behavior claimed.

State is durable in the Git common directory under demo-pipeline/interactive.json. The interactive bridge shares the runner lock. Historical backlog VERIFIED is baseline evidence, not a test executed by this run. Tasks lacking reviewed execution metadata stay blocked rather than being dispatched speculatively. No main merge or deployment is implemented.
