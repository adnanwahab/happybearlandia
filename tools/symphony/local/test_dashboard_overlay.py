import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('overlay', Path(__file__).with_name('install_dashboard_overlay.py'))
o = importlib.util.module_from_spec(spec)
spec.loader.exec_module(o)


class OverlayTest(unittest.TestCase):
    def fixture(self, root):
        (root / 'mix.exs').write_text('symphony_elixir')
        for name, content in {
            o.PRESENTER: '    get("/api/v1/state", ObservabilityApiController, :state)\n',
            o.DASHBOARD: '      |> assign(:payload, load_payload())\n        <section class="metric-grid">\n    {:noreply, assign(socket, :now, DateTime.utc_now())}\n',
        }.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    def test_apply_and_verified_restore_preserve_original_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'elixir'; root.mkdir()
            self.fixture(root)
            originals = {n: (root/n).read_bytes() for n in [o.PRESENTER, o.DASHBOARD]}
            backup = Path(directory) / 'backup'
            o.install(root, backup)
            self.assertEqual([], [k for k,(a,b) in o.changes(root).items() if a != b])
            self.assertTrue(o.restore(root, backup)['restored'])
            for n, value in originals.items(): self.assertEqual(value, (root/n).read_bytes())
            self.assertTrue((root/o.MODULE).exists())

    def test_changed_source_fails_before_any_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            original = (root/o.PRESENTER).read_bytes()
            (root/o.DASHBOARD).write_text('new unrelated code')
            with self.assertRaises(ValueError): o.install(root, root/'backup')
            self.assertFalse((root/'backup').exists())
            self.assertEqual(original, (root/o.PRESENTER).read_bytes())

    def test_restore_refuses_to_clobber_newer_edits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            backup = root/'backup'; o.install(root, backup)
            (root/o.PRESENTER).write_text('new owner changes')
            with self.assertRaises(ValueError): o.restore(root, backup)
            self.assertEqual('new owner changes', (root/o.PRESENTER).read_text())


if __name__ == '__main__': unittest.main()
