# Animated link preview — implementation and acceptance

Owned slice: reproducible generator, two public assets, exact media routes, homepage metadata, focused regression. No simulation, shared planning, merge, or deployment changes.

## Generation

Install FFmpeg including FFprobe (`brew install ffmpeg` on macOS), then:

```sh
bun run preview:generate
bun run preview:check
# Optional source: starts at zero; must contain at least six seconds of video.
bun run preview:generate /absolute/path/to/demo.mp4
```

Default source is the committed `docs/evidence/she64/one-city-two-futures.mp4`, seconds 10–17. Crop preserves the paired city scene and its synthetic-model disclosure. Fixed dimensions, frame rate, encoder settings, stripped metadata, silent H.264/yuv420p, and MP4 faststart support broad playback. JPEG is extracted from the encoded clip at two seconds. Output bytes may differ between FFmpeg/libx264 versions; filenames and media contracts are stable. Staging is removed on failure; validation precedes publication. The generator never installs tools or downloads media.

`preview:check` requires both assets, checks codecs/dimensions/no audio/duration/size with FFprobe, and fully decodes each with FFmpeg. Total budget is strictly below 5,000,000 bytes. Optional sources shorter than six seconds fail validation clearly.

## Evidence

- Bun 1.4.2; local FFmpeg/FFprobe. Seven seconds, 168 H.264 High frames, yuv420p, 1200×630, no audio. MP4 212,218 bytes; JPEG 77,116 bytes; total 289,334 bytes.
- `bun run preview:generate` and `bun run preview:check`: passed, full decode.
- `bun test test/social-preview.test.ts test/startup-route-link.test.js`: 6 passed, 0 failed, 43 assertions. Real ephemeral HTTP server: homepage metadata, exact bytes, GET/HEAD 200 and content types; private/unknown paths 404; unavailable-input failure leaves existing media intact; missing FFmpeg fails clearly.
- `bun run test:startup`: existing Chromium startup suite 6/6 passed, 4.9 seconds, zero reported page/GPU errors. No test assertions or startup configuration changed.
- Poster visually inspected. No iPhone/iMessage test performed; animation is not established by metadata or desktop decoding.

## Deployment verification (after separately approved release)

Use the existing release workflow; this PR does not deploy. Run on the released revision:

```sh
bun run preview:check
curl --fail --silent --show-error --dump-header /tmp/hbl-preview-video.headers https://happybearlandia.fly.dev/preview.mp4 --output /tmp/hbl-preview.mp4
curl --fail --silent --show-error --dump-header /tmp/hbl-preview-image.headers https://happybearlandia.fly.dev/preview.jpg --output /tmp/hbl-preview.jpg
cat /tmp/hbl-preview-video.headers /tmp/hbl-preview-image.headers
ffprobe -v error -show_streams -show_format /tmp/hbl-preview.mp4
ffmpeg -v error -xerror -i /tmp/hbl-preview.mp4 -f null -
ffprobe -v error -show_streams /tmp/hbl-preview.jpg
curl --fail --silent --show-error https://happybearlandia.fly.dev/ --output /tmp/hbl-preview-home.html
rg 'og:|twitter:' /tmp/hbl-preview-home.html
shasum -a 256 preview.mp4 /tmp/hbl-preview.mp4 preview.jpg /tmp/hbl-preview.jpg
```

Require HTTP 200, `video/mp4` and `image/jpeg`, matching deployed bytes, valid full decode and absolute HTTPS metadata. Do not mistake redirects, an HTML error body, or a cached older asset for success.

## Manual Apple-device acceptance

On a real iPhone, record model, iOS version, date, connectivity and deployed commit. Start a new Messages conversation, paste `https://happybearlandia.fly.dev/`, wait for the rich preview and send it. Inspect both sender and recipient: title, readable paired-city poster, tap-through destination, and whether motion is offered/autoplays. Repeat with Reduce Motion and Low Power Mode, plus an older supported device when available. Verify a usable static poster when video is not animated. Messages may cache previews; record cached behavior and retry in a fresh conversation (a cache-busting query may help diagnostics but does not replace testing the exact root URL). Capture only consented, non-private evidence. Report animation as supported only on the actual tested device/configuration; never promise universal autoplay.
