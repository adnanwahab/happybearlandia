"""Synthetic queue evidence; no credentials, remote mutations or dispatcher."""
import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import backlog_coordinator as c
from test_backlog_coordinator import FakeServices, issue, review
from test_scan_batch import BatchedAPI, source_issue


class QueueReportTest(unittest.TestCase):
    def test_matches_hold_open_and_closed_items_without_writes(self):
        items = [issue(n) for n in range(1, 5)]
        items[2]['attachments'] = [{'url': 'https://github.com/example/repo/issues/93/'}]
        services = FakeServices(items)
        services.snapshot['githubIssues'] = [
            dict(number=91, title='Port SHE-1', body='', state='open', html_url='https://example.invalid/91'),
            dict(number=92, title=items[1]['title'].upper(), body='', state='closed', html_url='https://example.invalid/92'),
            dict(number=93, title='Alias', body='', state='open', html_url='https://github.com/example/repo/issues/93'),
            dict(number=94, title='SHE-40 is unrelated', body='', state='open', html_url='https://example.invalid/94')]
        config = dict(version=1, projectId=c.PROJECT, cap=3, enableApprovals=True,
                      reviews={i['id']: review(i) for i in items})
        before = copy.deepcopy(services.snapshot)
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / 'absent-state'
            result = c.cycle(services, config, directory)
            self.assertFalse(directory.exists())
        self.assertEqual(services.snapshot, before)
        self.assertEqual(services.calls, [])
        self.assertEqual(result['selected'], ['SHE-4'])
        for row, number in zip(result['issues'], [91, 92, 93]):
            self.assertFalse(row['eligible'])
            self.assertEqual(row['matchingGitHubIssues'][0]['number'], number)
            self.assertTrue(row['reasons'])
            self.assertIn('#' + str(number), c.render(result))
        self.assertEqual(result['issues'][3]['matchingGitHubIssues'], [])

    def test_scanner_reads_all_issue_pages_and_excludes_prs(self):
        services = c.Services()
        github_issue = dict(number=1, title='SHE-1', body='', state='closed', html_url='https://example.invalid/1')
        def pages(endpoint):
            if '/issues?' in endpoint:
                return [github_issue, dict(github_issue, number=2, pull_request={})]
            return []
        with patch.object(c.host, 'linear', side_effect=BatchedAPI([source_issue(1)])), \
                patch.object(services, 'github_pages', side_effect=pages) as reads, \
                patch.object(services, 'github', return_value={'object': {'sha': 'a' * 40}}):
            result = services.scan()
        self.assertEqual(result['githubIssues'], [github_issue])
        self.assertTrue(any('/issues?state=all&per_page=100' in call.args[0] for call in reads.call_args_list))

    def test_incomplete_github_issues_aborts_before_approval(self):
        services = c.Services()
        with patch.object(c.host, 'linear', side_effect=BatchedAPI([source_issue(1)])), \
                patch.object(services, 'github', side_effect=[[], {'incomplete': True}]), \
                patch.object(services, 'approve') as approve:
            with self.assertRaises(c.host.PublicationError):
                services.scan()
        approve.assert_not_called()
