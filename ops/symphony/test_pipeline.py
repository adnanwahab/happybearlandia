"""Offline checks for the opt-in Symphony dispatch pipeline."""
import contextlib
import io
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_25h
import seed_ready_issues


class SymphonyConfigTests(unittest.TestCase):
    def test_worker_render_bounds(self):
        for count in (1, 6, 50):
            result = run_25h.render_workflow(count)
            self.assertIn(f"max_concurrent_agents: {count}", result)
            self.assertNotIn("__MAX_WORKERS__", result)
            self.assertIn("hbl-agent-ready", result)
            self.assertIn("sprint/one-city-two-futures-20261111", result)
        for count in (0, 51, -1):
            with self.assertRaises(ValueError):
                run_25h.render_workflow(count)

    def test_dry_run_never_launches_agent(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(0, run_25h.main(["--workers", "6"]))
        self.assertIn("Dry run only", out.getvalue())

    def test_scale_requires_explicit_acknowledgment(self):
        with self.assertRaises(SystemExit) as caught:
            run_25h.main(["--workers", "50"])
        self.assertEqual(2, caught.exception.code)

    def test_scaled_dry_run_without_secrets(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(0, run_25h.main(["--workers", "50", "--ack-scale"]))
        self.assertIn("max_concurrent_agents: 50", out.getvalue())


class IntakeTests(unittest.TestCase):
    def test_parses_real_curated_queue(self):
        queue = seed_ready_issues.parse_ready_table(
            seed_ready_issues.BACKLOG.read_text(encoding="utf-8"))
        self.assertTrue(seed_ready_issues.FIRST_WAVE.issubset(queue.keys()))
        self.assertIn("verification", queue["R01"])
        self.assertIn("ownership", queue["R01"])
        self.assertIn("READY", queue["R01"]["priority"])

    def test_preview_no_token_or_network(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(0, seed_ready_issues.main(["--ids", "R01", "R02"]))
        self.assertIn("PREVIEW ONLY", out.getvalue())

    def test_missing_task_is_an_error(self):
        with self.assertRaises(SystemExit) as caught:
            seed_ready_issues.main(["--ids", "R999"])
        self.assertEqual(2, caught.exception.code)

    def test_dependent_task_cannot_auto_dispatch(self):
        with self.assertRaises(SystemExit) as caught:
            seed_ready_issues.main([
                "--apply", "--ids", "R06", "--dispatch-first-wave"])
        self.assertEqual(2, caught.exception.code)


if __name__ == "__main__":
    unittest.main()
