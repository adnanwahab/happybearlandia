"""Normalize caller-supplied artifact contents with explicit provenance."""
import hashlib
import json
import math
import re
from datetime import datetime
from xml.etree import ElementTree

from ops.improvement.proposal import digest, validate_proposal

PIN_FIELDS = ('modelVersion', 'recipeVersion', 'seeds', 'environment', 'conditions')
ENV_FIELDS = ('hardware', 'os', 'browser', 'renderer')
SHA = re.compile(r'[0-9a-f]{40}\Z')


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone required')
    return result


def provenance(meta, expected, now, max_age, head=True):
    if not isinstance(meta, dict):
        return 'missing provenance'
    if not SHA.fullmatch(str(meta.get('buildSha', ''))):
        return 'missing build SHA'
    if head and (meta.get('headSha') != expected['headSha'] or meta['buildSha'] != expected['headSha']):
        return 'head/build SHA mismatch'
    try:
        age = (instant(now) - instant(meta['recordedAt'])).total_seconds()
        if not 0 <= age <= max_age:
            return 'stale or future evidence'
    except (KeyError, ValueError, TypeError, AttributeError):
        return 'missing measurement time'
    for key in PIN_FIELDS:
        if not meta.get(key) or meta[key] != expected.get(key):
            return f'missing or incompatible {key}'
    if not isinstance(meta['environment'], dict) or not all(meta['environment'].get(k) for k in ENV_FIELDS):
        return 'incomplete environment'
    if meta['environment'].get('supported') is not True:
        return 'unsupported environment'
    return None


def unit_checks(kind, content):
    if kind == 'bun':
        # Bun --reporter=junit output; deliberately reject arbitrary console summaries.
        if '<!DOCTYPE' in content or '<!ENTITY' in content:
            raise ValueError('XML declarations forbidden')
        root = ElementTree.fromstring(content)
        if root.tag not in ('testsuites', 'testsuite'):
            raise ValueError('not JUnit')
        cases = list(root.iter('testcase'))
        rows = []
        for index, case in enumerate(cases):
            status = 'FAIL' if case.find('failure') is not None or case.find('error') is not None else 'NOT_EVALUATED' if case.find('skipped') is not None else 'PASS'
            rows.append((f'bun:{index}', status, 'JUnit testcase'))
        if not rows:
            raise ValueError('no testcases')
        if any(int(s.get('failures', 0)) or int(s.get('errors', 0)) for s in root.iter() if s.tag in ('testsuite', 'testsuites')):
            rows.append(('bun:runner', 'FAIL', 'JUnit aggregate failures'))
        return rows
    rows = []
    def walk(suites):
        for suite in suites:
            for spec in suite.get('specs', []):
                for test in spec['tests']:
                    results = test.get('results', [])
                    statuses = [r['status'] for r in results]
                    status = 'NOT_EVALUATED'
                    if any(s in ('failed', 'timedOut', 'interrupted') for s in statuses):
                        status = 'FAIL'
                    elif statuses and all(s == 'passed' for s in statuses) and test.get('expectedStatus') == 'passed':
                        status = 'PASS'
                    rows.append((f'playwright:{len(rows)}', status, 'Playwright test attempts'))
            walk(suite.get('suites', []))
    walk(content['suites'])
    if content.get('errors'):
        rows.append(('playwright:runner', 'FAIL', 'runner errors'))
    if not rows:
        raise ValueError('no tests')
    return rows


