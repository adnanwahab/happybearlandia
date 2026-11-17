import copy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import tempfile
import unittest

from ops.improvement.proposal import validate_proposal
from ops.improvement.research import Budget, ResearchAdapter, ResearchError, Response, SQLiteCache, normalize_doi

FIXTURE = json.loads((Path(__file__).parent / 'fixtures/providers.json').read_text())
DOI = '10.1234/example'


class MemoryCache:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return copy.deepcopy(self.data.get(key))

    def put(self, key, value):
        self.data[key] = copy.deepcopy(value)


class HTTP:
    def __init__(self, responses=None):
        self.calls = []
        self.responses = responses

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.responses is not None:
            result = self.responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result
        provider = 'openalex' if 'openalex.org' in url else 'crossref'
        return Response(200, {}, json.dumps(FIXTURE[provider]).encode())


class Sink:
    def __init__(self):
        self.proposals = []

    def submit(self, proposal):
        self.proposals.append(validate_proposal(proposal))


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.http, self.cache = HTTP(), MemoryCache()
        self.date = datetime(2026, 11, 12, tzinfo=timezone.utc)
        self.waits = []
        self.adapter = ResearchAdapter(self.http, self.cache, now=lambda: self.date,
                                       sleep=self.waits.append, monotonic=lambda: 100)

    def response(self, provider, mutate=None):
        value = copy.deepcopy(FIXTURE[provider])
        if mutate:
            mutate(value)
        return Response(200, {}, json.dumps(value).encode())

    def test_matching_dedup_and_provenance(self):
        card = self.adapter.acquire('https://doi.org/10.1234/EXAMPLE')
        self.assertEqual(card['status'], 'agreed')
        self.assertEqual(card['paperId'], 'doi:' + DOI)
        self.assertEqual(len(card['records']), 2)
        self.assertEqual(card['mechanisms'], [])
        self.assertEqual(card['evidenceClass'], 'metadata-only')
        for record in card['records']:
            self.assertEqual(record['retrievedAt'], self.date.isoformat())
            self.assertTrue(record['licenseAvailable'])
            self.assertFalse(record['fullTextRetrieved'])
            self.assertTrue(record['sourceId'])
        self.assertEqual(self.adapter.acquire(DOI), card)
        self.assertEqual(len(self.http.calls), 2)
        self.assertEqual(self.cache.get('topic:v1:https://openalex.org/T123'), ['doi:' + DOI])
        self.adapter.acquire(DOI, refresh=True)
        self.assertEqual(self.cache.get('topic:v1:https://openalex.org/T123'), ['doi:' + DOI])

    def test_conflicting_title_blocks_sink(self):
        self.http.responses = [self.response('openalex'), self.response('crossref',
            lambda d: d['message'].update(title=['Unrelated work']))]
        card = self.adapter.acquire(DOI)
        self.assertEqual(card['status'], 'conflict')
        with self.assertRaises(ResearchError):
            self.propose(card)

    def test_conflicting_doi_and_malformed_metadata(self):
        for mutate in (lambda d: d.update(doi='10.1234/other'), lambda d: d.update(title=None)):
            with self.subTest(mutate=mutate):
                self.http.responses = [self.response('openalex', mutate), self.response('crossref')]
                card = self.adapter.acquire(DOI, refresh=True)
                self.assertEqual(card['status'], 'conflict')
                self.assertNotIn('metadata:v1:openalex:' + DOI, self.cache.data)

    def test_missing_license_fulltext_abstract_is_not_effect(self):
        self.http.responses = [self.response('openalex', lambda d: d.update(best_oa_location=None)),
                               self.response('crossref', lambda d: d['message'].update(license=[], link=[]))]
        card = self.adapter.acquire(DOI)
        self.assertEqual(card['status'], 'agreed')
        self.assertTrue(all(not r['licenseAvailable'] and not r['fullTextAvailable'] for r in card['records']))
        self.assertEqual(card['mechanisms'], [])

    def test_cache_restart_and_ttl(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / 'cache.sqlite')
            cache = SQLiteCache(path)
            first = ResearchAdapter(self.http, cache, now=lambda: self.date).acquire(DOI)
            cache.close()
            cache = SQLiteCache(path)
            try:
                other = ResearchAdapter(self.http, cache, now=lambda: self.date)
                self.assertEqual(other.acquire(DOI), first)
                self.assertEqual(len(self.http.calls), 2)
                self.date += timedelta(days=2)
                other.acquire(DOI)
                self.assertEqual(len(self.http.calls), 4)
            finally:
                cache.close()

    def test_rate_limit_retry_and_request_bounds(self):
        self.http.responses = [Response(429, {'Retry-After': '2'}, b''),
                               self.response('openalex'), self.response('crossref')]
        self.assertEqual(self.adapter.acquire(DOI)['status'], 'agreed')
        self.assertIn(2, self.waits)
        self.assertEqual(self.adapter.budget.requests, 3)
        for url, kwargs in self.http.calls:
            self.assertIn('10.1234%2Fexample', url)
            self.assertEqual(kwargs['timeout'], 10)
            self.assertEqual(kwargs['max_bytes'], 262144)

    def test_exhaustion_and_unavailable_source(self):
        self.http.responses = [OSError('secret'), Response(503, {}, b''), Response(503, {}, b''),
                               Response(404, {}, b'private body')]
        card = self.adapter.acquire(DOI)
        self.assertEqual(card['status'], 'unavailable')
        self.assertEqual(card['failures'], {'openalex': 'retry exhausted', 'crossref': 'source unavailable'})
        self.assertEqual(len(self.http.calls), 4)
        self.assertNotIn('secret', json.dumps(card))

    def test_retry_after_beyond_bound_stops(self):
        self.http.responses = [Response(429, {'Retry-After': '3600'}, b''), self.response('crossref')]
        card = self.adapter.acquire(DOI)
        self.assertEqual(len(self.http.calls), 2)
        self.assertEqual(card['status'], 'partial')
        self.assertEqual(card['failures']['openalex'], 'retry wait exceeds bound')

    def test_request_and_cost_budget(self):
        for budget in (Budget(max_requests=1), Budget(max_cost_units=1)):
            with self.subTest(budget=budget):
                http = HTTP()
                adapter = ResearchAdapter(http, MemoryCache(), budget=budget)
                card = adapter.acquire(DOI)
                self.assertEqual(card['status'], 'partial')
                self.assertEqual(len(http.calls), 1)
                self.assertEqual(budget.cost_units, 1)

    def test_invalid_doi_no_network(self):
        for value in ('not a doi', '10.1234/x?query', '10.1234/x#fragment', '10.1234/x\x00', None):
            with self.subTest(value=value), self.assertRaises(ResearchError):
                self.adapter.acquire(value)
        self.assertEqual(self.http.calls, [])
        self.assertEqual(normalize_doi('doi:10.1234/EXAMPLE'), DOI)

    def test_oversize_malformed_and_unauthorized_not_retried(self):
        for response in (Response(200, {}, b'x' * 262145), Response(200, {}, b'invalid'),
                         Response(401, {}, b'secret')):
            with self.subTest(status=response.status):
                self.http.responses = [response, self.response('crossref')]
                self.adapter.acquire(DOI, refresh=True)
        self.assertEqual(len(self.http.calls), 6)

    def propose(self, card, sink=None):
        return self.adapter.propose(card, sink or Sink(),
            hypothesis='A source-reviewed mechanism may improve the housing model; test against a matched control.',
            acceptance=['Reject the mechanism if the prespecified matched-seed outcome does not improve; report missing outcomes.'],
            test_argv=[['python3', '-m', 'unittest', 'discover', '-s', 'ops/improvement/research', '-p', 'test_*.py']],
            dependencies=['SHE-185', 'SHE-184'])

    def test_deterministic_proposal_and_fake_sink(self):
        card = self.adapter.acquire(DOI)
        sink = Sink()
        first = self.propose(card, sink)
        self.date += timedelta(days=1)
        second = self.propose(self.adapter.acquire(DOI, refresh=True))
        self.assertEqual(first, second)
        self.assertEqual(sink.proposals, [first])
        self.assertEqual(len(first['sources']), 1)
        self.assertEqual(first['sources'][0]['evidence'], 'metadata-only')
        self.assertIn('Model hypothesis', first['hypothesis'])
        self.assertEqual(validate_proposal(first), first)

    def test_cooldown_survives_repeated_acquisition(self):
        self.http.responses = [Response(429, {'Retry-After': '3600'}, b''), self.response('crossref')]
        self.adapter.acquire(DOI)
        card = self.adapter.acquire(DOI)
        self.assertEqual(card['failures']['openalex'], 'provider cooldown active')
        self.assertEqual(len(self.http.calls), 2)

    def test_final_attempt_rate_limit_preserves_cooldown(self):
        http = HTTP([Response(429, {'Retry-After': '10'}, b''), self.response('crossref')])
        adapter = ResearchAdapter(http, MemoryCache(), attempts=1, monotonic=lambda: 100)
        adapter.acquire(DOI)
        self.assertEqual(adapter.acquire(DOI)['failures']['openalex'], 'provider cooldown active')
        self.assertEqual(len(http.calls), 2)

    def test_publication_year_disagreement(self):
        self.http.responses = [self.response('openalex', lambda d: d.update(publication_year=2020)),
                               self.response('crossref', lambda d: d['message'].update(published={'date-parts': [[2021]]}))]
        self.assertEqual(self.adapter.acquire(DOI)['status'], 'conflict')

    def test_cache_rejects_public_files_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'public'
            path.write_text('')
            path.chmod(0o644)
            with self.assertRaises(ResearchError):
                SQLiteCache(path)
            link = Path(directory) / 'link'
            link.symlink_to(path)
            with self.assertRaises(OSError):
                SQLiteCache(link)

    def test_invalid_bounds(self):
        for kwargs in ({'attempts': 0}, {'max_bytes': 0}, {'timeout': 61}, {'interval': float('nan')}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ResearchError):
                ResearchAdapter(self.http, self.cache, **kwargs)


if __name__ == '__main__':
    unittest.main()
