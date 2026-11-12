"""Bounded DOI singleton lookups using caller-owned HTTP, cache and sink objects."""
from dataclasses import dataclass
from datetime import datetime, timezone
import copy
import hashlib
import json
import math
import os
import re
import sqlite3
import stat
import time
import unicodedata
from typing import Protocol
from urllib.parse import quote, unquote


class ResearchError(ValueError):
    """Safe classifications, never response bodies or credentials."""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def normalize_doi(value):
    if not isinstance(value, str) or len(value) > 512:
        raise ResearchError('invalid DOI')
    value = unquote(re.sub(r'^(https?://(dx\.)?doi\.org/|doi:)', '', value.strip(), flags=re.I)).lower()
    if not re.fullmatch(r'10\.[0-9]{4,9}/[^\s?#]+', value) or any(
            unicodedata.category(c).startswith('C') for c in value):
        raise ResearchError('invalid DOI')
    return value


def title_key(value):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKC', value).casefold()))


@dataclass(frozen=True)
class Response:
    status: int
    headers: dict
    body: bytes


class HTTP(Protocol):
    def get(self, url, *, headers, timeout, max_bytes) -> Response:
        """Enforce timeout/body cap, disable redirects, raise OSError on transport failure."""


class Cache(Protocol):
    def get(self, key): ...
    def put(self, key, value): ...


class ProposalSink(Protocol):
    def submit(self, proposal):
        """Accept v1 proposal data; caller owns validation, persistence and replay."""


