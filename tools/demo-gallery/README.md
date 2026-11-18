# Demo gallery

Open `/demo-gallery` from the homepage or route directory. This static-media
collection reuses `world/universe/registry.js` identities/titles/destinations;
`manifest.js` adds visualization destinations and media mappings. It never uses
the registry's live `preview` iframe URL as an image. No simulation/model rules
or context identity mappings are changed.

## Daily local updates

1. Capture a real image/video from the destination. Record capture date, source
   revision, scenario/seed if applicable, and whether it is synthetic in your asset
   change description. Do not label an illustrative capture as an observation.
2. Add versioned files under `data/previews/YYYY-MM-DD/` (for example
   `future-machine.png` and `future-machine.mp4`). Use browser-compatible MP4
   codecs, a compact image poster, and compressed media. Never overwrite archived
   dated files. `data` already has static serving.
3. Add/update the experience ID in `MEDIA` in `manifest.js` with `image` and/or
   `video` paths. Keep the ID and destination in the experience registry. For an
   archived capture, append an `ARCHIVED_PREVIEWS` entry with a unique ID/date, title,
   group, description, media paths and the same destination. Bump `MANIFEST_VERSION` for a changed
   collection. Cards are generated; do not duplicate markup.
4. For homepage sharing only, copy the approved current image and MP4 to root
   `preview.jpg` and `preview.mp4`. These exact stable routes are explicitly
   served, even though assets are currently absent. The gallery never fabricates
   them. Metadata tags are owned by separate PR #466. No upload/deployment is
   implied by a local asset change.
5. Run `bun test test/demo-gallery.test.js test/server.test.js
   test/universe-shell.test.js` and `bunx playwright test --config
   test/e2e/demo-gallery.config.js`. Inspect desktop/mobile captures in
   `/private/tmp`, outside commits. Check video playback, posters, destinations,
   failed media, filters and scrolling before requesting review.

The initial Future Machine image is `data/launch/two-futures.png`; its video is
historical evidence `docs/evidence/she64/one-city-two-futures.mp4`, exposed through
one explicit media alias without exposing all docs. These are existing authored
synthetic-scenario captures, not a claim of today's production behavior. Other
experiences explicitly show “No preview yet” until mapped. Missing mapped files
show an unavailable message; their destination remains usable. Videos load no
bytes until requested and only receive a source near the visible scroll region;
controls and posters are native, autoplay is disabled, and filtering pauses and
releases the prior videos. There are no live iframes.
