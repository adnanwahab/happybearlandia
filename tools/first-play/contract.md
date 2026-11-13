# First-play export adapter v1

Open `/tools/first-play/index.html` through the normal Bun server. The dashboard
reads a local export; it does not persist, transmit, or collect player events.
The Future Machine now exposes page-memory SHE-8 milestones through
`window.futureMachine.firstPlayEvents`. This dashboard consumes the separate
`first-play-export.v1` format below; it does not import those raw wrappers
automatically. A compatible exporter must establish timestamps, source and bot
classification. The local milestones alone do not provide that export or a
complete observation window.

JSON fields: `schemaVersion: "first-play-export.v1"`, nonempty `source`,
`kind: "recorded"` (or `"synthetic-fixture"` for tests), `observationStart`,
`observationEnd` (ISO timestamps, half-open interval), and `events` (max 100,000).
Each event has nonempty `id`, `sessionId`, ISO `timestamp`, explicit boolean `bot`,
and `type`: `landing`, `start`, `choice`, `first_change`, `share`, or `return`.
Only use opaque consented anonymous session IDs. No personal identifiers needed.
Exporter must establish bot classification; unknown classification cannot be
silently treated as human. A bot event excludes the entire session.

Repeated identical IDs are deduplicated; conflicting IDs reject the export.
Event counts count unique non-bot emissions. Ordered session counts require all
prior transitions in one anonymous session; equal timestamps use stage order.
Conversion denominator is the previous ordered stage; zero denominator is
unavailable. Cohorts are the first observed landing date per session in UTC.
They are session acquisition cohorts within the export, not new-person cohorts.
Return requires an explicit recorded return after share; it does not establish
cross-session retention. D1 and D7 remain null until a verified identity,
consent, completeness and follow-up-window contract is integrated with SHE-124.
No observed events means zero counts only for the supplied export, never proof
that no players visited. No export means unavailable. Source labels are supplied
by the exporter, not independently authenticated by this offline tool.
