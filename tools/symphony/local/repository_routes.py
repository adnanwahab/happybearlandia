"""Operator-owned routing. Issue prose and worker data cannot grant authority."""
import re
from pathlib import Path
ALLOWLIST = frozenset({'adnanwahab/dear_congress', 'adnanwahab/happybearlandia', 'adnanwahab/digital_pensieve'})
DEFAULT_REPO = 'adnanwahab/happybearlandia'
DEFAULT_BASE = 'sprint/one-city-two-futures-20261111'

def validate_route(route):
    if (not isinstance(route, dict) or route.get('repository') not in ALLOWLIST or
        not isinstance(route.get('base'), str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]{0,199}', route['base']) or
        any(x in route['base'] for x in ('..', '//', '@{')) or route['base'].endswith(('/', '.', '.lock'))):
        raise ValueError('Invalid operator repository route')
    return route

def approved_route(repository, state):
    if repository == DEFAULT_REPO:
        return {'repository': DEFAULT_REPO, 'base': DEFAULT_BASE}
    if repository not in ALLOWLIST:
        raise ValueError('Repository outside Symphony allowlist')
    from backlog_coordinator import read_private
    config = read_private(Path(state) / 'repository-routes.json')
    route = config.get('repositories', {}).get(repository)
    if config.get('version') != 1 or config.get('enabled') is not True or not config.get('reviewedBy'):
        raise ValueError('Operator repository routing is not enabled')
    validate_route(route)
    if route['repository'] != repository:
        raise ValueError('Repository route identity mismatch')
    return route


def verify_source(policy, github):
    """Re-read GitHub immediately before dispatch/publication; input never grants rights."""
    source = policy.get('source')
    if source is None: return  # Existing independently reviewed non-GitHub work.
    import hashlib
    import json
    repo = policy['repository']
    if (not isinstance(source, dict) or type(source.get('number')) is not int or source['number']<=0 or
        type(source.get('repositoryId')) is not int or type(source.get('issueId')) is not int or
        not re.fullmatch('[0-9a-f]{64}', str(source.get('revision','')))):
        raise ValueError('Invalid approved source identity')
    remote = github('repos/' + repo)
    issue = github(f'repos/{repo}/issues/{source["number"]}')
    revision = hashlib.sha256(json.dumps({k:issue.get(k) for k in ('title','body','updated_at','state','labels','assignees')},sort_keys=True).encode()).hexdigest()
    if remote.get('id')!=source['repositoryId'] or issue.get('id')!=source['issueId'] or 'pull_request' in issue or issue.get('state')!='open' or revision!=source['revision']:
        raise ValueError('Source changed/closed; preserve workspace and reconcile, never publish stale work')
    return issue


def reviewed_source(issue, review):
    """Known intake sources must retain immutable reviewed binding; legacy work may omit it."""
    source = issue.get('_sourceOrigin')
    if source is None:
        found = re.search(r'(?m)^Symphony source: https://github.com/(adnanwahab/(?:dear_congress|happybearlandia|digital_pensieve))/issues/([1-9][0-9]*)$',issue.get('description') or '')
        if found: source = {'repository':found[1],'number':int(found[2])}
    if source is None: return None
    binding = review.get('source')
    if (not isinstance(binding, dict) or binding.get('number')!=source['number'] or
        review.get('repository', DEFAULT_REPO)!=source['repository'] or
        any(k in source and binding.get(k)!=source[k] for k in ['repositoryId','issueId'])):
        raise ValueError('Known intake source requires matching immutable operator source binding')
    return {'repository':source['repository'],'source':binding}
