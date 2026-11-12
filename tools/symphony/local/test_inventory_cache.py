"""Real cache filesystem tests with counted fake inventory; no external services."""
import copy
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest

import coordinator_host as host
from inventory_cache import InventoryCache


def snapshot(now):
    return dict(issues=[dict(id='issue-id', identifier='SHE-1', state='Todo', labels={},
                            comments=[], blockedBy=[], attachments=[])], prs=[],
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
