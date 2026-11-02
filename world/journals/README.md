# Character journals

The seven coordinates in `presets.js` match `#preset` in `/world/index.html`.
Visiting one enables daily journals for every generated character in both Living
City and the legacy neighborhood. Other coordinates, embedded worlds and legacy
counterfactual runs do not publish durable journals. Journals are recorded as
those cities run; visiting a place does not fabricate earlier days.

`character-journals.sqlite` lives in `.hbl-city/` (override the server directory
with `HBL_JOURNAL_ROOT`). SQLite WAL stores one updatable entry per city, mode,
run, character and simulated day. Stable character IDs allow reading earlier
sessions; run IDs keep resets and replays separate. Parameterized upserts reject
an older minute replacing a newer entry. This stores journal history, not a full
save game or NPC/world restoration.

The model accumulates actual activity minutes for every NPC, plus up to sixteen
recent notable moments per day. Midnight splits intervals. Living routines add
breakfast, dinner, after-work park/shopping preferences and seeded occasional
unusual outings to existing school/work, needs, affordability and travel rules.
Outings never bypass blocked routes or teleport characters. Travel and activity
positions continue through the existing city renderer.

The recorder sends at most 500 entries per request, at startup and after sixty
simulated minutes (at most once per fifteen wall-clock seconds). Failed saves
retry; reading a person's journal first saves their current entry. After a
successful full flush the current and previous days remain in hot memory; the
SQLite archive retains earlier days. Closing a tab before the next flush can
lose its most recent unsaved minutes. Open **Personal journal → Read journal**
to checkpoint a selected person's latest state before leaving.

API:
- `GET /api/character-journals?cities=1`
- `POST /api/character-journals` with `{cityId, mode, runId, entries}`
- `GET /api/character-journals?city=gulfton&mode=living&person=<id>`
  returns the fifty latest entries, optionally `before=<simulated-day>`.

Tests: `bun test test/character-journals.test.js` and Playwright
`test/e2e/character-journals.e2e.js` exercise SQLite reopen/retry/isolation,
unsampled NPC coverage, actual routine minutes and the city inspector.
