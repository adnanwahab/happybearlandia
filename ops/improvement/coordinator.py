"""Read-only projection of SHE-180 reports; never invokes its approval path."""
import math
import time
from .proposal import ISSUE, SHA, require

PROJECT = '3f960f14-ee1f-4b2b-a4f8-b1b67483b88a'


def validate_report(report, now=None):
    if report is None:
        return None
    now = time.time() if now is None else now
    require(isinstance(report, dict) and report.get('dryRun') is True and report.get('projectId') == PROJECT,
            'expected existing coordinator dry-run report for HBL project')
    require(isinstance(report.get('baseSha'), str) and SHA.fullmatch(report['baseSha']), 'coordinator base SHA missing')
    stamp = report.get('scannedAt')
    require(type(stamp) in (int, float) and math.isfinite(stamp) and now - 3600 <= stamp <= now + 60,
            'coordinator report stale or invalid')
    rows = report.get('issues')
    require(isinstance(rows, list) and 1 <= len(rows) <= 10000, 'coordinator issue inventory missing')
    found = {}
    for row in rows:
        require(isinstance(row, dict) and isinstance(row.get('identifier'), str) and ISSUE.fullmatch(row['identifier']) and
                row['identifier'] not in found and isinstance(row.get('title'), str) and isinstance(row.get('state'), str) and
                isinstance(row.get('reasons'), list) and all(isinstance(x, str) for x in row['reasons']) and
                isinstance(row.get('existingPRs'), list) and all(type(x) is int and x > 0 for x in row['existingPRs']),
                'invalid coordinator issue row')
        found[row['identifier']] = row
    return found


def project(proposal, issues, related=()):
    reasons = []
    target = proposal['targetIssue']
    if issues is None:
        reasons.append('COORDINATOR_REPORT_REQUIRED')
    else:
        for dependency in proposal['dependencies']:
            if dependency not in issues or issues[dependency]['state'] != 'Done':
                reasons.append('UNVERIFIED_DEPENDENCY:' + dependency)
        if target:
            row = issues.get(target)
            if row is None:
                reasons.append('TARGET_ISSUE_NOT_IN_REPORT')
            else:
                reasons.extend('COORDINATOR_HOLD:' + reason for reason in row['reasons'])
                if row['state'] in ('Done', 'Closed', 'Cancelled', 'Canceled', 'Duplicate'):
                    reasons.append('TARGET_ALREADY_TERMINAL')
                if row['existingPRs']:
                    reasons.append('EXISTING_PR_REQUIRES_RECONCILIATION')
        else:
            for identifier, row in issues.items():
                if row['title'].strip().casefold() == proposal['title'].casefold():
                    reasons.append('MATCHING_ISSUE_TITLE:' + identifier)
    if related:
        reasons.append('RELATED_PROPOSAL_REQUIRES_REVIEW')
    return {'disposition': 'HELD' if reasons else 'REVIEW', 'holdReasons': reasons,
            'action': 'REVIEW_EXISTING_ISSUE' if target else 'PROPOSE_REVIEW_ISSUE',
            'targetIssue': target, 'trackingLabel': 'hbl-symphony-queue',
            'executionApproved': False, 'evidenceStatus': 'NOT_EVALUATED', 'relatedProposals': sorted(related)}
