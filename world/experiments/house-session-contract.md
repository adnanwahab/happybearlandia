# Household autosession persistence (Models backend)

Route `GET|PUT /api/world-experiments/:experimentId/house-session/:encodedHouseholdId`.
PUT body exactly `{schemaVersion:'house-session-save.v1',checkpoint,expectedRevision}`; expectedRevision0 for no prior row, otherwise last returned positive revision. Full typed-graph checkpoint only. Same-origin and32MiB bound. Optimistic stale writes return409 and do not overwrite; clock/population/lineage regressions reject400. GET missing404.

Response direct record `{schemaVersion:'house-session-record.v1',experimentId,householdId,revision,minute,population,updatedAt,checkpoint}`; server derives minute/population, never trusts request scalar summaries. First PUT201, updates200. Full original immutable experiment and all old manual saves remain unchanged. Session is scoped to exact experiment/household, so a fork starts without its parent autosession.

SQLite `world_house_sessions` PK(experiment_id,household_id), bounded128 rows, latest mutable checkpoint only. Separate attempt window120writes/minute (does not consume manual save10/minute, does not create immutable experiments). API handler test options `maxSessions`, `maxSessionWritesPerMinute` allow tiny deterministic quotas. Same-household baseline validity and compatible append-only population continuation checked against both immutable baseline and prior session within one SQLite write transaction. Current implementation in progress below this contract.

Backend LANDED and validated: helper `house-session-store.js` uses the existing SQLite WAL connection, `BEGIN IMMEDIATE` transactions, separate persistent120/minattempt ledger,128rowmax. Persistence-store exposes `getHouseSession(experimentId,householdId)` and `putHouseSession(experimentId,householdId,input,updatedAtISO)`. API nested route live; no server.js dispatch change needed (existing prefix dispatch covers it).

21pass153assert across real SQLite disk/session + immutable persistence + mapped-home regressions (`/private/tmp/hbl-house-session-backend.log`). Proven partial hug contact→completed hug memory survivesDBclose/reopen; exact typed checkpoint; original saveunchanged; simultaneous expectedRevision1 writes yield200+409; wrongIDs/seed/ancestry/pastclock/futurehistory rejectwithoutoverwrite; separate writebound/rowquota; forks no parent session; sameorigin/schema/bytebounds.
