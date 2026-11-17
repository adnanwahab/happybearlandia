# Future Machine: 40-second demo

Use `/world/future-machine.html` with the ordinary application server. This is a synthetic monthly City scenario, January 2026–January 2036, with illustrative, uncalibrated rules. Record only a completed comparison; do not hide absent metrics or manufacture physical change.

| Time | Action | Narration |
| --- | --- | --- |
| 0–5 s | Show Month 0, matching city scenes and synthetic legend. | “What if one housing decision changed ten modeled years?” |
| 5–12 s | Show policy amount, assumed cost and timing; click Fork City. Cut past computation only if labeled. | “Both futures start from the same city and seed. One receives this housing proposal.” |
| 12–23 s | Play the synchronized timeline; blink baseline/plan; use the director for a recorded divergence. | “These differences come from the monthly City model.” If there is no physical difference, say so and inspect a supported scalar change. |
| 23–32 s | Stop at Month 120. Read available housing, travel and spending values with their exact units; select an entity. | “These are modeled outcomes under our assumptions, not a forecast.” Travel is minutes per link, not a measured resident commute. |
| 32–40 s | Open event evidence, export JSON, copy the share URL and reopen it. | “Inspect the recorded evidence, then reopen the same inputs and month.” |

Do not imply that the intervention instantly completes homes or that all differences have a recorded causal explanation. Use exact monthly City IDs; do not open an unrelated House resident. If the saved experiment cannot be loaded, visibly label bounded recipe recomputation. Never describe that fallback as recovery of an independently verified checkpoint.

# Share module integration and acceptance

Frozen interface: `../INTERFACES.md`, `future-machine.v1`. This module exports the required codec, URL, and evidence functions, plus `validateRecipe`, `assertHistoryIdentity`, `ShareError` and `MAX_RECIPE_LENGTH`.

- `fm` contains canonical URL-safe base64 JSON; maximum 2,048 characters. It pins schema/model, uint32 seed, 1–120 synthetic households, exactly 120 steps and one bounded policy or null. Only synthetic districts d0–d2 are allowed. Model changes fail explicitly.
- `experiment` optionally identifies saved City records; `month` is mandatory for a supplied shared context and is exactly 0–120. Missing/duplicate parameters fail; no supplied context returns null. The path, unrelated query parameters and fragment are preserved.
- After loading a saved experiment, call `assertHistoryIdentity(loaded, context)` **before displaying the run**. This rejects a valid saved experiment ID that points to different recipe/model/seed/policy inputs. An unavailable record may fall back to recipe execution, visibly identified as recomputation. Validate the new recipe identity without requiring the old experiment ID for that fallback.
- Initial input identity in the URL is the pinned model's bounded synthetic generator plus seed/household count; arbitrary initial states are not supported. The evidence export retains the adapter's canonical initial-state digest, provenance, selected-month observations/events/causal records/decisions, comparison and separately labeled interpretation. It does not claim independently verified checkpoint equivalence. Hash construction/verification belongs to the data adapter.
- Exports require all 121 indexed snapshots in both arms, a digest, consistent declared model/seed and a matching diff month. They reject non-finite measurements, non-serializable evidence and exports exceeding four million JSON characters. Returned reports are detached copies. JSON export can be downloaded by the coordinator's existing Blob action.

Verified with `bun test test/future-machine-share.test.js`: codec roundtrip/boundaries, unsupported versions, malformed and oversized input, URL refresh context, missing/duplicate parameters, mismatched saved identities, real engine deterministic seed-matched 120-step replay, immutable Month 0, and evidence provenance/limits. This pure module does not add browser controls; coordinator owns browser integration.

# Independent integration UX review

Source inspection of the coordinator's initial `main.js` (2026-11-11) identified these integration actions:

1. Saved-record load currently accepts the loaded history without checking it against the recipe in the URL. Call `assertHistoryIdentity` after successful saved load. Otherwise changing `experiment` can reopen another run while silently discarding the link's intended policy and seed.
2. A failed saved load briefly displays a recomputation message, then overwrites it with the generic ready message. Keep the fallback explanation visible after completion, alongside the new experiment identity. Provenance-only disclosure in a downloaded report is insufficient for the visitor.
3. Catch evidence export errors and show them in the UI. A missing digest or incomplete replay should produce an actionable unavailable export state rather than an uncaught event-handler exception.

The integrated UI/scene modules were not yet present in the coordinator checkout at this review, so browser interaction, keyboard navigation, responsive layout and clipboard/download behavior remain unverified by this worker.

Integration resolution: the composed page now checks saved identity before display, retains the fallback disclosure, and routes export errors through the UI action handler. Final browser evidence is documented in `docs/future-machine.md`.

## Truthful image export (SHE-47)

After Fork City completes, select a month and choose **Download share card**.
The PNG contains paired recorded metric observations, exact numeric values and
units, signed-by-value deltas, selected month, seed/model/generator identity,
run ID, input digest and synthetic-data limitations. The no-intervention control
can truthfully show no change. Missing measurements display Unavailable.
`card.js` reuses evidence validation and frame comparison; it never simulates
or reads pending seed/policy edits. Rendering is a self-contained SVG rasterized
by the browser into PNG, independent of scene renderer and camera mode.

Run `bunx playwright test --config test/future-machine-share-card.browser.config.js`
for actual-run download, repeat-image equality, no-change and UI screenshot
evidence. This session could not start the local server or Chromium; see the
SHE-47 implementation-plan entry for exact blockers. Visual acceptance remains
pending; numeric and identity acceptance passed the focused Bun tests.

SHE-98: Preview comparison link previews the displayed recipe, seed, saved identity,
month and landing context before Copy previewed link writes to the clipboard.
Pending next-run edits are excluded. The optional versioned `landing` parameter
restores view/ghosts and a compatible renderer camera; old links still work.
Run `bunx playwright test --config test/future-machine-permalink.browser.config.mjs`
for the fresh-page integration check with isolated temporary storage.
