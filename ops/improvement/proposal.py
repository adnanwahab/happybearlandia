"""ImprovementProposal.v1: bounded data, never executable policy or approval."""
import hashlib
import json
import re
import unicodedata
from urllib.parse import quote, unquote, urlsplit

VERSION = 'improvement-proposal.v1'
BATCH_VERSION = 'improvement-batch.v1'
KINDS = {'research', 'evaluation', 'feedback'}
REPO = 'adnanwahab/happybearlandia'
ISSUE = re.compile(r'SHE-[1-9][0-9]*\Z')
SHA = re.compile(r'[0-9a-f]{40}\Z')


class InvalidProposal(ValueError):
    """Messages contain field classifications, never rejected input values."""


def require(condition, message):
    if not condition:
        raise InvalidProposal(message)


def text(value, maximum=2000):
    require(isinstance(value, str) and 0 < len(value) <= maximum and value == value.strip(), 'invalid bounded text')
    require(not any(unicodedata.category(c).startswith('C') for c in value), 'control characters forbidden')
    return value


def exact(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields.split()), 'missing or unknown fields')


def canonical(value):
    try:
        return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    except (ValueError, TypeError):
        raise InvalidProposal('non-JSON or nonfinite value') from None


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def source(value):
    exact(value, 'type id revision url evidence')
    for field in ('type', 'id', 'revision', 'evidence'):
        text(value[field], 300)
    kind, identifier, revision, url = (value[k] for k in ('type', 'id', 'revision', 'url'))
    if kind == 'feedback-aggregate':
        require(value['evidence'] == 'consented-aggregate' and url is None and
                re.fullmatch(r'[0-9a-f]{64}', identifier) and re.fullmatch(r'[0-9a-f]{64}', revision), 'invalid aggregate reference')
        return dict(value)
    text(url, 1000)
    try:
        parsed = urlsplit(url)
        require(parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password and
                not parsed.query and not parsed.fragment and parsed.port in (None, 443), 'unsafe source URL')
    except ValueError:
        raise InvalidProposal('unsafe source URL') from None
    if kind == 'repository':
        require(value['evidence'] == 'repository-inspection' and SHA.fullmatch(revision) and
                re.fullmatch(r'[A-Za-z0-9._/-]+', identifier) and not identifier.startswith('/') and
                all(p not in ('', '.', '..', '.git') for p in identifier.split('/')),
                'invalid repository reference')
        require(url == f'https://github.com/{REPO}/blob/{revision}/{identifier}', 'repository URL/revision mismatch')
    elif kind == 'artifact':
        require(value['evidence'] == 'measured' and SHA.fullmatch(revision) and
                re.fullmatch(r'sha256:[0-9a-f]{64}', identifier) and
                re.fullmatch(r'https://github.com/' + REPO + r'/actions/runs/[1-9][0-9]*(/artifacts/[1-9][0-9]*)?', url),
                'invalid artifact reference')
    elif kind == 'paper':
        require(value['evidence'] in ('metadata-only', 'source-text') and re.fullmatch(r'[0-9a-f]{64}', revision), 'invalid paper evidence')
        if identifier.lower().startswith('doi:'):
            identifier = identifier.lower()
            require(re.fullmatch(r'10\.[0-9]{4,9}/[^\s?#]+', identifier[4:]) and
                    parsed.hostname == 'doi.org' and unquote(parsed.path[1:]).lower() == identifier[4:], 'invalid DOI reference')
            value = {**value, 'url': 'https://doi.org/' + quote(identifier[4:], safe='/:;()._-')}
        else:
            require(re.fullmatch(r'openalex:W[1-9][0-9]*', identifier) and url in (
                'https://openalex.org/' + identifier[9:], 'https://openalex.org/works/' + identifier[9:]),
                'invalid OpenAlex work reference')
            value = {**value, 'url': 'https://openalex.org/' + identifier[9:]}
    else:
        raise InvalidProposal('unknown source type')
    return {**value, 'id': identifier}


def validate_proposal(value):
    exact(value, 'schemaVersion kind title hypothesis sources acceptanceCriteria testCommands dependencies deduplicationKeys targetIssue')
    require(value['schemaVersion'] == VERSION and isinstance(value['kind'], str) and value['kind'] in KINDS,
            'unsupported proposal version or kind')
    text(value['title'], 160)
    text(value['hypothesis'])
    require(isinstance(value['sources'], list) and 1 <= len(value['sources']) <= 12, 'invalid source count')
    sources = [source(s) for s in value['sources']]
    identities = [(s['type'], s['id'], s['revision']) for s in sources]
    require(len(set(identities)) == len(identities), 'duplicate source identity')
    require(value['kind'] != 'feedback' or any(s['type'] == 'feedback-aggregate' for s in sources), 'feedback requires consented aggregate reference')
    acceptance = value['acceptanceCriteria']
    require(isinstance(acceptance, list) and 1 <= len(acceptance) <= 12, 'invalid acceptance criteria')
    for item in acceptance:
        text(item, 1000)
    commands = value['testCommands']
    require(isinstance(commands, list) and 1 <= len(commands) <= 12, 'test argv required')
    for argv in commands:
        require(isinstance(argv, list) and 1 <= len(argv) <= 32, 'test command must be argv data')
        for arg in argv:
            text(arg, 512)
    dependencies = value['dependencies']
    require(isinstance(dependencies, list) and len(dependencies) <= 32 and
            all(isinstance(i, str) and ISSUE.fullmatch(i) for i in dependencies) and
            len(set(dependencies)) == len(dependencies), 'invalid dependencies')
    require(value['targetIssue'] is None or isinstance(value['targetIssue'], str) and ISSUE.fullmatch(value['targetIssue']), 'invalid target issue')
    keys = value['deduplicationKeys']
    require(isinstance(keys, list) and 1 <= len(keys) <= 8 and
            all(isinstance(k, str) and re.fullmatch(r'[a-z0-9][a-z0-9:._/-]{0,159}', k) for k in keys) and
            len(set(keys)) == len(keys), 'invalid deduplication keys')
    result = {**value, 'sources': sorted(sources, key=lambda s: (s['type'], s['id'], s['revision'])),
              'dependencies': sorted(dependencies), 'deduplicationKeys': sorted(keys)}
    require(len(canonical(result).encode()) <= 32768, 'proposal exceeds byte limit')
    return result


def proposal_id(proposal):
    return digest({'kind': proposal['kind'], 'sources': [(s['type'], s['id'], s['revision']) for s in proposal['sources']],
                   'keys': proposal['deduplicationKeys']})


def validate_batch(value):
    exact(value, 'schemaVersion stream cursorBefore cursorAfter proposals')
    require(value['schemaVersion'] == BATCH_VERSION, 'unsupported batch version')
    require(isinstance(value['stream'], str) and re.fullmatch(r'(research|evaluation|feedback):[a-z0-9._:-]{1,120}', value['stream']), 'invalid stream')
    if value['cursorBefore'] is not None:
        text(value['cursorBefore'], 256)
    text(value['cursorAfter'], 256)
    require(value['cursorBefore'] != value['cursorAfter'], 'cursor must advance')
    require(isinstance(value['proposals'], list) and len(value['proposals']) <= 20, 'batch exceeds intake limit')
    proposals = [validate_proposal(p) for p in value['proposals']]
    require(all(p['kind'] == value['stream'].split(':')[0] for p in proposals), 'stream/kind mismatch')
    return {**value, 'proposals': proposals}
