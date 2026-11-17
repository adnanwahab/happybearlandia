# Temporary guest snapshots (SHE-778)

Open `/world` → Temporary guest snapshot. Upload the existing Reality share JSON
shape (`manifest`, completed `run`, optional `displayInitial`) and explicitly
confirm publication and disclosure rights. This is an uploaded snapshot service,
not authenticated sharing of an existing project. No sessions or projects are
looked up. Do not describe this as project authorization.

`POST /api/guest-snapshots` additionally requires `publishConsent:true`,
`rightsConfirmed:true`, and integer `ttlSeconds` in 60–86400. The page uses one
hour. Returns `url` with a fragment read capability and a separate `revokeToken`.
Save the revocation capability privately; the page retains it only in memory.
`GET` with `Authorization: Bearer <read capability>` reads exactly one snapshot.
`DELETE` with the revocation capability deletes it. No list or update endpoint.
Unknown, malformed, expired, revoked and wrong-scope credentials return 404.
The read capability cannot delete. Secrets are 256 random bits; only hashes are
stored. API responses are no-store. The page removes the fragment before fetch,
uses no external assets or animation and renders uploaded data as text.

SQLite uses `HBL_GUEST_DB_PATH` (default `.data/guest.sqlite`) outside static roots.
At most 100 active records, each upload bounded to 8 MB by the existing validator.
Expired records are denied immediately and removed on access or the next create.
Revocation deletes the active SQLite row; downloaded copies, database backups and
SQLite free pages/WAL are outside its recall/secure-erasure guarantee.

Frozen model/rules inputs, seed and submitted results use the existing Reality
validator; server validation does not certify sources or recompute outcomes.
This page displays data for inspection, not verified modeled conclusions.
Forking is disabled. Ownership authentication, authoritative rights resolution,
project-backed issuance and interactive replay are prerequisites for the full
issue. Disclosure rights are uploader attestation only. Production rollout also
requires deployment-owned abuse limits, retention/backup policy and review.
