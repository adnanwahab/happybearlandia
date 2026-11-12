"""Offline checks for the opt-in Symphony dispatch pipeline."""
import contextlib
import io
import os
import signal
import tempfile
import time
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
        for count in (1, 6):
            result = run_25h.render_workflow(count)
            self.assertIn(f"max_concurrent_agents: {count}", result)
            self.assertNotIn("__MAX_WORKERS__", result)
            self.assertIn("hbl-agent-ready", result)
            self.assertIn("sprint/one-city-two-futures-20261111", result)
        for count in (0, 7, 50, -1, True):
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

    def test_scale_ack_cannot_bypass_ceiling(self):
        with self.assertRaises(SystemExit) as caught:
            run_25h.main(["--workers", "50", "--ack-scale"])
        self.assertEqual(2, caught.exception.code)

    def test_both_tracker_templates_retain_gates_and_sandbox(self):
        for tracker in ("github", "linear"):
            text = run_25h.render_workflow(1, tracker, "project-slug")
            front = text.split("---", 2)[1]
            self.assertIn("    - hbl-agent-ready", front)
            self.assertIn("    - hbl-coordinator-approved", front)
            self.assertIn("approval_policy: never", front)
            self.assertIn("shell_environment_policy.inherit=none", front)
            for secret in ("LINEAR_API_KEY", "GH_TOKEN", "GITHUB_TOKEN",
                           "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"):
                self.assertIn("-u " + secret, front)
            self.assertIn("max_retry_backoff_ms: 300000", front)
            self.assertIn("stall_timeout_ms: 300000", front)
            self.assertIn("turn_timeout_ms: 3600000", front)

    @unittest.skipUnless(hasattr(os, "killpg"), "POSIX process groups required")
    def test_crashed_leader_does_not_leave_running_child_before_restart(self):
        # The child ignores SIGTERM to exercise escalation even after its parent
        # has exited. Its heartbeat proves SIGKILL stops actual work, avoiding
        # platform-dependent zombie process existence checks.
        with tempfile.TemporaryDirectory() as directory:
            heartbeat = Path(directory) / "heartbeat"
            code = """import os, signal, time
if os.fork():
    os._exit(0)
signal.signal(signal.SIGTERM, signal.SIG_IGN)
while True:
    with open(%r, 'a') as out:
        out.write('x')
    time.sleep(.01)
""" % str(heartbeat)
            process = subprocess.Popen([sys.executable, "-c", code], start_new_session=True)
            try:
                process.wait(timeout=3)
                deadline = time.monotonic() + 3
                while not heartbeat.exists() and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertTrue(heartbeat.exists())
                run_25h.stop_process(process, grace_seconds=.1)
                time.sleep(.1)
                size = heartbeat.stat().st_size
                time.sleep(.1)
                self.assertEqual(size, heartbeat.stat().st_size)
            finally:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass


class IntakeTests(unittest.TestCase):
    def test_parses_real_curated_queue(self):
        queue = seed_ready_issues.parse_ready_table(
            seed_ready_issues.BACKLOG.read_text(encoding="utf-8"))
        self.assertTrue(seed_ready_issues.FIRST_WAVE.issubset(queue.keys()))
        self.assertIn("verification", queue["R01"])
        self.assertIn("ownership", queue["R01"])
        self.assertTrue(queue["R01"]["priority"])

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
