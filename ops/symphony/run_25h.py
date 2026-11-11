#!/usr/bin/env python3
"""Bounded, restartable local supervisor for the Symphony Codex dispatcher.

Nothing is launched unless --run is supplied. This manages ONE dispatcher;
Symphony itself launches up to --workers issue-scoped Codex sessions.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "WORKFLOW.template.md"
PLACEHOLDER = "__MAX_WORKERS__"
DEFAULT_BASE = Path.home() / ".local" / "share" / "hbl-codex"
_STOP = False


def render_workflow(workers: int) -> str:
    if not 1 <= workers <= 50:
        raise ValueError("workers must be between 1 and 50")
    source = TEMPLATE.read_text(encoding="utf-8")
    if source.count(PLACEHOLDER) != 1:
        raise ValueError("Expected one max-workers placeholder")
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=6, help="Max concurrent Codex workers (1-50; default 6)")
    parser.add_argument("--hours", type=float, default=25, help="Dispatcher runtime in hours (default 25)")
    parser.add_argument("--symphony-bin", default=os.getenv("SYMPHONY_BIN", ""),
                        help="Built Symphony executable, e.g. /opt/symphony/elixir/bin/symphony")
    parser.add_argument("--port", type=int, default=43110, help="Local Symphony dashboard port")
    parser.add_argument("--max-restarts", type=int, default=10, help="Maximum dispatcher restarts")
    parser.add_argument("--run", action="store_true", help="Actually launch the dispatcher")
    parser.add_argument("--ack-scale", action="store_true",
                        help="Acknowledge resource/usage risks when requesting >6 workers")
    args = parser.parse_args(argv)

    try:
        workflow = render_workflow(args.workers)
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

    workspaces = Path(os.getenv("HBL_SYMPHONY_WORKSPACES", str(DEFAULT_BASE / "workspaces"))).expanduser().resolve()
    logs = Path(os.getenv("HBL_SYMPHONY_LOGS", str(DEFAULT_BASE / "logs"))).expanduser().resolve()

    print(f"Repository: adnanwahab/happybearlandia", flush=True)
    print(f"Workers: {args.workers} maximum; duration: {args.hours:g} hours", flush=True)
    print(f"Workspace root: {workspaces}", flush=True)
    print(f"Logs: {logs}", flush=True)
    print("Dispatch gate: open issues with label hbl-agent-ready", flush=True)
    print("Target for worker PRs: sprint/one-city-two-futures-20261111", flush=True)
    print("Automatic merging and deployment: DISABLED", flush=True)
    if not args.run:
        print("Dry run only. Supply --run to launch. Sample rendered YAML:", flush=True)
        print(workflow.split("---", 2)[1].strip()[:2200], flush=True)
        return 0

    if not os.getenv("GITHUB_TOKEN"):
        parser.error("GITHUB_TOKEN is required on the host (never commit it)")
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
