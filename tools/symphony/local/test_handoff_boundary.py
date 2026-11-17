"""Preservation and host boundary tests; no remote services or model sessions."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import handoff
import publish as p
import workpad as w


class HandoffBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.path = self.root / 'SHE-123'
        (self.path / '.git').mkdir(parents=True)
        self.directory = handoff.directory(self.path)
        self.state = self.root / 'host-state'
        self.state.mkdir(mode=0o700)
        state_patch = patch.object(p, 'STATE', self.state)
        state_patch.start(); self.addCleanup(state_patch.stop)

    def test_atomic_snapshot_replaces_symlink_without_clobbering_target(self):
        outside = self.root / 'valuable-state'
        outside.write_text('retained')
        (self.directory / 'workpad.md').symlink_to(outside)
        handoff.snapshot(self.directory, 'workpad.md', 'new snapshot')
        self.assertEqual(outside.read_text(), 'retained')
        self.assertEqual((self.directory / 'workpad.md').read_text(), 'new snapshot')
        self.assertFalse((self.directory / 'workpad.md').is_symlink())

    def test_simultaneous_legacy_and_source_requests_are_preserved(self):
        modern = self.directory / 'publish.json'
        legacy = self.path / '.git/hbl-publish.json'
        modern.write_text('{}'); legacy.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'Both'):
            handoff.pending(self.path, 'publish')
        self.assertTrue(modern.exists() and legacy.exists())

    def test_replaced_request_during_remote_sync_is_not_deleted(self):
        request = self.directory / 'workpad.json'
        request.write_text(json.dumps({'status': 'progress', 'notes': 'first update'}))
        data = {'id': 'issue-id', 'identifier': 'SHE-123', 'state': {'name': 'In Progress'},
                'labels': {'nodes': [{'id': 'pilot', 'name': 'symphony-pilot'}]}}
        pad = {'id': 'workpad-id', 'body': '## Codex Workpad\nRetained history'}
        def replace(*args):
            temporary = self.directory / 'next.json'
            temporary.write_text(json.dumps({'status': 'progress', 'notes': 'newer update'}))
            temporary.replace(request)
        with patch.object(p, 'validate', return_value='SHE-123'), patch.object(w, 'issue_data', return_value=data), patch.object(w, 'ensure', return_value=pad), patch.object(w, 'success', side_effect=replace):
            with self.assertRaisesRegex(p.PublicationError, 'replaced'):
                w.sync(self.path, 'after')
        self.assertEqual(json.loads(request.read_text())['notes'], 'newer update')

    def test_terminal_handoff_missing_publication_artifact_is_not_no_request(self):
        (self.state / 'workpad-status').mkdir()
        (self.state / 'workpad-status/SHE-123.json').write_text(json.dumps({'status': 'handoff'}))
        with self.assertRaisesRegex(p.PublicationError, 'never repeat'):
            p.publish(self.path, self.root)

    def test_version_two_requires_successful_terminal_workpad_sync(self):
        (self.directory / 'publish.json').write_text(json.dumps({'version': 2}))
        with self.assertRaisesRegex(p.PublicationError, 'terminal'):
            p.publish(self.path, self.root)

    def test_handoff_file_and_parent_symlinks_are_never_read(self):
        outside = self.root / 'private.json'
        outside.write_text('{"not":"worker data"}')
        (self.directory / 'publish.json').symlink_to(outside)
        with self.assertRaises(OSError):
            handoff.read(self.directory / 'publish.json')


if __name__ == '__main__':
    unittest.main()
