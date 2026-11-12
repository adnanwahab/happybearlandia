import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import install_lifecycle_overlay as o


class LifecycleOverlayTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)/'runtime'; self.root.mkdir()
        self.bundle = Path(self.temp.name)/'bundle'; self.bundle.mkdir()
        self.patch = patch.object(o, 'BUNDLE', self.bundle); self.patch.start(); self.addCleanup(self.patch.stop)
        manifest = {}; hunks = ''
        for name in sorted(o.FILES):
            target = self.root/name; target.parent.mkdir(parents=True, exist_ok=True); target.write_text('original\n')
            manifest[name] = {'before': o.sha(b'original\n'), 'after': o.sha(b'updated\n')}
            hunks += f'--- a/{name}\n+++ b/{name}\n@@ -1 +1 @@\n-original\n+updated\n'
        (self.bundle/'handoff-lifecycle.json').write_text(json.dumps({'version': 1, 'files': manifest}))
        (self.bundle/'handoff-lifecycle.patch').write_text(hunks)
        for name in o.TESTS: (self.bundle/name).write_text('new focused tests\n')

    def test_check_apply_idempotence_and_verified_restore(self):
        self.assertEqual(len(o.install(self.root)['changed_files']), len(o.FILES)+len(o.TESTS))
        backup = Path(self.temp.name)/'backup'
        o.install(self.root, backup)
        self.assertEqual(o.install(self.root)['changed_files'], [])
        self.assertTrue(o.restore(self.root, backup)['restored'])
        for name in o.FILES: self.assertEqual((self.root/name).read_text(), 'original\n')
        for name in o.TESTS: self.assertTrue((self.root/'test/symphony_elixir'/name).exists())

    def test_changed_pinned_source_fails_before_backup_or_write(self):
        target = self.root/sorted(o.FILES)[0]; target.write_text('other owner\n')
        backup = Path(self.temp.name)/'backup'
        with self.assertRaises(ValueError): o.install(self.root, backup)
        self.assertFalse(backup.exists())
        self.assertEqual(target.read_text(), 'other owner\n')

    def test_newer_test_and_symlink_are_preserved(self):
        target = self.root/'test/symphony_elixir'/o.TESTS[0]; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('existing test owner\n')
        with self.assertRaises(ValueError): o.install(self.root)
        self.assertEqual(target.read_text(), 'existing test owner\n')
        source = self.root/sorted(o.FILES)[0]; source.unlink(); source.symlink_to(target)
        with self.assertRaises(ValueError): o.install(self.root)

    def test_interrupted_install_can_be_restored_twice_without_losing_newer_edits(self):
        import os
        real_replace = os.replace
        count = [0]
        def interrupted(*args, **kwargs):
            count[0] += 1
            if count[0] == 2: raise OSError('simulated interruption')
            return real_replace(*args, **kwargs)
        backup = Path(self.temp.name)/'backup'
        with patch.object(o.os, 'replace', side_effect=interrupted):
            with self.assertRaises(OSError): o.install(self.root, backup)
        self.assertTrue(o.restore(self.root, backup)['restored'])
        self.assertTrue(o.restore(self.root, backup)['restored'])
        for name in o.FILES: self.assertEqual((self.root/name).read_text(), 'original\n')

    def test_restore_refuses_newer_source(self):
        backup = Path(self.temp.name)/'backup'; o.install(self.root, backup)
        target = self.root/sorted(o.FILES)[0]; target.write_text('later work\n')
        with self.assertRaises(ValueError): o.restore(self.root, backup)
        self.assertEqual(target.read_text(), 'later work\n')


if __name__ == '__main__': unittest.main()