class SQLiteCache:
    """Caller-selected private cache. No default path, background IO or core stores."""
    def __init__(self, path):
        fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o077:
                raise ResearchError('cache must be private and single-linked')
        finally:
            os.close(fd)
        self.db = sqlite3.connect(path, timeout=2)
        self.db.execute('CREATE TABLE IF NOT EXISTS research_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)')

    def get(self, key):
        row = self.db.execute('SELECT value FROM research_cache WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key, value):
        with self.db:
            self.db.execute('INSERT OR REPLACE INTO research_cache VALUES (?, ?)',
                            (key, json.dumps(value, sort_keys=True, allow_nan=False)))

    def close(self):
        self.db.close()


@dataclass
class Budget:
    """Run-scoped conservative reservation, charged before every attempt including failures."""
    max_requests: int = 8
    max_cost_units: int = 8
    requests: int = 0
    cost_units: int = 0

    def __post_init__(self):
        for value in (self.max_requests, self.max_cost_units, self.requests, self.cost_units):
            if type(value) is not int or value < 0:
                raise ResearchError('invalid budget')

    def reserve(self, cost):
        if self.requests >= self.max_requests or self.cost_units + cost > self.max_cost_units:
            raise ResearchError('request/cost budget exhausted')
        self.requests += 1
        self.cost_units += cost


class ResearchAdapter:
    VERSION = 'research-card.v1'

    def __init__(self, http: HTTP, cache: Cache, *, budget=None, now=None,
                 sleep=time.sleep, monotonic=time.monotonic, attempts=3,
                 timeout=10, max_bytes=262144, interval=1.0, max_wait=30,
                 ttl=86400, cost_per_request=1, headers=None):
        if not isinstance(attempts, int) or not 1 <= attempts <= 5:
            raise ResearchError('invalid attempt limit')
        if not isinstance(max_bytes, int) or not 1 <= max_bytes <= 1048576:
            raise ResearchError('invalid response limit')
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v <= 0
               for v in (timeout, interval, max_wait, ttl, cost_per_request)):
            raise ResearchError('invalid request bounds')
        if timeout > 60 or max_wait > 60:
            raise ResearchError('request bounds too large')
        self.http, self.cache = http, cache
        self.budget = budget if budget is not None else Budget()
        self.now = now or (lambda: datetime.now(timezone.utc))
        self.sleep, self.monotonic = sleep, monotonic
        self.attempts, self.timeout, self.max_bytes = attempts, timeout, max_bytes
        self.interval, self.max_wait, self.ttl = interval, max_wait, ttl
        self.cost = cost_per_request
        self.headers = headers or {}
        self.last = {}
        self.cooldown = {}

    def _fetch(self, provider, doi, refresh):
        key = 'metadata:v1:' + provider + ':' + doi
        cached = self.cache.get(key)
        stamp = self.now().timestamp()
        if cached and not refresh and 0 <= stamp - cached['timestamp'] < self.ttl:
            return cached['record']
        if self.cooldown.get(provider, -math.inf) > self.monotonic():
            raise ResearchError('provider cooldown active')
        base = ('https://api.openalex.org/works/https://doi.org/' if provider == 'openalex'
                else 'https://api.crossref.org/works/')
        for attempt in range(self.attempts):
            delay = max(0, self.last.get(provider, -math.inf) + self.interval - self.monotonic())
            if delay > self.max_wait:
                raise ResearchError('rate wait exceeds bound')
            if delay:
                self.sleep(delay)
            self.budget.reserve(self.cost)
            self.last[provider] = self.monotonic()
            try:
                response = self.http.get(base + quote(doi, safe=''), headers=dict(self.headers.get(provider, {})),
                                         timeout=self.timeout, max_bytes=self.max_bytes)
            except (OSError, TimeoutError):
                response = Response(503, {}, b'')
            if response.status == 200:
                if not isinstance(response.body, bytes) or len(response.body) > self.max_bytes:
                    raise ResearchError('response exceeds bound')
                try:
                    data = json.loads(response.body)
                    record = self._normalize(provider, doi, data)
                except (KeyError, TypeError, ValueError, AttributeError, IndexError, RecursionError):
                    raise ResearchError('invalid provider metadata') from None
                self.cache.put(key, {'timestamp': stamp, 'record': record})
                return record
            if response.status == 404:
                raise ResearchError('source unavailable')
            if response.status not in (429, 500, 502, 503, 504):
                raise ResearchError('provider rejected request')
            headers = {k.lower(): v for k, v in response.headers.items()}
            wait = min(2 ** attempt, self.max_wait)
            if 'retry-after' in headers:
                try:
                    wait = float(headers['retry-after'])
                except (ValueError, TypeError):
                    # Unknown/date retry deadlines must not be retried prematurely.
                    self.cooldown[provider] = math.inf
                    raise ResearchError('unsupported retry deadline') from None
            if not math.isfinite(wait) or wait < 0:
                self.cooldown[provider] = math.inf
                raise ResearchError('invalid retry deadline')
            self.cooldown[provider] = self.monotonic() + wait
            if wait > self.max_wait:
                raise ResearchError('retry wait exceeds bound')
            if attempt + 1 == self.attempts:
                break
            self.sleep(wait)
        raise ResearchError('retry exhausted')

    def _normalize(self, provider, doi, data):
        if provider == 'openalex':
            if not re.fullmatch(r'https://openalex.org/W[1-9][0-9]*', data['id']):
                raise ResearchError('invalid work identity')
            title = data['title']
            source_id, actual = data['id'], data['doi']
            location = data.get('best_oa_location') or {}
            licenses = [location['license']] if location.get('license') else []
            full_text = bool(location.get('pdf_url') or data.get('has_fulltext'))
            year = data.get('publication_year')
            topics = sorted(set(t['id'] for t in data.get('topics', [])
                                if re.fullmatch(r'https://openalex.org/T[1-9][0-9]*', t['id'])))
        else:
            data = data['message']
            title, actual = data['title'][0], data['DOI']
            source_id = 'doi:' + normalize_doi(actual)
            licenses = sorted(set(item['URL'] for item in data.get('license', []) if item.get('URL')))
            full_text = bool(data.get('link'))
            topics = []
            parts = (data.get('published') or {}).get('date-parts', [])
            year = parts[0][0] if parts and parts[0] else None
        if year is not None and (type(year) is not int or not 1000 <= year <= 9999):
            raise ResearchError('invalid publication year')
        if normalize_doi(actual) != doi:
            raise ResearchError('DOI disagreement')
        if not isinstance(title, str) or not title_key(title) or len(title) > 2000:
            raise ResearchError('invalid title')
        content = {'provider': provider, 'sourceId': source_id, 'doi': doi, 'title': title,
                   'licenses': licenses, 'licenseAvailable': bool(licenses),
                   'fullTextAvailable': full_text, 'fullTextRetrieved': False, 'topics': topics,
                   'publicationYear': year}
        return {**content, 'revision': digest(content), 'retrievedAt': self.now().isoformat()}

    def acquire(self, doi, *, refresh=False):
        doi = normalize_doi(doi)
        records, failures = [], {}
        for provider in ('openalex', 'crossref'):
            try:
                records.append(self._fetch(provider, doi, refresh))
            except ResearchError as error:
                failures[provider] = str(error)
        conflict = (len({title_key(r['title']) for r in records}) > 1 or
                    len({r['publicationYear'] for r in records if r['publicationYear'] is not None}) > 1)
        status = 'conflict' if conflict or any(v in ('invalid provider metadata', 'DOI disagreement') for v in failures.values()) else (
            'agreed' if len(records) == 2 else 'partial' if records else 'unavailable')
        card = {'schemaVersion': self.VERSION, 'paperId': 'doi:' + doi, 'doi': doi,
                'status': status, 'records': records, 'failures': failures,
                'evidenceClass': 'metadata-only', 'mechanisms': [],
                'limitations': ['Metadata and abstracts do not demonstrate an effect.',
                                'Full text and source-backed mechanisms have not been reviewed.']}
        self.cache.put('paper:v1:' + doi, card)
        for topic in sorted({t for r in records for t in r['topics']}):
            key = 'topic:v1:' + topic
            self.cache.put(key, sorted(set((self.cache.get(key) or []) + [card['paperId']])))
        return copy.deepcopy(card)

    def propose(self, card, sink: ProposalSink, *, hypothesis, acceptance, test_argv,
                dependencies=(), target_issue=None):
        """Explicit caller-authored model hypothesis; never infer empirical coefficients."""
        if card['status'] != 'agreed' or card['evidenceClass'] != 'metadata-only':
            raise ResearchError('agreed metadata required')
        # Lazy use of the coordinator-owned contract; no core persistence integration.
        from ops.improvement.proposal import validate_proposal
        doi = normalize_doi(card['doi'])
        sources = [{'type': 'paper', 'id': 'doi:' + doi,
                    'revision': digest(sorted((r['provider'], r['revision']) for r in card['records'])),
                    'url': 'https://doi.org/' + quote(doi, safe='/:;()._-'), 'evidence': 'metadata-only'}]
        proposal = validate_proposal({
            'schemaVersion': 'improvement-proposal.v1', 'kind': 'research',
            'title': 'Research review: ' + card['records'][0]['title'][:140],
            'hypothesis': 'Model hypothesis (not an established effect): ' + hypothesis,
            'sources': sources, 'acceptanceCriteria': list(acceptance),
            'testCommands': copy.deepcopy(test_argv), 'dependencies': list(dependencies),
            'deduplicationKeys': ['research:doi:' + digest(doi)], 'targetIssue': target_issue})
        sink.submit(copy.deepcopy(proposal))
        return proposal
