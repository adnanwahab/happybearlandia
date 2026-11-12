"""Real cache filesystem tests with counted fake inventory; no external services."""
import copy
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

import inventory_cache as cache_module

import coordinator_host as host
from inventory_cache import InventoryCache


def snapshot(now):
    return dict(issues=[dict(id='issue-id', identifier='SHE-1', title='Observed task',
                            description=None, state='Todo', team={'id': 'team-id'}, labels={},
                            comments=[], blockedBy=[], relations=[], attachments=[])], prs=[],
                baseSha='a' * 40, scannedAt=now, scanMetrics={'linearQueryCalls': 18})


class Services:
    def __init__(self, clock):
        self.clock, self.calls, self.fail, self.invalid = clock, 0, False, False

    def scan(self):
        self.calls += 1
        if self.fail:
            raise host.PublicationError('Offline service failure')
        return {} if self.invalid else snapshot(self.clock())


class InventoryCacheTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name) / 'inventory'
        self.now = 1000
        self.services = Services(lambda: self.now)
        self.cache = InventoryCache(self.services, self.directory, clock=lambda: self.now)
        self.file = self.directory / 'inventory.json'

    def test_observation_reuses_real_receipt_and_preserves_source_scan_counts(self):
        first = self.cache.scan(observation=True)
        self.now += 60
        second = self.cache.scan(observation=True)
        self.assertEqual(self.services.calls, 1)
        self.assertFalse(first['inventoryCache']['hit'])
        self.assertEqual(second['inventoryCache'], dict(hit=True, ageSeconds=60, ttlSeconds=300,
                                                       observationOnly=True))
        self.assertEqual(second['scanMetrics']['linearQueryCalls'], 18)
        restarted = InventoryCache(self.services, self.directory, clock=lambda: self.now)
        self.assertTrue(restarted.scan(observation=True)['inventoryCache']['hit'])
        self.assertEqual(self.services.calls, 1)

    def test_default_and_apply_bypass_even_unsafe_existing_cache(self):
        self.directory.mkdir(mode=0o700)
        self.file.symlink_to('/nonexistent-private-fixture')
        for mode in ({}, {'apply': True}, {'observation': True, 'apply': True}):
            self.assertFalse(self.cache.scan(**mode)['inventoryCache']['hit'])
        self.assertEqual(self.services.calls, 3)
        self.assertTrue(self.file.is_symlink())

    def test_apply_never_creates_a_cache_directory_or_reuses_observation_data(self):
        self.cache.scan(apply=True)
        self.assertFalse(self.directory.exists())
        self.cache.scan(observation=True)
        self.cache.scan(observation=True, apply=True)
        self.cache.scan(apply=True)
        self.assertEqual(self.services.calls, 4)

    def test_returned_snapshots_are_deep_copies(self):
        self.cache.scan(observation=True)['issues'][0]['comments'].append('caller mutation')
        cached = self.cache.scan(observation=True)
        self.assertEqual(cached['issues'][0]['comments'], [])
        cached['issues'][0]['labels']['untrusted'] = 'mutated'
        self.assertEqual(self.cache.scan(observation=True)['issues'][0]['labels'], {})

    def test_ttl_boundary_refetches_and_invalidations_retain_the_old_snapshot(self):
        self.cache.scan(observation=True)
        old = json.loads(self.file.read_text())['snapshot']
        self.cache.invalidate()
        tombstone = json.loads(self.file.read_text())
        self.assertEqual(tombstone['snapshot'], old)
        self.assertTrue(tombstone['invalidated'])
        self.cache.scan(observation=True)
        self.now += 300
        self.cache.scan(observation=True)
        self.assertEqual(self.services.calls, 3)

    def test_stale_cache_service_failure_preserves_receipt_and_never_falls_back(self):
        self.cache.scan(observation=True)
        old = self.file.read_bytes()
        self.now += 301
        self.services.fail = True
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)
        self.assertEqual(self.file.read_bytes(), old)
        self.assertEqual(self.services.calls, 2)

    def test_corrupt_future_invalid_version_and_incomplete_receipts_refetch(self):
        malformed = [b'not json', b'[]', b'null',
                     json.dumps(dict(version=2, cachedAt=1000, snapshot=snapshot(1000))).encode(),
                     json.dumps(dict(version=1, cachedAt=1001, snapshot=snapshot(1000))).encode(),
                     json.dumps(dict(version=1, cachedAt=True, snapshot=snapshot(1000))).encode(),
                     json.dumps(dict(version=1, cachedAt=1000, snapshot={})).encode(),
                     json.dumps(dict(version=1, cachedAt=1000, snapshot=snapshot(1001))).encode()]
        self.directory.mkdir(mode=0o700)
        for payload in malformed:
            self.file.write_bytes(payload)
            self.file.chmod(0o600)
            before = self.services.calls
            self.assertFalse(self.cache.scan(observation=True)['inventoryCache']['hit'])
            self.assertEqual(self.services.calls, before + 1)

    def test_tampered_required_issue_fields_and_duplicate_identifiers_refetch(self):
        self.cache.scan(observation=True)
        valid = json.loads(self.file.read_text())
        malformed = []
        for field in ['title', 'description', 'team', 'relations']:
            receipt = copy.deepcopy(valid)
            del receipt['snapshot']['issues'][0][field]
            malformed.append(receipt)
        for field, value in [
            ('team', {}), ('comments', [{'id': 'comment-id'}]),
            ('blockedBy', [{'identifier': 'SHE-2'}]),
            ('blockedBy', [{'identifier': 'SHE-2', 'state': {}}]),
            ('attachments', [{'id': 'attachment-id', 'title': 'Evidence'}]),
        ]:
            receipt = copy.deepcopy(valid)
            receipt['snapshot']['issues'][0][field] = value
            malformed.append(receipt)
        duplicate = copy.deepcopy(valid)
        other = copy.deepcopy(duplicate['snapshot']['issues'][0])
        other.update(id='different-id', identifier='she-1')
        duplicate['snapshot']['issues'].append(other)
        malformed.append(duplicate)
        for receipt in malformed:
            with self.subTest(receipt=receipt):
                self.file.write_text(json.dumps(receipt))
                before = self.services.calls
                result = self.cache.scan(observation=True)
                self.assertFalse(result['inventoryCache']['hit'])
                self.assertEqual(self.services.calls, before + 1)
                self.assertEqual(result['issues'], snapshot(self.now)['issues'])

    def test_tampered_pr_missing_link_or_ref_fields_refetches(self):
        self.cache.scan(observation=True)
        valid = json.loads(self.file.read_text())
        pull = dict(number=1, state='open', draft=True, title='SHE-1 implementation', body=None,
                    html_url='https://github.com/adnanwahab/happybearlandia/pull/1',
                    head={'ref': 'symphony/SHE-1', 'sha': 'b' * 40,
                          'repo': {'full_name': 'adnanwahab/happybearlandia'}},
                    base={'ref': 'sprint/one-city-two-futures-20261111',
                          'repo': {'full_name': 'adnanwahab/happybearlandia'}}, files=['feature.py'])
        complete = copy.deepcopy(valid)
        complete['snapshot']['prs'] = [pull]
        self.file.write_text(json.dumps(complete))
        self.assertTrue(self.cache.scan(observation=True)['inventoryCache']['hit'])
        for field in ['html_url', 'head', 'base', 'body', 'draft']:
            receipt = copy.deepcopy(complete)
            del receipt['snapshot']['prs'][0][field]
            self.file.write_text(json.dumps(receipt))
            before = self.services.calls
            self.assertFalse(self.cache.scan(observation=True)['inventoryCache']['hit'])
            self.assertEqual(self.services.calls, before + 1)

    def test_incomplete_fresh_snapshot_preserves_prior_receipt(self):
        self.cache.scan(observation=True)
        old = self.file.read_bytes()
        self.now += 301
        self.services.invalid = True
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)
        self.assertEqual(self.file.read_bytes(), old)

    def test_private_modes_are_created_and_unsafe_file_modes_rejected(self):
        self.cache.scan(observation=True)
        self.assertEqual(stat.S_IMODE(self.directory.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(self.file.stat().st_mode), 0o600)
        self.file.chmod(0o644)
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)
        self.assertEqual(self.services.calls, 1)
        self.file.chmod(0o600)
        self.directory.chmod(0o755)
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)

    def test_symlink_and_hardlink_receipts_and_symlink_directory_fail_closed(self):
        self.directory.mkdir(mode=0o700)
        source = Path(self.temporary.name) / 'elsewhere.json'
        source.write_text(json.dumps(dict(version=1, cachedAt=1000, snapshot=snapshot(1000))))
        source.chmod(0o600)
        self.file.symlink_to(source)
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)
        self.file.unlink()
        os.link(source, self.file)
        with self.assertRaises(host.PublicationError):
            self.cache.invalidate()
        self.file.unlink()
        self.directory.rmdir()
        target = Path(self.temporary.name) / 'target'
        target.mkdir(mode=0o700)
        self.directory.symlink_to(target, target_is_directory=True)
        with self.assertRaises(host.PublicationError):
            self.cache.scan(observation=True)
        self.assertEqual(self.services.calls, 0)

    def test_oversized_private_receipt_holds_before_parsing_and_preserves_bytes(self):
        self.cache.scan(observation=True)
        original = self.file.read_bytes()
        before = self.services.calls
        with patch.object(cache_module, 'MAX_CACHE_BYTES', len(original) - 1), \
                patch.object(cache_module.json, 'loads', side_effect=AssertionError('Must not parse oversized receipt')):
            with self.assertRaisesRegex(host.PublicationError, 'size limit'):
                self.cache.scan(observation=True)
        self.assertEqual(self.file.read_bytes(), original)
        self.assertEqual(self.services.calls, before)

    def test_exact_size_boundary_is_accepted_and_oversized_refresh_retains_old_receipt(self):
        self.cache.scan(observation=True)
        original = self.file.read_bytes()
        with patch.object(cache_module, 'MAX_CACHE_BYTES', len(original)):
            self.assertTrue(self.cache.scan(observation=True)['inventoryCache']['hit'])
        self.now += 301
        original_scan = self.services.scan
        def larger():
            result = original_scan()
            result['issues'][0]['description'] = 'Fixture diagnostic ' * 100
            return result
        with patch.object(self.services, 'scan', side_effect=larger), \
                patch.object(cache_module, 'MAX_CACHE_BYTES', len(original) + 20):
            with self.assertRaisesRegex(host.PublicationError, 'size limit'):
                self.cache.scan(observation=True)
        self.assertEqual(self.file.read_bytes(), original)
        self.assertFalse(any(p.name.startswith('.inventory-') for p in self.directory.iterdir()))

    def test_invalid_ttl_and_mode_do_not_start_any_inventory(self):
        for ttl in [0, 59, 301, True, 60.0]:
            with self.assertRaises(ValueError):
                InventoryCache(self.services, self.directory, ttl)
        for mode in ({'observation': 'yes'}, {'apply': 1}):
            with self.assertRaises(ValueError):
                self.cache.scan(**mode)
        self.assertEqual(self.services.calls, 0)


if __name__ == '__main__':
    unittest.main()
