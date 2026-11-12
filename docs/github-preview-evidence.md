# PR preview implementation evidence — November 12, 2026

Feature branch `codex/github-version-previews` starts at verified remote sprint
baseline `173f9530752b0e476583ad3ee7433b57a857b6bd`. Existing primary checkout,
worktrees and Symphony files were preserved. Open PR audit found no duplicate
feature. Latest human scope is open PRs only; closed/all browsing is not implemented.

## Executed

- Focused Bun unit/integration and existing HTML/universe navigation tests passed;
  34 passed,0failed,293assertions. Command:
  `bun test test/github-previews.test.js test/github-local-provider.test.js
  test/github-fly-provider.test.js test/html-navigation.test.js test/universe-shell.test.js`.
  Trusted runtime entrypoints also compiled via Bun.build without executing guests.
- `bun test/github-browser-smoke.mjs`: real Chromium390px browser; mocked metadata
  and preview responses; two list requests,three detail requests,exactlyonePOST
  after deliberate click. Hover/scroll/detail/reload did not provision. XSS strings
  stayed text; credential was absent from browser storage; search URL/back/reload
  and no horizontal overflow passed. Screenshot `/private/tmp/hbl-github-browser-mobile.png`.
- Real GitHub transport using existing authenticated gh login: first bounded
  open-only page returned8PRs,hasNextfalse. Public transport reached a real GitHub
  rate limit and surfaced the error instead of an empty list. No token extracted.
- Source preparation for actually open PR40 head
  `4845c3dadc1cc32c6d6e42b64cf6583410884b79` succeeded:18,815files,
 468,789,099expandedbytes; locked dependency SHA512 values checked. Disposable
  bundle `/private/tmp/hbl-preview-local-proof/bundle.tar`. No selected code or
  dependency lifecycle script executed on host. This was an explicit verification
  request, never a metadata-browsing side effect.
- Actual local HTTP relay fixture verified correct backend, strict Host/origin,
  stripped credentials/cookies, CSP and absence of fallback to a host service.
- Actual empty-queue runner process test verifies an inherited OS lock rejects a
  second controller. It does not launch a guest.
- `git diff --check` passed. No browser result is inferred from generated code.

## Local preview verification: blocked, not passed

Repeated actual host admission checks failed normal macOS pressure/≥2GiB estimated
headroom. Last check reported:
`Preview held: normal macOS pressure and at least2GiB estimated headroom required`.
No Docker application runtime was launched and no guard was bypassed. Consequently
selected-revision backend/frontend graphical rendering, actual container egress
probe, worker/API/WebSocket behavior and live runtime restart remain unverified.
A source bundle, visible button, fixture relay or200readiness response does not
satisfy the live local-preview milestone. Follow `docs/github-previews.md` when
resources are healthy; perform one explicit click and record the rendered route.

## Fly configuration and activation

Implemented real adapter/builder and trusted firewall/proxy recipe with contract
fixtures. No liveFly resources,build,push or deploy were performed. See
`docs/github-fly-previews.md` for explicit reviewed configuration/budget and required
network,secret,TLS/browser/cleanup proof. Activation is pending. Main app idling
must never own the controller's durable work.

## Remaining limitations

The requested end-to-end local rendering milestone is not complete. Fly live
isolation/routing/rendering is also not complete. Postinstall-dependent revisions,
unsupported lock layouts and private-source transport intentionally fail closed.
Operator/controller capability configuration is required; no fictitious web user
or implied authorization is supplied. No production deploy/merge occurred.
