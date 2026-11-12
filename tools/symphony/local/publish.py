#!/usr/bin/env python3
"""Trusted host after_run publisher. Never execute this from an agent shell."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import shlex
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
import time

REPO = 'adnanwahab/happybearlandia'
BASE = 'sprint/one-city-two-futures-20261111'
ROOT = Path.home() / 'code/symphony-pilot-isolated'
STATE = Path.home() / '.local/state/hbl-publisher'


class PublicationError(Exception):
    def __init__(self, message, *, retryable=True):
        super().__init__(message)
        self.retryable = retryable


def command(args, cwd, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=120)
    if result.returncode:
        # Do not persist command output: Git/gh errors can contain credentials.
        raise PublicationError(f'{args[0]} {args[1]} failed (exit {result.returncode}); check host authentication, connectivity and branch divergence; retry after correction')
    return result.stdout.strip()


def _linear_rejection(status, payload):
    # Error bodies can echo input variables, credentials or request headers.
    # Expose only known classifications and selected validation field names.
    allowed_codes = {'BAD_USER_INPUT', 'INPUT_ERROR', 'INVALID_INPUT', 'GRAPHQL_VALIDATION_FAILED',
                     'UNAUTHENTICATED', 'AUTHENTICATION_ERROR', 'AUTHENTICATION_REQUIRED',
                     'FORBIDDEN', 'RATE_LIMITED', 'RATELIMITED', 'INTERNAL_SERVER_ERROR'}
    labels, codes, fields = [], set(), set()
    errors = payload.get('errors', []) if isinstance(payload, dict) else []
    if not isinstance(errors, list):
        errors = []
    for error in errors[:5]:
        if not isinstance(error, dict):
            continue
        extensions = error.get('extensions')
        extensions = extensions if isinstance(extensions, dict) else {}
        code = extensions.get('code')
        if isinstance(code, str) and code in allowed_codes:
            codes.add(code)
        message = error.get('message')
        if isinstance(message, str):
            if message.startswith('Argument Validation Error'):
                labels.append('Argument Validation Error')
            elif message.startswith('Variable '):
                labels.append('GraphQL variable validation failed')
            elif message.startswith('Cannot query field '):
                labels.append('GraphQL field validation failed')
            elif message.startswith('Syntax Error'):
                labels.append('GraphQL syntax error')
        details = extensions.get('validationErrors', [])
        if isinstance(details, list):
            for item in details[:10]:
                name = item.get('property') if isinstance(item, dict) else None
                if isinstance(name, str) and name in {'id', 'issueId', 'body', 'stateId', 'labelId', 'input'}:
                    fields.add(name)
    labels = list(dict.fromkeys(labels))
    summary = '; '.join(labels) or 'response rejected'
    if codes:
        summary += ' [' + ', '.join(sorted(codes)) + ']'
    if fields:
        summary += '; validation fields: ' + ', '.join(sorted(fields))
    retryable = status in (408, 429) or (isinstance(status, int) and status >= 500) or bool(codes & {'INTERNAL_SERVER_ERROR', 'RATE_LIMITED', 'RATELIMITED'})
    return PublicationError(f'Linear request rejected (HTTP {status if status is not None else "unavailable"}): {summary}', retryable=retryable)


def linear(query, variables, *, attempts=3):
    if attempts not in (1, 2, 3):
        raise ValueError('Linear attempts must be 1, 2 or 3')
    key = os.environ.get('LINEAR_API_KEY')
    if not key:
        raise PublicationError('Linear host key unavailable; configure host authentication', retryable=False)
    last_error = None
    for attempt in range(attempts):
        status = None
        try:
            request = urllib.request.Request('https://api.linear.app/graphql',
                data=json.dumps(dict(query=query, variables=variables)).encode(),
                headers={'Authorization': key, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=30) as response:
                value = getattr(response, 'status', None)
                status = value if isinstance(value, int) else None
                try:
                    data = json.load(response)
                except (ValueError, UnicodeError):
                    raise PublicationError(f'Linear invalid JSON response (HTTP {status if status is not None else "unavailable"}); response body omitted', retryable=status is None or status >= 500) from None
            if not isinstance(data, dict) or data.get('errors') or not isinstance(data.get('data'), dict):
                raise _linear_rejection(status, data)
            return data['data']
        except urllib.error.HTTPError as error:
            status = error.code if isinstance(error.code, int) else None
            try:
                raw = error.read(65537)
                payload = json.loads(raw) if len(raw) <= 65536 else None
            except Exception:
                payload = None
            finally:
                error.close()
            last_error = _linear_rejection(status, payload)
        except PublicationError as error:
            last_error = error
        except Exception:
            # Never format URL/transport exceptions: they can contain headers,
            # bearer tokens, credentials, query variables or remote response text.
            last_error = PublicationError(f'Linear host request failed (HTTP {status if status is not None else "unavailable"}); check connectivity and retry')
        if not last_error.retryable:
            raise last_error from None
        if attempt < attempts - 1:
            time.sleep(attempt + 1)
    raise PublicationError(f'{last_error} after {attempts} attempts', retryable=True) from None


def workpad(issue, require_approval=True):
    data = linear('''query($id:String!){issue(id:$id){id identifier state{name}
      labels{nodes{id name} pageInfo{hasNextPage}} comments{nodes{id body} pageInfo{hasNextPage}}}}''', {'id': issue})['issue']
    if not data or data['identifier'] != issue or data['state']['name'] not in ('Todo', 'In Progress', 'Rework'):
        raise PublicationError('Issue missing or no longer active; operator must reconcile')
    if data['labels']['pageInfo']['hasNextPage']:
        raise PublicationError('Incomplete labels; operator must reconcile')
    if require_approval and 'symphony-pilot' not in [x['name'] for x in data['labels']['nodes']]:
        raise PublicationError('Issue lacks symphony-pilot approval')
    pads = [x for x in data['comments']['nodes'] if x['body'].startswith('## Codex Workpad')]
    if data['comments']['pageInfo']['hasNextPage'] or len(pads) != 1:
        raise PublicationError('Need exactly one existing workpad in complete comment page; operator must reconcile')
    pad = pads[0]
    pad['issue_id'] = data['id']
    pad['pilot_label_id'] = next((x['id'] for x in data['labels']['nodes'] if x['name'] == 'symphony-pilot'), None)
    return pad


def link(issue, url, sha):
    pad = workpad(issue, require_approval=False)  # Refresh, preserving agent updates on retries.
    marker = f'\n\n### Host GitHub publication\nDraft PR: {url}\nPublished commit: `{sha}`'
    previous = re.sub(r'\n\n### Host GitHub publication\n.*?(?=\n\n### |\Z)', '', pad['body'], flags=re.S)
    body = previous + marker
    data = linear('mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success}}',
                  {'id': pad['id'], 'body': body})
    if not data['commentUpdate']['success']:
        raise PublicationError('PR exists but Linear workpad update failed; retry to repair link')
    if pad['pilot_label_id']:
        parked = linear('mutation($id:String!,$label:String!){issueRemoveLabel(id:$id,labelId:$label){success}}',
                        {'id': pad['issue_id'], 'label': pad['pilot_label_id']})
        if not parked['issueRemoveLabel']['success']:
            raise PublicationError('PR linked but dispatch label removal failed; stop Symphony and park issue manually')



def validate(path, root=ROOT):
    path = Path(path)
    issue = path.name
    if not re.fullmatch(r'SHE-[1-9][0-9]*', issue):
        raise PublicationError('Expected approved SHE issue identifier')
    if path.is_symlink() or path.absolute() != root.resolve() / issue or path.resolve() != path.absolute():
        raise PublicationError('Workspace must be a direct canonical child of isolated root')
    metadata = path / '.git'
    if not metadata.is_dir() or any(p.is_symlink() for p in metadata.rglob('*')) or metadata.is_symlink():
        raise PublicationError('Independent Git directory required; no metadata symlinks')
    if (metadata / 'objects/info/alternates').exists():
        raise PublicationError('External Git objects forbidden')
    return issue


def publish(path, root=ROOT):
    issue = validate(path, root)
    # Model-authored handoff is data, never shell or a source of repository policy.
    request_path = path / '.git/hbl-publish.json'
    if not request_path.exists():
        return {'status': 'no-request'}
    request = json.loads(request_path.read_text())
    sha = request.get('commit', '')
    branch = f'symphony/{issue}'
    if (request.get('issue') != issue or request.get('branch') != branch or
        request.get('base') != BASE or request.get('repository') != REPO or
        not re.fullmatch('[0-9a-f]{40}', sha)):
        raise PublicationError('Invalid issue, repository, branch, base or full commit in handoff')
    body = request.get('body', '')
    if not isinstance(body, str) or not body.strip() or len(body) > 60000:
        raise PublicationError('PR body required (maximum 60000 characters)')
    # Never load workspace Git configuration on the authenticated host. Only read
    # validated object storage through a disposable, host-owned bare repository.
    with tempfile.TemporaryDirectory(prefix='hbl-publisher-') as tmp:
        env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'GH_', 'GITHUB_'))}
        env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0')
        command(['git', 'init', '--bare', tmp], tmp, env)
        gitdir = Path(tmp)
        (gitdir / 'objects/info/alternates').write_text(str(path / '.git/objects') + '\n')
        def git(*args):
            return command(['git', *args], tmp, env)
        if (path / '.git/HEAD').read_text().strip() != f'ref: refs/heads/{branch}':
            raise PublicationError('Checked-out branch must be the exact issue branch')
        # Resolve refs and index with trusted config, without reading local config.
        env.update(GIT_WORK_TREE=str(path), GIT_INDEX_FILE=str(path / '.git/index'))
        ref = path / '.git/refs/heads' / branch
        # Independent pilot clones create loose issue refs; fail closed otherwise.
        if not ref.is_file() or ref.read_text().strip() != sha:
            raise PublicationError('Requested commit must match local issue HEAD (loose ref required)')
        if git('cat-file', '-t', sha) != 'commit':
            raise PublicationError('Handoff SHA must identify a commit object')
        tree = git('write-tree')
        if tree != git('rev-parse', sha + '^{tree}') or git('diff-files', '--name-only') or git('ls-files', '--others', '--exclude-standard'):
            raise PublicationError('Workspace/index must be clean and fully committed')
        allowed = {'https://github.com/' + REPO + '.git', 'https://github.com/' + REPO, 'git@github.com:' + REPO + '.git'}
        origin = command(['git', 'config', '--file', str(path / '.git/config'), '--no-includes', '--get', 'remote.origin.url'], tmp, env)
        if origin not in allowed:
            raise PublicationError('Workspace origin is not the allowed repository')
        ghbin = shutil.which('gh')
        if not ghbin:
            raise PublicationError('Install authenticated host GitHub CLI')
        def gh(*args):
            return command([ghbin, *args], tmp, env)
        def prs():
            return json.loads(gh('pr', 'list', '--repo', REPO, '--head', branch, '--state', 'all', '--json', 'url,state,isDraft,baseRefName,headRefOid,isCrossRepository'))
        def check(items):
            if len(items) > 1 or any(p['state'] != 'OPEN' or not p['isDraft'] or p['baseRefName'] != BASE or p['isCrossRepository'] for p in items):
                raise PublicationError('Existing PR is closed, merged, non-draft, duplicated or wrong-base; operator reconciliation required')
        items = prs()
        check(items)
        current = bool(items and items[0]['headRefOid'] == sha)
        if not current:
            workpad(issue)  # Approval required before every push.
            base = json.loads(gh('api', f'repos/{REPO}/git/ref/heads/{BASE}'))['object']['sha']
            git('-c', 'credential.helper=', '-c', f'credential.helper=!{shlex.quote(ghbin)} auth git-credential', 'fetch', '--no-tags', 'https://github.com/' + REPO + '.git', BASE)
            if git('rev-parse', 'FETCH_HEAD') != base:
                raise PublicationError('Base changed during validation; retry')
            git('merge-base', '--is-ancestor', base, sha)
            if sha == base:
                raise PublicationError('No issue commit beyond base')
            # Explicit SHA/refspec, no force, hooks, local remotes or local helpers.
            git('-c', 'credential.helper=', '-c', f'credential.helper=!{shlex.quote(ghbin)} auth git-credential',
                '-c', 'core.hooksPath=/dev/null', 'push', 'https://github.com/' + REPO + '.git', f'{sha}:refs/heads/{branch}')
        if not items:
            bodyfile = gitdir / 'pr-body.txt'
            bodyfile.write_text(body)
            try:
                gh('pr', 'create', '--repo', REPO, '--draft', '--base', BASE, '--head', branch,
                   '--title', f'{issue}: Symphony pilot', '--body-file', str(bodyfile))
            except PublicationError:
                # A timeout may mean GitHub accepted the create. Reconcile before retry.
                items = prs()
                if not items:
                    raise
        items = prs()
        check(items)
        if len(items) != 1 or items[0]['headRefOid'] != sha:
            raise PublicationError('PR HEAD not yet current; retry to reconcile')
        link(issue, items[0]['url'], sha)
        return {'status': 'published', 'commit': sha, 'url': items[0]['url']}


def main():
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = Path.cwd()
    issue = validate(path)
    with (STATE / f'{issue}.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            result = publish(path)
        except Exception as exc:
            result = {'status': 'error', 'action': str(exc) if isinstance(exc, PublicationError) else
                      f'{type(exc).__name__}: host publication interrupted; verify connectivity/auth and retry; existing PR will be reconciled'}
        target = STATE / f'{issue}.json'
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(target)
        print(json.dumps(result))
        return int(result['status'] == 'error')


if __name__ == '__main__':
    sys.exit(main())
