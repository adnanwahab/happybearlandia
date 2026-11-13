# Research metadata adapter — SHE-246

This opt-in library acquires OpenAlex and Crossref DOI singleton metadata. It
creates research cards and caller-authored ImprovementProposal.v1 data through
an injected `sink.submit(proposal)`. It does not execute tests, retrieve source
text, publish to Linear, touch evidence/experiment stores, or activate services.
Actual Symphony pilot + pressure-release gates, one-worker cap and ownership
remain unchanged.

## Implementation plan and status

The issue's exclusive module scope takes precedence over editing the shared
implementation plan. This module records the independently verifiable slice:

1. Completed: injected HTTP/cache/sink boundaries, canonical DOI lookup and
   conservative title/year agreement; invalid metadata blocks proposals.
2. Completed: bounded attempts, time/body limits, provider spacing, retry
   deadlines, request/cost reservations, TTL and restartable SQLite metadata,
   paper and topic indexes. Provider duplicates collapse to one paper reference.
3. Completed: metadata-only cards, explicit hypothesis proposals, source IDs,
   content revisions, retrieval timestamps, license and reported full-text flags.
4. Completed: synthetic fixture tests and validation against the checkout's
   shared v1 validator. Core inbox integration remains gated on shared PR #41
   review; no core files or runtime settings changed.

Acceptance evidence: 17 module tests and the existing improvement suite pass
(43 total). No browser behavior changes; Playwright is not applicable. No live
provider retrieval is claimed. Fixtures are invented metadata for software
verification, never empirical findings.

## Calling boundary

```python
from ops.improvement.research import ResearchAdapter, Budget, SQLiteCache

# Caller explicitly supplies an HTTP implementation; nothing connects on import.
cache = SQLiteCache('/caller/private/directory/research.sqlite')
try:
    adapter = ResearchAdapter(http, cache, budget=Budget(max_requests=8, max_cost_units=8))
    card = adapter.acquire('10.1234/example')
    # Only agreed cards can produce proposals. These strings/argv are review data.
    proposal = adapter.propose(
        card, fake_sink,
        hypothesis='A reviewed mechanism may improve the model under a matched-seed comparison.',
        acceptance=['Reject the mechanism if the prespecified outcome fails to improve; report missing outcomes.'],
        test_argv=[['python3', '-m', 'unittest', 'discover', '-s',
                    'ops/improvement/research', '-p', 'test_*.py']],
        dependencies=['SHE-185', 'SHE-184'])
finally:
    cache.close()
```

`HTTP.get(url, headers=..., timeout=..., max_bytes=...)` returns `Response` with
status, headers and byte body. The injected transport **must** enforce the supplied
socket/total timeout and read cap, disable redirects (including credential
forwarding), and raise OSError for transport failures. This package deliberately
has no default live transport. Provider-specific headers are injected, permitting
OpenAlex Authorization and Crossref User-Agent/contact identification without
storing credentials in URLs or caches. Never log credentials or response bodies.

`Cache.get(key)` returns a detached JSON value or None; `put(key, value)` persists
it. Cache schema namespace v1 isolates adapter revisions. Default TTL is 24 hours;
`refresh=True` bypasses it. Only validated successes are cached. Partial/conflict
cards retain failure classifications; an expired failed provider is retried on
future calls under the same budget. SQLiteCache is single-owner and caller-closed;
use a private trusted parent directory, not a symlinkable shared directory.
Cache size/retention management and multi-process coordination belong to a later
service layer. Topic membership is a deduplicated historical discovery index,
not a claim of current provider topic classification.

## Network policy and scientific limits

Consulted official documentation on 2026-11-12:

- [OpenAlex authentication](https://help.openalex.org/api/authentication/): caller
  supplies credentials and account budget; no key registration is performed.
- [Crossref REST API tips](https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/):
  reuse cached metadata and work endpoints rather than bulk harvesting.

Defaults: at most three attempts per provider, ten-second request timeout,
256 KiB response cap, one request per second per provider and at most 30 seconds
per retry wait. Retry only 429/500/502/503/504 or transport failure; other statuses
stop. Numeric Retry-After is honored even on the last failed attempt. Deadlines
beyond the wait bound stop requests; unparseable/date deadlines disable that
provider for the adapter lifetime rather than risk an early retry. A caller must
not recreate adapters to evade a cooldown.

Budgets count attempts, including failures, before IO. Cost units are explicit
conservative caller reservations, **not measured dollars or provider billing**;
use an operator-approved conversion and reuse the Budget across calls. Bounds,
budgets and cooldowns are run-scoped, not a durable daily quota. A future live
service must supply durable host-wide quotas and transport validation before
activation. Cached responses consume no request units.

DOIs must match the requested identity. Titles compare Unicode-normalized words
ignoring punctuation/case; this conservative check may flag legitimate title
variants. Conflicting nonmissing publication years also block proposals. Missing
years/licenses/text stay unavailable; a license string or reported text link does
not grant reuse rights or mean source text was retrieved. Abstracts are ignored.
`mechanisms` stays empty; source-backed mechanisms require later full-text review
with a pinned source passage and limitations. All caller hypotheses are labeled
as model hypotheses; falsifiable criteria and argv must be supplied explicitly
and reviewed by the coordinator. No empirical values are inferred or invented.

Content revisions exclude retrieval dates, so unchanged refreshes yield identical
proposals. Both providers' revisions contribute to one DOI reference; DOI and topic
keys deduplicate the cache. Sink retries may resubmit identical data: durable
proposal idempotency and conflicting revisions remain the shared sink's ownership.
No integrated inbox submission or review/approval claim is made here.

```sh
python3 -m unittest discover -s ops/improvement/research -p 'test_*.py' -v
python3 -m unittest discover -s ops/improvement -p 'test_*.py' -v
```
