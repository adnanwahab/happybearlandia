# Opt-in journey showcase

`/routes` displays up to twelve manually selected Reality shares. There are no
seeded public examples, player/view counters, telemetry or automatic publication.
A preview is text from an editor plus frozen engine, horizon and selected-run
seed, labeled synthetic. It starts no worker or GPU renderer; existing card hover transitions honor reduced motion. The
source link is always `/r/:id`, using the existing exact-future replay and
metric-equivalence checks. No run, clock, entity, model or seed contracts change.

## Ownership and consent

The normal Reality Compiler **Create experiment link** action requests
`claimOwnership:true`. Creation returns a random 256-bit `ownerToken` once, only
to the creator. GET never returns it. Only its SHA-256 hash is stored in the
separate SQLite `reality_showcase_owners` table. The frozen share is unchanged.
The private management link transports this capability in a fragment to
`/routes`; the UI removes the fragment from the current history entry, fills
password/ID fields and does not persist the key. Keep the private link/key to
withdraw later. Losing it has no account recovery in this bounded slice.
Possessing an ordinary shared URL does not establish ownership. Existing shares
cannot be claimed retroactively. Capability possession establishes control of a
submission, not legal authorship; the submitter attests authorship/permission,
and a human editor must review it.

`PUT /api/reality-shares/:id/showcase` requires `Authorization: Bearer <ownerToken>`
and `{consent:true|false}`. Explicit opt-in is required; the unchecked UI cannot
submit. Withdrawal needs no checked consent box. Requests with a foreign Origin
are denied. Write attempts use the existing bounded share rate limit. Consent
changes increment a revision; repeats are idempotent. Withdrawal takes effect on
the next uncached listing and immediately refreshes the submitter's gallery.
Already-open pages, source links and third-party copies cannot be recalled.
Re-consent cannot resurrect a previously approved selection without fresh review.

The gallery/consent APIs use `Cache-Control: no-store`. Source expiry (30 days),
missing source, unsupported model/runtime, wrong source digest, selected run,
manifest or consent revision suppress entries. Expired ownership rows are cleaned
on subsequent share creation. Legacy record contracts and immutable ID behavior
remain compatible. No public endpoint lists pending submissions or owner data.

## Manual editorial procedure — external prerequisite

Real submissions, a responsible editor and private consent/ownership/privacy
review are prerequisites. None are implied by disposable tests. No live service
has been enabled. Work on authorized local data only:

1. Obtain the share ID through an authorized private editorial process; inspect
   the entire source, including proposal, geography and frozen inputs, for
   ownership/permission, privacy and moderation concerns. Do not collect or
   publish identifying attribution, source payloads or owner keys in git.
2. Run `bun scripts/review-showcase.js <existing-local-share-db> <share-id>`.
   This opens SQLite read-only, requires current consent/unexpired source,
   validates the versioned manifest and actually replays the selected pair.
   Metrics, sampled assumptions and seed must reproduce. Failure stops review;
   the script does not publish or claim empirical certification.
3. Privately check the output and author an accurate non-identifying title and
   summary. Add the returned ID, manifest ID, run ID, digest and consent revision
   with that copy to `SHOWCASE_SELECTIONS` in `showcase-editorial.js` in a reviewed
   code change. Preserve the digest; never replace it with an arbitrary value.
   Approval is manual code review, not an end-user writable boolean. Do not add
   test fixtures to the production selections. Removing a row unlists it.
4. Review source again at the exact `/r/:id`. Consent never bypasses review; an
   editor cannot bypass withdrawal. No text is automatically copied from a
   submitted proposal into the public gallery. Publishing real entries requires
   separate owner authorization and the usual deployment review.

Empty selection is intentional until real consented content exists. The initial
slice covers Reality Compiler shares, not every application's recipe format.
A missing source shows the established shared-experiment error; no replacement
experiment or recipe fallback is chosen by the gallery.

## Verification

`bun test test/reality-showcase.test.js test/reality-share.test.js test/reality-workflow.test.js`
checks actual SQLite and actual replay with disposable synthetic inputs.
`bunx playwright test --config test/reality-showcase.browser.config.js` checks the
real directory, empty/unavailable states, keyboard controls, reduced-motion
mobile layout and fixture-only public-card rendering/withdrawal. It writes
before/after directory images only if browser execution succeeds. The card test
mocks API responses; API authorization/replay are checked separately in Bun.
See `docs/reviews/SHE-585.md` for actual results and environmental blockers.
