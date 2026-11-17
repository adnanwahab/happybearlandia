# City Time Machine

`panel.js` reads `/api/world-history` through `response.js` and displays recorded
OpenStreetMap attic geometry independently of the live population clock. Public
historical sources can be unavailable; a failed historical request never falls
back to current geometry or fabricated historical people.

The preview explicitly describes initial, loading, failed and empty geometry
states. A successful snapshot remains visible if a later load fails, with that
fact stated in the status. Load date retries failed requests. Browser requests
have a 40-second deadline, slightly beyond the server's two 18-second upstream
attempts. Closing/destroying the panel cancels snapshot and object-history reads;
selecting a different object also cancels the previous history read. Date inputs
are validated before issuing requests. Escape dismisses the open panel even if
an asynchronous disabled control has lost focus.

Verify with:

```sh
bun test test/temporal-city.test.js test/temporal-response.test.js test/temporal-preview.test.js test/temporal-fork.test.js
bunx playwright test test/e2e/temporal-recovery.e2e.js
```

The focused browser test uses mocked source responses to verify recovery,
selection, object-version controls, comparison pinning, radius changes and
cancellation. It does not assert public Overpass uptime. The historical policy
fork journey is covered separately by `test/e2e/temporal-city.e2e.js`.
