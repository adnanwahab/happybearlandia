# Product workflows: tickets 197 and 198

Status: INTEGRATION-READY (2026-11-11). Neither historical ticket is marked end-to-end implemented. Existing browser-local behavior is preserved. No external analytics, CRM, paid calls or production tracking is activated.

## Delivered slice and acceptance

- 197: durable first-party allowlisted events (`studio_opened`, `comparison_saved`, `brief_exported`), consent/review required, local receipt. Store/HTTP mechanics verified; application event wiring remains coordinator-owned.
- 198: reviewed pilot brief (1–4000 characters), explicit local-storage consent, durable local-only receipt. Store/HTTP mechanics verified; normal application review form remains coordinator-owned.
- Both: schema version, timestamps, local-only status, trusted owner isolation, atomic SQLite transactions, per-owner idempotency/conflict detection, restart persistence, capacity bound (default 1000), 30-day retention, owner export/deletion, sanitized storage errors. SQLite is existing Bun infrastructure. Unknown fields rejected; body stream capped at 16KiB. No arbitrary metadata or contact collection.

## Integration contract (coordinator owns shared files)

Import `createProductWorkflowStore` and `createProductWorkflowHandler` from `world/decision/backlog-product-workflows/index.js` into server composition. Initialize exactly once:

```js
const workflowStore = createProductWorkflowStore({ directory: PRIVATE_WORKFLOW_DIRECTORY });
const workflowHandler = createProductWorkflowHandler({
  store: workflowStore,
  authorize: async request => {
    // Reuse the host's verified session/local capability and CSRF policy.
    // Return a stable opaque owner token matching /^[A-Za-z0-9_-]{1,80}$/,
    // or null. Never trust a request body, query or unauthenticated header as owner.
    return verifiedWorkflowOwner(request);
  },
});
```

In the existing fetch router, before generic static handling: `const workflowResponse = await workflowHandler(request); if (workflowResponse) return workflowResponse;`. `verifiedWorkflowOwner` and `PRIVATE_WORKFLOW_DIRECTORY` above are explicit integration prerequisites, not existing exported symbols. Do not mount until owner authorization and CSRF are implemented using actual host infrastructure. Handler deliberately has no permissive authorization default.

Exact route `/api/product-workflows`: POST `{key,kind:'pilot',brief,consent:true,reviewed:true}` or `{key,kind:'event',event,consent:true,reviewed:true}`; GET exports only current owner; DELETE deletes only current owner. POST returns 200 with `schemaVersion:'product-workflow.v1'`, stable id, payload, createdAt/expiresAt, consent/review, `status:'stored-locally'`, `externalSubmission:false`. Reusing a key with changed payload returns409. Validation400, auth401, size413, content type415, capacity429, storage503. All responses no-store. Unmatched route returns null. No record owner or idempotency fingerprint exposed.

UI must review the exact payload before POST and use an explicit unchecked consent control. Retain key for retries; generate a new key after editing payload. Show `Stored locally; not submitted externally` only after200. Preserve draft on error, show actionable failure, offer export and delete. Do not silently collect initial page events. Render brief as text, never HTML. Withdrawal deletes records through DELETE; toggling consent alone does not erase prior records.

Retention runs on operations; host may call `workflowStore.purge()` at startup and periodically. No background timer is installed by module. Logical deletion/expiry is not forensic secure erasure of SQLite pages/backups. Host must define private-volume backup retention. No multi-region deployment or external submission guarantee. SQLite file0600/private directory0700; use a dedicated private directory outside served roots. Close store on host shutdown.

## Evidence and remaining tests

`bun test test/backlog-product-workflows.test.js`: 3 passed, 0 failed, 25 assertions, including an actual ephemeral loopback Bun HTTP server and temporary SQLite disk, restart, concurrent duplicate requests, invalid JSON, oversized stream, conflict, consent/review, owner isolation, capacity, expiry boundary, export/delete, corrupt disk and sanitized503. Loopback binding required sandbox escalation; restricted run passed disk tests but could not bind server.

