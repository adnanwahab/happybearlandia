# Saved city tour v1

Entry: `/world` → World controls → Make your own city tour. Use World Save to
capture a view, then add its saved experiment ID and a plain-text description.
The builder keeps 3–8 steps in page memory. Drag or use Move up/Move down buttons;
remove steps before export. Titles and descriptions are user interpretation.

Each step pins the immutable experiment ID (the native saved run/checkpoint
identity), SHA-256 of the complete save, checkpoint/model versions, source label
and saved camera position/target. The complete save pins geometry, inputs, seed
and RNG state; the recipe does not recompute results or create a new run. There
is no inferred cross-authority mapping. Submitted source labels remain visibly
unauthenticated. Identical checksum does not establish empirical validity.

Check sharing rights explicitly to export JSON for manual copying. Nothing is
published, uploaded, or stored by this module. Open JSON as a read-only guest;
Play, Skip/next, Previous and Reverse route visit native `/world?experiment=…`
restoration with a bounded recipe in the URL fragment. Descriptions render as
text and arbitrary action/script/URL fields are discarded. Playback is manual
with cuts, without timed movement; keyboard/native buttons and reduced-motion
users use the same path. The checkpoint is paused on arrival. Normal simulation
controls remain available outside this tour.

Every navigation and carried arrival revalidates the save checksum and exact
anchor. Source/pose/version mismatches fail closed. Missing or denied saves
remain invalid; the startup failure screen retains guest controls to skip them.
Source records are never modified. No new server authorization claim is made:
existing saved experiments have unauthenticated reads. Share only references
and descriptions that may be disclosed. The recipe adds no access capability.

Delete local tour clears its in-memory contents and fragment. It cannot delete
source saves, browser history on other devices, exported recipes or recipients'
copies. Hosted revocable/private sharing is a separate prerequisite requiring
an ownership/authorization/deletion contract for saved experiments. Refreshing
an unexported draft discards it. Drafts intentionally have no localStorage.

Checks: `bun test test/city-tour.test.js test/world-persistence.test.js`.
DOM controls: set `HBL_TOUR_DOM` to a happy-dom `lib/index.js` module and run
`bun test test/city-tour-panel.test.js`. Browser components:
`bunx playwright test --config test/city-tour.browser.config.js`. These fixture
components do not establish GPU or full native World acceptance.
