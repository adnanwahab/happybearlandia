#!/usr/bin/env python3
"""Opt-in, idempotent GitHub Issues intake from the approved sprint READY table.

Preview by default. Creates issues ONLY with --apply --ids ..., and makes
only R01-R05 dispatchable with an additional --dispatch-first-wave flag.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

REPO = "adnanwahab/happybearlandia"
API = "https://api.github.com/repos/" + REPO
BACKLOG = Path(__file__).resolve().parents[2] / "docs" / "demo-backlog.md"
FIRST_WAVE = frozenset({"R01", "R02", "R03", "R04", "R05"})
LABELS = {
    "hbl-agent-task": ("596579", "Issue imported from audited HBL demo backlog"),
    "hbl-agent-ready": ("0e8a16", "Approved, dependency-checked issue eligible for Codex"),
}


def parse_ready_table(markdown: str) -> dict[str, dict[str, str]]:
    start = markdown.find("## READY bootstrap")
    end = markdown.find("## Prioritized upcoming work", start)
    if start < 0 or end < 0:
        raise ValueError("Could not locate approved READY bootstrap table")
    rows = {}
    for line in markdown[start:end].splitlines():
        if not re.match(r"^\|\s*R\d+\s*\|", line):
            continue
        cols = [part.strip() for part in line.strip().strip("|").split("|")]
        if len(cols) != 6:
            raise ValueError(f"Unexpected READY table column count: {line}")
        task_id, priority, requirement, dependency, ownership, verification = cols
        if task_id in rows:
            raise ValueError(f"Duplicate backlog ID: {task_id}")
        if not re.search(r"\bREADY\b", priority):
            continue
        rows[task_id] = {
            "priority": priority,
            "requirement": requirement,
            "dependency": dependency,
            "ownership": ownership,
            "verification": verification,
        }
    return rows


def gh_request(method: str, path: str, token: str, payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = Request(API + path, data=body, method=method, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "hbl-codex-backlog-intake",
    })
    try:
        with urlopen(req, timeout=20) as res:
            raw = res.read()
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"GitHub {method} {path}: HTTP {exc.code} {detail}") from exc


def ensure_labels(token: str) -> None:
    for name, (color, description) in LABELS.items():
        # Creating an existing label returns 422, which is safe to ignore here.
        try:
            gh_request("POST", "/labels", token, {
                "name": name, "color": color, "description": description,
            })
        except RuntimeError as err:
            if "HTTP 422" not in str(err):
                raise


def existing_tasks(token: str) -> set[str]:
    ids: set[str] = set()
    for page in range(1, 51):
        items = gh_request("GET", f"/issues?state=all&per_page=100&page={page}", token)
        if not items:
            break
        for issue in items:
            if "pull_request" in issue:
                continue
            match = re.match(r"^\[HBL (R\d+)\]", issue.get("title", ""))
            if match:
                ids.add(match.group(1))
        if len(items) < 100:
            break
    return ids


def issue_body(task_id: str, row: dict[str, str]) -> str:
    return (
        f"Source: docs/demo-backlog.md, READY bootstrap, {task_id}\n"
        "Integration base: sprint/one-city-two-futures-20261111\n\n"
        f"## Acceptance / required behavior\n{row['requirement']}\n\n"
        f"## Prerequisites\n{row['dependency']}\n\n"
        f"## Exclusive ownership\n{row['ownership']}\n\n"
        f"## Verification\n{row['verification']}\n\n"
        "## Worker rules\n"
        "Read AGENTS.md and sprint docs; audit current implementation first. "
        "Use an isolated branch/workspace and respect file ownership. "
        "Open a PR to the sprint branch with test evidence. "
        "Do not merge or deploy. A planning/integration coordinator must "
        "validate dependencies before adding the hbl-agent-ready label.\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ids", nargs="*", default=[],
                        help="Selected backlog IDs, e.g. --ids R01 R02 (required with --apply)")
    parser.add_argument("--apply", action="store_true", help="Create missing GitHub issues")
    parser.add_argument("--dispatch-first-wave", action="store_true",
                        help="Also mark selected R01-R05 issues ready to run")
    args = parser.parse_args(argv)
    tasks = parse_ready_table(BACKLOG.read_text(encoding="utf-8"))
    selected = set(token for value in args.ids for token in value.upper().split(",") if token)
    if not selected:
        if args.apply:
            parser.error("--apply requires explicit --ids to avoid creating an unreviewed queue")
        selected = set(tasks.keys())
    missing = selected - tasks.keys()
    if missing:
        parser.error(f"IDs not present in READY bootstrap: {sorted(missing)}")
    if args.dispatch_first_wave and not args.apply:
        parser.error("--dispatch-first-wave requires --apply")
    if args.dispatch_first_wave and not selected.issubset(FIRST_WAVE):
        parser.error(f"Only independently scoped first-wave tasks may auto-dispatch: {sorted(FIRST_WAVE)}")

    for task_id in sorted(selected):
        row = tasks[task_id]
        print(f"{task_id} | {row['priority']} | {row['dependency']} | {row['ownership']}")
    if not args.apply:
        print("PREVIEW ONLY. Use --apply --ids R01 ... to create draft issues.")
        return 0

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        parser.error("GITHUB_TOKEN is required when --apply is used")
    ensure_labels(token)
    known = existing_tasks(token)
    for task_id in sorted(selected):
        if task_id in known:
            print(f"{task_id}: existing issue found; left unchanged")
            continue
        row = tasks[task_id]
        labels = ["hbl-agent-task"]
        if args.dispatch_first_wave:
            labels.append("hbl-agent-ready")
        result = gh_request("POST", "/issues", token, {
            "title": f"[HBL {task_id}] {row['requirement'][:80]}",
            "body": issue_body(task_id, row),
            "labels": labels,
        })
        print(f"Created {task_id}: {result.get('html_url', '<URL missing>')} ({', '.join(labels)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
