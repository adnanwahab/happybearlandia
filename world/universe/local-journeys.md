# Local journey counters

Import `mountLocalJourneyControls` from `./local-journeys.js`, mount once into a visible shell container, and retain its returned controller. Call `controller.record(action)` directly from confirmed UI action handlers. Do not forward iframe messages, contexts, payloads or identifiers to it. There is intentionally no analytics event bus, snapshot/export API, or network destination.

Allowed actions: `second-connected-experience`, `causal-link-click`, `completed-bakery-journey`, `future-entry`, `future-reopen`, `saved-world-continuation`.

The shell decides when a second distinct connected experience has been opened using its own existing navigation state. Only call bakery completion after the actual journey has completed; entry and reopen are separate confirmed actions. Do not infer completion from mounting a page. Causal-link clicks may repeat; other milestones count once per mounted controller/page session. This bounded in-memory deduplication deliberately does not persist identities across reloads.

Default off. Explicit opt-in writes one localStorage record containing version, enabled flag and six capped integer counts. Reset and disabling remove that record and revoke consent. Malformed or inaccessible storage fails closed; counts saturate at 999999. No timestamps, sessions, worlds, runs, entities, household content or conversation content are stored. Different tabs read consent again before each count, but simultaneous updates can undercount: these are approximate local counters, not analytics.
