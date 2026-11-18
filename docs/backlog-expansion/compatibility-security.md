# Local capability independent audit

INTEGRATION-READY audit tests; security acceptance requires coordinator fixes below. Owned files only: this document and test/backlog-local-capability-audit.test.js. No shared source edits.

Read coordinator helper and server wiring in backlog-integration worktree. Source changed during inspection from memory sessions to HMAC-signed cookies. Tested latest helper SHA256 0e06f1dada88a8af17df1737dd9c17abec94e6037976e4615f2cf778d20f5fbc. Tests use read-only coordinator source by default; after integration set HBL_CAPABILITY_AUDIT_SOURCE to absolute integrated helper path. Run `bun test test/backlog-local-capability-audit.test.js`.

Actual result: 8 passed, 35 assertions. Verified localhost, IPv4 and IPv6 hostname plus separately verified peer; remote names and forwarded-header-only spoof rejected; exact bootstrap Origin, cross-site and method checks; cookie flags, no-store and body privacy; tampering and expiry rejection; no client owner header trust. Helper recreation with matching secret preserves identity, while a fresh secret rejects the prior cookie. Thus original memory-session restart orphaning issue is addressed by signed identity IF server persists and reuses the protected secret. This is helper-recreation evidence, not actual process-restart/durable-route browser acceptance.

Required fix: owner(request) accepts POST with NO Origin and NO sec-fetch-site, demonstrated by final characterization test. checkpoint-api and product-workflows delegate authorization to this helper; product-workflows explicitly requires host CSRF enforcement. Require exact Origin for unsafe methods in owner(), not only bootstrap; retain cross-site rejection. Change characterization test to expect null after fix. Same-site but wrong Origin already rejects. Local peer alone is not a substitute for mutation Origin verification.

Additional hardening: bootstrap 403 responses omit no-store; apply no-store consistently to sensitive authorization responses. No X-Content-Type-Options asserted/present in helper. Signed cookies remove session Map exhaustion but permit unlimited issuance: if bounded issuance remains acceptance, add explicit bounded rate control; avoid restoring a session-only owner map. Verify protected key persistent location and access permissions in deployment/local launch environment. Actual restart route round trip remains coordinator integration work.

No paid calls, engine installations or provider status changes. Tickets 113/131/197/198 are not claimed complete by helper tests.

## Expanded final audit of signed implementation

11 tests passed, 54 assertions against the same signed source hash noted above. Added real filesystem key generation/reload (32 bytes, mode0600), rejection of permissive keys, short keys and symbolic links; identity survives helper recreation using reloaded disk key. Added noncanonical and forged signature/expiry, cross-origin, cross-site and unverified-peer cookie rejection. Tested temporary key files removed in finally. No account recovery claim: cookies expire at24h and losing/changing the key revokes prior access.

Both outstanding findings persist in inspected source: missing-Origin POST is accepted by owner(), and denied bootstrap lacks no-store/nosniff. Characterization tests intentionally demonstrate current behavior, not approval of those behaviors. Coordinator must invert those assertions after fixes. Successful bootstrap is no-store and HttpOnly/SameSite=Strict; Secure is absent on loopback HTTP by current design. No browser/server restart test was performed for this security slice; helper recreation with disk reload is the precise restart evidence.
