# Advisory feedback and triage

The existing `/vote-on-patch` entry point collects votes, ideas, problems,
confusing steps and favorite moments. Every write requires `consent: true`;
reading issues no cookie. The UI starts unchecked and does not persist consent.
Unchecking prevents future submissions; it does not erase previously submitted
records. No names, emails, IPs, URLs or gameplay telemetry are stored by this
module. Free text may contain personal data: operators must keep the store
private. There is no public report listing. Replay seeds are optional, manually
supplied strings; they do not prove reproducibility without model/input versions.

Configure HBL_PATCH_VOTE_SECRET and optionally HBL_PATCH_VOTE_DB_PATH as for the
existing ballot. Keep the database outside static roots. No deployment here.

Run `bun ops/patch-voting/triage.js list` locally to inspect pending feedback
and advisory vote tallies. Run `bun ops/patch-voting/triage.js merge SOURCE TARGET`
to mark a duplicate idea merged into another unmerged idea atomically, retaining
both original texts and provenance. Reports cannot be merged. These commands
never implement changes, launch agents or publish feedback. No remote admin
endpoint or automated improvement-service handoff is introduced.
