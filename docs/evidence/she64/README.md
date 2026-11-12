# SHE-64 guided demo receipt

Verified November 12, 2026 on branch `mini/SHE-64`, source baseline
`b963dd353538294cb0fbf5d34d5283fad6e10e68`.

[Play the retained MP4](one-city-two-futures.mp4) (56.84 seconds, H.264,
1440×1000). [Raw browser capture](video.webm), [machine receipt](receipt.json),
[artifact audit](artifact-audit.json), [initial screenshot](demo-start.png),
[completed screenshot](demo-complete.png), and [WHY screenshot](demo-why-completion-event.png)
are retained beside the run JSON. No application code changed.

## Overlap and provenance

The requested journey already exists in `test/e2e/two-futures-sprint.e2e.js`
and `scripts/record-one-city-two-futures.mjs`. The earlier integrated recording
was retained at `/tmp/hbl-approved-final-recording`. This receipt copies that
capture byte-for-byte into repository evidence; it is **historical evidence,
not a new recording of this checkout**. Its MP4 SHA-256 matches the existing
`docs/demo-evidence-manifest.json` entry:
`be8ada5ed32bb98e16fe8bcc75fe17e3988b19287f8d82f3ea7e617bf950d82f`.
The earlier manifest associates progressive evidence with implementation
`ad3902c522559b699cf70a1ae848c55b9e01641c`; exact capture commit is not independently
established. No PR was created; the branch above is the review reference.

The single continuous raw WebM and MP4 both decode through their full duration.
This preserves the existing uncut capture; this audit cannot independently
establish whether historical capture production involved editing. No trimming,
stitching or speed changes were made for this receipt. The retained MP4 has no
audio stream; guidance is provided by the app's captions and WHY panel.

Canonical recipe: seed 42, `city-systems.1.0.0`, 30 households, 120 months,
district d1 housing intervention of 24 homes, illustrative 1,000,000 USD,
delay 0, compliance 1. Initial baseline and plan states are exactly equal.
Run `city_705bdf23e7e64d3b8d6b51f1665d11f6` has initial hash
`e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`.
First added completed building is `building-project-policy-1-0` at Month 16.
At completion homes are 36 versus 60 (+24), with +1,000,000 USD cumulative
capital spending. Earlier policy/construction differences are distinct from
this completed-building divergence.

Frames extracted at 14 seconds ([Month 16](video-month16.png)) and 55 seconds
([WHY](video-why.png)) were visually inspected. They show the added structure,
baseline ghost, completion event `16-0`, exact model/run/seed and disclosures.
This is a synthetic, uncalibrated model, not real geography or an empirical
forecast. Related events alone do not establish causal certainty; unavailable
causal dependencies remain explicit.

## Actual verification

From repository root:

```sh
bun scripts/record-one-city-two-futures.mjs --output /tmp/hbl-she64-final-recording --port 39964
bun scripts/record-one-city-two-futures.mjs --output /tmp/hbl-she64-final-recording-attempt2 --port 41864
```

Both exited 1 before browser launch. Bun reported EADDRINUSE; a direct diagnostic
`python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0))'`
failed with `PermissionError: [Errno 1] Operation not permitted`, confirming
sandbox binding restrictions. No existing server was stopped or reused.

```sh
bun test test/two-futures-demo-controller.test.js test/two-futures-evidence.test.js test/future-machine-data.test.js test/future-machine-evidence-trail.test.js
bun scripts/verify-demo-artifacts.mjs docs/evidence/she64
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json docs/evidence/she64/one-city-two-futures.mp4
ffmpeg -v error -i docs/evidence/she64/one-city-two-futures.mp4 -f null -
ffmpeg -v error -i docs/evidence/she64/video.webm -f null -
```

Results: 12 tests passed, 0 failed, 91 assertions; artifact verifier found two
real browser records with PNGs, one video, months 0/120; both full video decodes
exited 0. Recorded Play-to-complete timing is 54,840 ms. Receipt hashes cover
all retained assets. Additional direct assertions verified equal initial states,
canonical recipe version/seed, first divergence and final inventory/cost deltas.
No UI changes require new screenshots. No deployment, merge or production data
change occurred. Linear dispatch status and labels remain unchanged.

## Remaining acceptance

Fresh current-source browser capture remains blocked. Run the recording command
on a host permitted to bind a local server, use a fresh output directory, verify
artifacts, inspect the resulting video and record source identity before calling
this a final current-source acceptance. Historical evidence and passing focused
tests alone do not close that gate. No new recording or current-source browser
pass is claimed here.
