# Automatic pull-request merging

HappyBearLandia checks eligible pull requests through GitHub Actions every five minutes. The workflow is `.github/workflows/auto-merge.yml`; its implementation is `.github/scripts/auto-merge.cjs`.

## Normal use

Open a ready pull request from a branch in `adnanwahab/happybearlandia` targeting either `main` or `sprint/one-city-two-futures-20261111`. No opt-in label or additional manual approval is required beyond the repository's own rules. Drafts stay drafts.

The scheduled job considers the oldest PRs first and merges at most one eligible PR per run. It preserves the PR's target branch. The schedule is `*/5 * * * *`; GitHub may delay scheduled runs under load, so this is a checking interval rather than a guaranteed merge deadline.

Open the **Automatic PR merging** workflow in GitHub Actions to inspect its run summary. It records merged PRs and reasons that other candidates were skipped. The job does not post PR comments.

## Eligibility

The merger requires:

- An open, ready, same-repository PR targeting one of the two allowed branches.
- Known, conflict-free mergeability, no pending requested person/team review, no active requested changes, no unresolved review threads, and no unsatisfied repository review requirement.
- No hold marker in a label, title, or recognized maintainer comment. `hold`, `blocked`, `do-not-merge`, and `no-automerge` are hold markers. Remove the label or edit the title/comment to clear its marker; a later comment does not cancel an earlier hold.
- Successful current-head **HappyBearLandia core journeys** workflow and its `verify` job.
- Successful path-specific orchestration or throughput CI when the changed files activate those workflows.
- Successful actual check runs and commit status contexts; missing core CI, pending work, failures, cancellation, and skipped required verification block merging.
- The current target branch commit is an ancestor of the checked PR head. If the base advanced, update the task branch and rerun CI. This implementation deliberately does not infer tested merge freshness from a source-head check alone.
- For PRs targeting `main`, successful core journeys CI for the current `main` commit as well.

PRs changing `.github/**` or an `AGENTS.md` file require direct review and are skipped by this job. In particular, the merger does not automatically merge changes to its own policy or credentials-bearing workflow. Ordinary feature and test changes remain eligible.

The job refreshes the candidate and eligibility evidence immediately before merging. The GitHub merge API receives the exact verified head SHA. A moved head/base, unavailable API evidence, or rejected merge leaves the candidate unmerged. It uses normal merge commits when the repository permits them, otherwise squash; it never forces or bypasses repository rules.

These are deterministic CI and review gates. There is no AI semantic reviewer inside the Actions job, and passing tests do not prove every feature requirement is correct. The former hourly ChatGPT process performed a separate agent review; that reasoning is not represented as a completed review here.

## Permissions and post-merge CI

The workflow uses the built-in repository `GITHUB_TOKEN`, with no new personal access token or AI API key:

| Scope | Use |
| --- | --- |
| `contents: write` | Merge the verified branch through GitHub's API. |
| `pull-requests: write` | Read PR/review state and perform the merge. |
| `checks: read` | Inspect check runs. |
| `issues: read` | Read PR discussion for holds. |
| `actions: write` | Inspect workflow runs and explicitly dispatch post-merge core CI. |

The verification job has only read access. The write-enabled merge job runs only for the schedule or a manual dispatch on `main`, and loads its script from `main`; it never checks out or executes candidate PR code with the write token. Concurrency prevents two scheduled/manual passes from merging simultaneously.

A merge performed with `GITHUB_TOKEN` does not trigger an ordinary `push` workflow. For that reason `core-journeys.yml` also accepts `workflow_dispatch`, and the merger explicitly requests core CI after a `main` merge. A later pass holds further `main` merges until that exact current main commit passes. Missing main CI can be dispatched by the merger; already pending or failed checks are not silently treated as success.

The sprint branch has no required push workflow. Each sprint candidate still needs successful PR CI and a head incorporating the current sprint base.

The job does not deploy, retarget PRs, delete branches, mark drafts ready, edit branch protection, or enable GitHub's separate per-PR auto-merge setting.

## Manual check

In GitHub Actions, open **Automatic PR merging**, choose **Run workflow**, and keep `dry_run` enabled. It checks candidates and writes the summary without merging or dispatching core CI. Clear `dry_run` for an authorized live pass. Scheduled passes are live by default.

To stop automatic merging, disable this workflow in GitHub Actions. To pause a particular candidate, add a hold label or keep it in draft.

## Mini Symphony publishers

A publisher that always uses `gh pr create --draft` will not feed this automatic merger. For an unattended personal project, run a configured verification command in the task workspace. On success, publish a ready PR; on failure or missing verification, retain the attempt or use a draft. Existing draft PRs are not promoted by this schedule.

For the simplest single-worker queue, allow one unmerged task at a time per repository. Start later tasks from a freshly fetched base after the previous PR is merged. This avoids accumulating branches that need updating after the base advances.

## Verification and migration

Run the focused tests locally with:

```bash
node --test test/auto-merge.test.cjs
```

Tests use mocked GitHub responses and perform no live merges. The same tests run on relevant PRs, pushes, scheduled passes, and manual dispatches. Application/browser behavior is unchanged, so this slice does not require a new browser test.

The old hourly ChatGPT merger should be paused after the GitHub workflow has been installed and a scheduled pass observed. The two schedulers should not be left running as independent merge writers.

## References

- Scheduled workflow behavior: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- Token-triggered workflows: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
- Workflow source: ../.github/workflows/auto-merge.yml