def evaluate(artifact, *, expected, now, max_age_seconds, baseline=None, budgets=None):
    """Return deterministic JSON data. Metadata is an attestation, not verification.

    artifact = {kind, content, provenance, url}; baseline uses the same envelope.
    budgets maps metric to {maxRegressionFraction, source}; lower is better.
    """
    if not SHA.fullmatch(str(expected.get('headSha', ''))) or not finite(max_age_seconds) or max_age_seconds <= 0:
        raise ValueError('explicit head SHA and positive freshness window required')
    def result(rows):
        return {'schemaVersion': 'improvement-evaluation.v1', 'headSha': expected['headSha'],
                'provenance': artifact.get('provenance') if artifact else None,
                'checks': [{'id': i, 'status': s, 'reason': r} for i, s, r in rows]}
    if not artifact:
        return result([('artifact', 'NOT_EVALUATED', 'missing artifact')])
    reason = provenance(artifact.get('provenance'), expected, now, max_age_seconds)
    if reason:
        return result([('artifact', 'NOT_EVALUATED', reason)])
    kind, content = artifact.get('kind'), artifact.get('content')
    try:
        if kind in ('bun', 'playwright'):
            return result(unit_checks(kind, content))
        if kind not in ('renderer', 'visual-pass'):
            return result([('artifact', 'NOT_EVALUATED', 'unsupported artifact format')])
        if kind == 'renderer' and not (finite(content.get('frames')) and content['frames'] > 0 and finite(content.get('durationMs')) and content['durationMs'] > 0):
            raise ValueError('missing measurement window')
        rows = []
        if kind == 'renderer' and content.get('errors'):
            rows.append(('renderer:errors', 'FAIL', 'browser errors recorded'))
        metrics = ('p95FrameMs', 'gpuP95Ms', 'textureBytes') if kind == 'renderer' else ('totalMs',)
        compatible = baseline and baseline.get('kind') == kind and not provenance(baseline.get('provenance'), expected, now, max_age_seconds, head=False)
        base = baseline.get('content', {}) if baseline else {}
        keys = ('backend', 'viewport', 'preset', 'settings') if kind == 'renderer' else ('viewport', 'userAgent')
        if kind == 'renderer':
            compatible = compatible and finite(base.get('frames')) and base['frames'] > 0 and finite(base.get('durationMs')) and base['durationMs'] > 0
        compatible = compatible and all(k in content and content[k] == base.get(k) for k in keys)
        for metric in metrics:
            status, reason = 'NOT_EVALUATED', 'missing compatible measured baseline or recorded budget'
            current = content.get(metric) if kind == 'renderer' else content['timings'].get(metric)
            previous = base.get(metric) if kind == 'renderer' else base.get('timings', {}).get(metric)
            budget = (budgets or {}).get(metric, {})
            if metric == 'gpuP95Ms' or artifact['provenance']['environment']['renderer'] in ('webgpu', 'gpu'):
                reason = 'GPU evaluation unsupported'
            elif not finite(current) or current < 0 or not finite(previous) or previous <= 0:
                reason = 'unknown or invalid measurement'
            elif compatible and finite(budget.get('maxRegressionFraction')) and budget['maxRegressionFraction'] >= 0 and isinstance(budget.get('source'), str) and budget['source'].strip():
                status = 'PASS' if current <= previous * (1 + budget['maxRegressionFraction']) else 'FAIL'
                reason = 'within recorded regression budget' if status == 'PASS' else 'recorded regression budget exceeded'
            rows.append((metric, status, reason))
        return result(rows)
    except (ValueError, TypeError, KeyError, AttributeError, ElementTree.ParseError):
        return result([('artifact', 'NOT_EVALUATED', 'malformed or incomplete artifact')])


def submit_rework(evaluation, artifact, sink):
    """Call injected sink with validated proposal and stable ID; sink owns dedup.

    Never copies artifact commands or raw failure text. Sink errors propagate.
    """
    needs = [c for c in evaluation['checks'] if c['status'] != 'PASS']
    if not needs or not artifact:
        return None
    content = artifact['content']
    raw = content.encode() if isinstance(content, str) else json.dumps(content, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    source = {'type': 'artifact', 'id': 'sha256:' + hashlib.sha256(raw).hexdigest(),
              'revision': artifact['provenance']['buildSha'], 'url': artifact['url'], 'evidence': 'measured'}
    identity = digest({'source': source, 'evaluation': evaluation})
    proposal = validate_proposal({'schemaVersion': 'improvement-proposal.v1', 'kind': 'evaluation',
        'title': 'Repair or supply CI evaluation evidence',
        'hypothesis': 'Rework the recorded failing checks or supply current compatible evidence before acceptance.',
        'sources': [source], 'acceptanceCriteria': [f"{c['id']}: {c['reason']}" for c in needs][:12],
        'testCommands': [['python3', '-m', 'unittest', 'discover', '-s', 'ops/improvement/evaluation', '-p', 'test_*.py']],
        'dependencies': [], 'deduplicationKeys': ['evaluation:' + identity], 'targetIssue': None})
    return sink(identity, proposal)
