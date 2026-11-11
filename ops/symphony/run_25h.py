#!/usr/bin/env python3
"""Bounded, restartable local supervisor for the Symphony Codex dispatcher.

Nothing is launched unless --run is supplied. This manages ONE dispatcher;
Symphony itself launches up to --workers issue-scoped Codex sessions.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import socket
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "WORKFLOW.template.md"
LINEAR_TEMPLATE = HERE / "WORKFLOW.linear.template.md"
PLACEHOLDER = "__MAX_WORKERS__"
LINEAR_SLUG_PLACEHOLDER = "REPLACE_LINEAR_PROJECT_SLUG"
DEFAULT_BASE = Path.home() / ".local" / "share" / "hbl-codex"
_STOP = False


def render_workflow(workers: int, tracker: str = "github", linear_project_slug: str = "") -> str:
    if not 1 <= workers <= 50:
        raise ValueError("workers must be between 1 and 50")
    if tracker not in ("github", "linear"):
        raise ValueError("tracker must be github or linear")
    template = LINEAR_TEMPLATE if tracker == "linear" else TEMPLATE
    source = template.read_text(encoding="utf-8")
    if source.count(PLACEHOLDER) != 1:
        raise ValueError("Expected one max-workers placeholder")
    if tracker == "linear":
        if not re.fullmatch(r"[A-Za-z0-9_-]+", linear_project_slug):
            raise ValueError("--linear-project-slug must be the slug from the Linear project URL")
        if source.count(LINEAR_SLUG_PLACEHOLDER) != 1:
            raise ValueError("Expected one Linear project slug placeholder")
        source = source.replace(LINEAR_SLUG_PLACEHOLDER, linear_project_slug)
    return source.replace(PLACEHOLDER, str(workers))


def request_stop(signum: int, _frame: object) -> None:
    global _STOP
    _STOP = True
    print(f"Received signal {signum}; stopping dispatcher...", flush=True)


def stop_process(process: subprocess.Popen, grace_seconds: int = 20) -> None:
    if process.poll() is not None:
        return
    try:
        if hasattr(os, "killpg"):
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=grace_seconds)
    except (subprocess.TimeoutExpired, ProcessLookupError):
        if process.poll() is None:
            if hasattr(os, "killpg"):
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
            process.wait(timeout=10)


def preflight_errors(tracker: str, port: int) -> list[str]:
    """Fail before spawning workers when PR delivery or the local daemon cannot work.

    This is a host-side check, not proof of Codex sandbox network access.
    Error messages intentionally contain no command output or credentials.
    """
    errors: list[str] = []
    required = ("git", "gh", "bun", "codex")
    for command in required:
        if not shutil.which(command):
            errors.append(f"{command} is not on PATH")

    if tracker == "linear" and not os.getenv("LINEAR_API_KEY"):
        errors.append("LINEAR_API_KEY is missing; export it securely")
    if tracker == "github" and not os.getenv("GITHUB_TOKEN"):
        errors.append("GITHUB_TOKEN is missing; export it securely")

    def succeeds(command: list[str]) -> bool:
        try:
            result = subprocess.run(
                command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=20, check=False)
            return result.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    if shutil.which("git"):
        for field in ("user.name", "user.email"):
            if not succeeds(["git", "config", "--get", field]):
                errors.append(f"Git author {field} is not configured")

    if shutil.which("gh"):
        if not succeeds(["gh", "auth", "status"]):
            errors.append("GitHub CLI is not authenticated: run gh auth login")
        else:
            try:
                access = subprocess.run(
                    ["gh", "api", "repos/adnanwahab/happybearlandia",
                     "--jq", ".permissions.push"],
                    capture_output=True, text=True, timeout=20, check=False)
                if access.returncode != 0 or access.stdout.strip() != "true":
                    errors.append("GitHub CLI cannot verify push access to adnanwahab/happybearlandia")
            except (OSError, subprocess.TimeoutExpired):
                errors.append("GitHub permission check failed; verify gh authentication")

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                errors.append(f"Port {port} is already occupied; stop the old dispatcher before relaunch")
    except OSError:
        errors.append(f"Cannot check dashboard port {port}")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=6, help="Max concurrent Codex workers (1-50; default 6)")
    parser.add_argument("--tracker", choices=("github", "linear"), default="github",
                        help="Issue tracker to dispatch from (default github)")
    parser.add_argument("--linear-project-slug", default=os.getenv("HBL_LINEAR_PROJECT_SLUG", "hbl-1m-player-launch-week-1-da57f913e8aa"),
                        help="Required for Linear: the final slug segment of the Linear project URL")
    parser.add_argument("--hours", type=float, default=25, help="Dispatcher runtime in hours (default 25)")
    parser.add_argument("--symphony-bin", default=os.getenv("SYMPHONY_BIN", ""),
                        help="Built Symphony executable, e.g. /opt/symphony/elixir/bin/symphony")
    parser.add_argument("--port", type=int, default=43110, help="Local Symphony dashboard port")
    parser.add_argument("--max-restarts", type=int, default=10, help="Maximum dispatcher restarts")
    parser.add_argument("--run", action="store_true", help="Actually launch the dispatcher")
    parser.add_argument("--preflight", action="store_true",
                        help="Check host prerequisites and GitHub permissions; do not launch")
    parser.add_argument("--ack-scale", action="store_true",
                        help="Acknowledge resource/usage risks when requesting >6 workers")
    args = parser.parse_args(argv)

    try:
        workflow = render_workflow(args.workers, tracker=args.tracker,
                                   linear_project_slug=args.linear_project_slug)
    except (OSError, ValueError) as err:
        parser.error(str(err))
    if not 0 < args.hours <= 25:
        parser.error("--hours must be between 0 and 25")
    if not 1 <= args.port <= 65535:
        parser.error("--port must be a TCP port")
    if args.max_restarts < 0:
        parser.error("--max-restarts cannot be negative")
    if args.workers > 6 and not args.ack_scale:
        parser.error("More than 6 workers requires --ack-scale; expand only after a verified pilot")

    workspace_default = "workspaces-linear" if args.tracker == "linear" else "workspaces"
    log_default = "logs-linear" if args.tracker == "linear" else "logs"
    workspaces = Path(os.getenv("HBL_SYMPHONY_WORKSPACES", str(DEFAULT_BASE / workspace_default))).expanduser().resolve()
    logs = Path(os.getenv("HBL_SYMPHONY_LOGS", str(DEFAULT_BASE / log_default))).expanduser().resolve()

    print(f"Repository: adnanwahab/happybearlandia", flush=True)
    print(f"Tracker: {args.tracker}", flush=True)
    if args.tracker == "linear":
        print(f"Linear project: {args.linear_project_slug}", flush=True)
    print(f"Workers: {args.workers} maximum; duration: {args.hours:g} hours", flush=True)
    print(f"Workspace root: {workspaces}", flush=True)
    print(f"Logs: {logs}", flush=True)
    print("Dispatch gate: eligible issues with label hbl-agent-ready", flush=True)
    print("Target for worker PRs: sprint/one-city-two-futures-20261111", flush=True)
    print("Automatic merging and deployment: DISABLED", flush=True)
    if not args.run and not args.preflight:
        print("Dry run only. Supply --run to launch. Sample rendered YAML:", flush=True)
        print(workflow.split("---", 2)[1].strip()[:2200], flush=True)
        return 0

    if args.run and args.preflight:
        parser.error("Choose --run or --preflight, not both")

    errors = preflight_errors(args.tracker, args.port)
    if errors:
        parser.error("Preflight failed:\n- " + "\n- ".join(errors))
    print("Preflight passed: Git/Codex/Bun/gh, GitHub push access, Git identity, port", flush=True)
    if args.preflight:
        return 0

    token_env = "LINEAR_API_KEY" if args.tracker == "linear" else "GITHUB_TOKEN"
    if not os.getenv(token_env):
        parser.error(f"{token_env} is required on the host (never commit it)")
    if not shutil.which("codex"):
        parser.error("codex executable not on PATH; install Codex and authenticate")
    if not shutil.which("git"):
        parser.error("git executable not on PATH")
    symphony = args.symphony_bin or "symphony"
    executable = shutil.which(symphony)
    if not executable:
        parser.error("Symphony binary not found; pass --symphony-bin or set SYMPHONY_BIN")

    workspaces.mkdir(parents=True, exist_ok=True)
    logs.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["HBL_SYMPHONY_WORKSPACES"] = str(workspaces)
    deadline = time.monotonic() + args.hours * 3600
    restarts = 0
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    with tempfile.TemporaryDirectory(prefix="hbl-symphony-") as temp:
        runtime_workflow = Path(temp) / "WORKFLOW.md"
        runtime_workflow.write_text(workflow, encoding="utf-8")
        log_path = logs / f"run-{dt.datetime.now(dt.timezone.utc):%Y%m%d-%H%M%S}.log"
        print(f"Starting Symphony. Local dashboard: http://127.0.0.1:{args.port}/", flush=True)
        print(f"Dispatcher log: {log_path}", flush=True)
        with log_path.open("a", encoding="utf-8", buffering=1) as out:
            while not _STOP and time.monotonic() < deadline:
                cmd = [executable, "--i-understand-that-this-will-be-running-without-the-usual-guardrails", str(runtime_workflow), "--port", str(args.port),
                       "--logs-root", str(logs)]
                process = subprocess.Popen(cmd, env=env, cwd=str(HERE),
                                           stdout=out, stderr=subprocess.STDOUT,
                                           start_new_session=True)
                print(f"Symphony pid={process.pid}, restart={restarts}", flush=True)
                try:
                    while not _STOP and time.monotonic() < deadline and process.poll() is None:
                        time.sleep(min(2, max(0.01, deadline - time.monotonic())))
                finally:
                    stop_process(process)
                if _STOP or time.monotonic() >= deadline:
                    break
                restarts += 1
                if restarts > args.max_restarts:
                    print("Dispatcher restart budget exceeded. Inspect log and fix the fault.", file=sys.stderr)
                    return 1
                delay = min(5 * (2 ** min(restarts - 1, 5)), 120)
                print(f"Symphony exited (code={process.returncode}); retry in {delay}s", flush=True)
                if time.monotonic() + delay >= deadline:
                    break
                time.sleep(delay)
    print("Dispatcher stopped; no new workers will be dispatched.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