Manual browser harness: `HBL_PRODUCT_TEST_PORT=39981 bun world/decision/backlog-product-workflows/harness.js`; open loopback root. Optional `HBL_PRODUCT_TEST_STORE` allows restart checks on the same private temporary directory. Harness is strictly local, uses a synthetic review owner and must never be mounted publicly. Browser acceptance/screenshots have NOT been performed. After real mounting, verify checked/unchecked consent, draft retention on503, retry duplicate, export/deletion, restart and owner separation through normal application entrypoint. Host authorization/CSRF integration remains a prerequisite, not a claimed passing test.

## Ready-to-apply global status

197 Partial → Partial, durable local event adapter verified; normal event wiring and host authorization pending. 198 Partial → Partial, durable reviewed local pilot adapter verified; normal form wiring and host authorization pending. External analytics/CRM intentionally excluded. Coordinator should keep both partial until integrated browser acceptance is recorded against a source revision.

## Follow-up: reusable UI and real browser proof

`ui.js` exports `mountProductWorkflows(container,{endpoint='/api/product-workflows',headers={},fetch=globalThis.fetch,onExport}) -> {dispose()}`. Minimal Studio hook: import this function, mount into the existing local-workflow panel when opened, call `dispose()` on panel teardown. Pass same-origin endpoint plus the host's actual CSRF headers; cookies use same-origin credentials. Do not pass owner from the client. No automatic event hooks are installed: event selection is user reviewed and consented. `onExport(body)` can connect to the existing download infrastructure; records also display as readable JSON. Default does not download or send elsewhere. Endpoint origin is restricted to current origin. Disposer aborts pending fetches and removes the mounted section.

Pilot Save remains disabled until exact draft review, review confirmation and unchecked-by-default consent. Editing invalidates pilot review/key; event changes invalidate event review/key. Retries preserve key. Revoking consent disables submission and clears review confirmations; rechecking alone cannot submit. Consent stays checked through retry/success in the current mount, resets on reopen, and deletion resets consent/review. Reopen exports persisted server records without reconsenting to a new write. Errors retain draft and do not claim success. A plain-text review/JSON result prevents supplied HTML from becoming markup. Host remains responsible for timeout policy and its normal panel lifecycle.

Actual browser command: `bunx playwright test --config test/backlog-product-workflows.browser.config.js`: **2 passed (14.4s)** on the final UI revision before commit. Real isolated Bun loopback endpoint and SQLite directory, one Chromium worker. Covers review-before-save, consent, event opt-in, duplicate retry producing one record, page reload persistence, export/deletion, no foreign requests, literal HTML display, consent withdrawal/recheck, malformed JSON400, foreign Origin401, method405, oversized stream413, content type415. Storage503 is injected only for the UI failure-state check; actual closed-store503 is separately exercised by endpoint tests. Restart persistence remains a real disk unit test, not a browser server restart claim. Existing disk/HTTP suite: **3 passed, 25 assertions**.

Screenshots (local artifacts, not committed): `/tmp/hbl-product-workflow-proof/backlog-product-workflows.-60059-export-deletion-and-failure/consented-local-receipt.png` and `storage-error-retained-draft.png`. Both reflect the reusable mount; receipt and final error layout visually inspected. Browser config allows `HBL_PRODUCT_TEST_PORT` and `HBL_PRODUCT_ARTIFACTS` overrides and allocates a fresh isolated test store. Dependencies reused via uncommitted node_modules symlink to installed source dependencies; no package/lock changes.

The harness's `x-local-review` synthetic owner is **not authentication**. Its loopback-only Origin check establishes local mechanics, not hosted security. Hosted owner resolution/CSRF, Studio route mounting and browser acceptance through that normal route remain coordinator integration prerequisites. Tickets197/198 stay Partial until those checks pass. This follow-up is INTEGRATION-READY, not a production or external CRM completion claim.
