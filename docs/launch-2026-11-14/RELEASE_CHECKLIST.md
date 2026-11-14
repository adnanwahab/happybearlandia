# Release checklist — NOT authorized for production

- [ ] Identify approved repository, release commit/image digest and serving SHA for both apps. HBL healthbuild unknown; Civic versioncommit null at audit.
- [ ] Reconcile HBL PR305 sprint lifecycle with main PR316 native API and Civic PR120/121.
- [ ] Review both focused implementation branches and actual CI/browser evidence.
- [ ] Verify Fly configuration: HBL app happybearlandia; Civic config must match actually targeted civic-synthesis, not assume historical dear-congress target.
- [ ] Fix build identity in approved build pipeline and verify runtime value; do not substitute an unverified SHA.
- [ ] Deploy approved staging pair, verify exact receipt/version/CORS, API deadline, retry, denied origins/rate caps, privacy and graphics fallback.
- [ ] Preserve server-side journal privacy/consent, ballot authorization, demo/pilot separation and governance pause/roster/exposure rules.
- [ ] Record existing image/config and tested rollback procedure. No DB migration in this slice.
- [ ] Human code review, merge approval and explicit production-release authorization.
- [ ] Only after qualification: authorize launch promotion and individually reviewed outreach sending.

No production deployment, protected-branch merge, vote or outbound message was performed.
