"""Shared dispatch approvals; labels never waive host ownership or readiness checks."""
REQUIRED_APPROVALS = frozenset({'hbl-agent-ready', 'hbl-coordinator-approved'})


def missing_approvals(labels):
    return sorted(REQUIRED_APPROVALS.difference(labels))
