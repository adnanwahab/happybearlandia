# Linear + Symphony pilot for HappyBearLandia

Symphony currently defaults to GitHub Issues through `run_25h.py`.
**Do not assume the GitHub supervisor switches to Linear automatically.**
For a Linear pilot, use the separate `WORKFLOW.linear.template.md` and
launch the Symphony executable directly. Stop the GitHub supervisor first.

## Prepare Linear

1. Create or select a Linear **team** for HappyBearLandia.
2. Create the project "HBL — 1M Player Launch: Week 1".
3. Import the supplied 56-issue CSV through Settings → Administration →
   Import/Export → CLI import → Linear CSV, choosing the HBL team.
   Linear's CLI CSV importer may not preserve project associations or native
   blocking relations. Bulk-select the imported issues and press Shift+P to
   associate them with the project. Rebuild actual `blocked by` links.
4. All issues begin in **Backlog**; never label the full imported queue ready.
5. Create a team-level `hbl-agent-ready` label. Use states `Todo`,
   `In Progress`, `Human Review`, `Rework`, and `Done`, or adapt the
   workflow template to your actual team states.
6. Copy the project URL and obtain the actual project slug (no guessed slug).
7. Create a **restricted personal Linear API key** in Settings → Account →
   Security & Access, with only the permissions and teams needed. The Linear
   connection inside ChatGPT does not automatically provide this host token.

## Fetch the versioned Linear workflow into your local HBL checkout

```bash
cd "$HOME/happybearlandia"
git fetch origin ops/symphony-codex-pipeline-20261111
git show origin/ops/symphony-codex-pipeline-20261111:ops/symphony/WORKFLOW.linear.template.md > ops/symphony/WORKFLOW.linear.md
python3 - <<'PY'
from pathlib import Path
p = Path("ops/symphony/WORKFLOW.linear.md")
slug = input("Linear project slug: ").strip()
assert slug and all(c.isalnum() or c in "-_" for c in slug)
s = p.read_text()
assert s.count("REPLACE_LINEAR_PROJECT_SLUG") == 1
p.write_text(s.replace("REPLACE_LINEAR_PROJECT_SLUG", slug))
PY
```

## Start the one-worker pilot manually

Stop the existing GitHub Symphony supervisor with Ctrl+C before proceeding.
Do not paste your Linear key into code, commits, screenshots, or chats.

```bash
read -s LINEAR_API_KEY
export LINEAR_API_KEY
export HBL_SYMPHONY_WORKSPACES="$HOME/.local/share/hbl-codex/workspaces-linear"
export SYMPHONY_BIN="$HOME/.local/bin/symphony-v0.0.3-macos_arm64"
unset GITHUB_TOKEN
"$SYMPHONY_BIN" --i-understand-that-this-will-be-running-without-the-usual-guardrails ops/symphony/WORKFLOW.linear.md --port 43110
```

The dashboard starts at http://127.0.0.1:43110. In Linear, audit one
small, unfinished implementation issue, move it to `Todo`, and add the
exact `hbl-agent-ready` label. Symphony will poll the project and start one
Codex issue worker. It does not automatically create backlog tasks or merge
PRs. `Ctrl+C` stops the foreground pilot.

**Strong warning:** The Symphony release is prototype software and explicitly
requires acknowledgment of reduced guardrails. Run it in a dedicated trusted
development environment without production credentials, not as an unattended
unbounded process on a personal laptop. Verify one real PR with CI and manual
review before higher concurrency.

## Notes on import and delivery

- Linear projects and issues are different objects. A CSV import into a
  team does not itself create a Symphony-compatible project or native
  dependency graph. Each issue can have only one project.
- The 56 issues are candidate backlog items, not all suitable to ship in
  one week; prioritization should follow actual player and CI evidence.
- The first Github Issue pilot is https://github.com/adnanwahab/happybearlandia/issues/22
  and can be dispatched with `hbl-agent-ready` while the **GitHub**
  configuration (not Linear) is running.
- If a Linear issue has an open PR, the worker should remove its dispatch
  label and hand it off for independent review, not auto-merge.
