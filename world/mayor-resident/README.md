# Mayor and Resident exercise

Enter from `/world/challenges.html` → private two-player exercise, served at
`/world/mayor-resident/`. This is a bounded authored synthetic budget model,
independent of monthly City and daily Population. No shared identity is inferred.

`model.js` pins the complete inputs and rules at mayor-resident.1.0.0.
`api.js` owns temporary sessions and immutable result receipts. The browser only
submits choices and expected revisions; it never supplies outcomes or inputs.
The matched control preserves the Resident strategy, isolating the policy delta.
See [model description](../../docs/models/mayor-resident.md) for all assumptions.

## API and rights

POST `/api/mayor-resident` with exactly `{}` creates a room and returns its ID
and two unguessable bearer role keys. Creation grants the creator both keys;
this is capability access, not verified personal identity. The creator must give
only the appropriate key to each participant. Possession grants that role's rights.
No public catalog, invitations, social publication, account claims or analytics.

GET `/api/mayor-resident/:id` requires Authorization: Bearer ROLE_KEY and returns
the shared revision/checkpoint/receipt and the caller's role, never either key.
POST accepts `{revision,action,value?}`. Mayor may choose `policy` = `unchanged`
or `voucher`; Resident may choose `strategy` = `usual` or `conserve`, then `run`.
Unknown fields, missing choices, unsupported actions, wrong roles and stale
revisions fail explicitly. Running seals both choices and records a receipt.
Both roles can request `switch`; the other must refresh and accept. Any choice
change clears pending switch requests. Switching preserves the receipt and inputs.
Either role can DELETE; all future reads fail. Copied data cannot be recalled.

Responses use no-store. Keys are not placed in URLs or browser persistence.
No access survives one hour or process restart. Each process holds at most 100
rooms. This is a single-process local hosting slice; multi-replica routing,
durable sessions and production admission/rate limits require separate review.
No deployment or production configuration is included.

Run `bun test test/mayor-resident.test.js` and
`bunx playwright test --config test/mayor-resident.browser.config.js`.
