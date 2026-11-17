"""Offline scanner equivalence/cost checks. No services, credentials or agents."""
import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import backlog_coordinator as c
import coordinator_host as host


def connection(nodes, more=False, cursor=None):
    return {'nodes': copy.deepcopy(nodes), 'pageInfo': {'hasNextPage': more, 'endCursor': cursor}}


def source_issue(n):
    return dict(id=f'id-{n}', identifier=f'SHE-{n}', title=f'Independent task {n}',
                description='No prerequisites.', priority=3, updatedAt='2026-11-11T00:00:00Z',
                archivedAt=None, state={'name': 'Todo'}, team={'id': 'team'},
                comments=[{'id': f'comment-{n}', 'body': 'Existing diagnostic'}],
                labels=[{'id': 'label', 'name': c.REVIEW_LABEL}], inverseRelations=[],
                relations=[], attachments=[])


def normalized(node):
    result = copy.deepcopy(node)
    result['state'] = node['state']['name']
    result['blockedBy'] = [x['issue'] for x in result.pop('inverseRelations') if x['type'] == 'blocks']
    result['labels'] = {x['name']: x['id'] for x in result['labels']}
    return result


class BatchedAPI:
    def __init__(self, issues):
        self.issues = copy.deepcopy(issues)
        self.calls = []

    def __call__(self, query, variables):
        self.calls.append((query, variables))
        if 'issues(first:' in query:
            offset = int(variables['after'] or 0)
            batch = self.issues[offset:offset + c.Services.issue_page_size]
            nodes = []
            for original in batch:
                node = copy.deepcopy(original)
                for field, _ in c.Services.connection_fields:
                    values = original[field]
                    more = len(values) > c.Services.nested_page_size
                    node[field] = connection(values[:c.Services.nested_page_size], more,
                                             f'{field}:{c.Services.nested_page_size}' if more else None)
                nodes.append(node)
            end = offset + len(batch)
            return {'issues': connection(nodes, end < len(self.issues), str(end) if end < len(self.issues) else None)}
        field = next(field for field, _ in c.Services.connection_fields if field + '(first:' in query)
        original = next(x for x in self.issues if x['id'] == variables['id'])
        offset = int(variables['after'].split(':')[1])
        return {'issue': {field: connection(original[field][offset:])}}


def scan(api):
    services = c.Services()
    with patch.object(host, 'linear', side_effect=api), \
            patch.object(services, 'github_pages', return_value=[]), \
            patch.object(services, 'github', return_value={'object': {'sha': 'a' * 40}}):
        return services.scan()


class BatchScanTest(unittest.TestCase):
    def test_175_issue_inventory_and_digests_match_prior_shape_with_18_queries(self):
        raw = [source_issue(n) for n in range(1, 176)]
        api = BatchedAPI(raw)
        result = scan(api)
        expected = [normalized(x) for x in raw]
        self.assertEqual(result['issues'], expected)
        self.assertEqual([c.digest(x) for x in result['issues']], [c.digest(x) for x in expected])
        self.assertEqual(len(api.calls), 18)
        self.assertEqual(result['scanMetrics']['linearQueryCalls'], 18)
        self.assertEqual(result['scanMetrics']['nestedContinuationCalls'], 0)
        self.assertGreaterEqual(result['scanMetrics']['elapsedSeconds'], 0)
        # Previous observed algorithm: two project pages + five calls per issue.
        self.assertEqual(2 + 5 * len(raw), 877)
        self.assertTrue(all('includeArchived:true' in query for query, _ in api.calls))

    def test_every_truncated_connection_retains_initial_nodes_and_continues_cursor(self):
        item = source_issue(1)
        item['comments'] = [{'id': f'c-{n}', 'body': str(n)} for n in range(45)]
        item['labels'] = [{'id': f'l-{n}', 'name': f'label-{n}'} for n in range(23)]
        item['inverseRelations'] = [{'type': 'blocks', 'issue': {'identifier': f'SHE-{n + 2}', 'state': {'name': 'Done'}}} for n in range(21)]
        item['relations'] = [{'type': 'related', 'relatedIssue': {'identifier': f'SHE-{n + 2}', 'state': {'name': 'Todo'}}} for n in range(22)]
        item['attachments'] = [{'id': f'a-{n}', 'title': str(n), 'url': f'https://example.invalid/{n}'} for n in range(24)]
        api = BatchedAPI([item])
        result = scan(api)
        self.assertEqual(result['issues'], [normalized(item)])
        self.assertEqual(len(api.calls), 6)
        self.assertEqual(result['scanMetrics']['nestedContinuationCalls'], 5)
        self.assertEqual({v['after'] for _, v in api.calls[1:]},
                         {field + ':20' for field, _ in c.Services.connection_fields})

    def test_malformed_embedded_connections_fail_closed(self):
        for bad in [None, {}, {'nodes': [], 'pageInfo': {}},
                    {'nodes': [], 'pageInfo': {'hasNextPage': 'false', 'endCursor': None}},
                    {'nodes': {}, 'pageInfo': {'hasNextPage': False, 'endCursor': None}},
                    connection([], True, None)]:
            base = BatchedAPI([source_issue(1)])
            def api(query, variables):
                result = base(query, variables)
                if 'issues' in result:
                    result['issues']['nodes'][0]['comments'] = bad
                return result
            with self.subTest(bad=bad), self.assertRaises(host.PublicationError):
                scan(api)

    def test_nested_cyclic_cursor_and_outer_duplicate_inventory_abort(self):
        item = source_issue(1)
        item['comments'] *= 21
        base = BatchedAPI([item])
        def cyclic(query, variables):
            result = base(query, variables)
            if 'issue' in result:
                result['issue']['comments']['pageInfo'] = {'hasNextPage': True, 'endCursor': 'comments:20'}
            return result
        with self.assertRaises(host.PublicationError):
            scan(cyclic)
        with self.assertRaises(host.PublicationError):
            scan(BatchedAPI([source_issue(1), source_issue(1)]))

    def test_scan_schema_failure_cannot_approve_or_persist_a_lease(self):
        services = c.Services()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch.object(host, 'linear', return_value={'issues': {'nodes': [], 'pageInfo': {}}}), \
                    patch.object(services, 'approve') as approve:
                with self.assertRaises(host.PublicationError):
                    c.cycle(services, {'version': 1, 'projectId': c.PROJECT}, root, True)
                approve.assert_not_called()
                self.assertFalse((root / 'leases.json').exists())

    def test_github_request_and_retry_counts_are_measured_without_outputs(self):
        services = c.Services()
        failed = type('Result', (), {'returncode': 1, 'stdout': 'private', 'stderr': 'private'})()
        good = type('Result', (), {'returncode': 0, 'stdout': '{}'})()
        with patch.object(c.subprocess, 'run', side_effect=[failed, good]), patch.object(c.time, 'sleep'):
            self.assertEqual(services.github('read-only-endpoint'), {})
        self.assertEqual(services.scan_metrics['githubCommandCalls'], 2)
        self.assertEqual(services.scan_metrics['githubRetries'], 1)
        self.assertNotIn('private', str(services.scan_metrics))


if __name__ == '__main__':
    unittest.main()
