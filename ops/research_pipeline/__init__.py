"""Research-to-code contracts. Validation never grants dispatch or publication."""
import hashlib
import json
import re


class InvalidResearch(ValueError):
    pass


def text(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 12000:
        raise InvalidResearch('Expected nonempty bounded text')
    return value


def fields(value, expected):
    if not isinstance(value, dict) or set(value) != set(expected.split()):
        raise InvalidResearch('Missing or unknown contract fields')


def texts(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 50:
        raise InvalidResearch('Expected 1–50 evidence entries')
    for item in value:
        text(item)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def validate_brief(brief):
    fields(brief, 'schemaVersion issue question hypothesis dataSources intendedUse acceptanceCriteria verification validation uncertainty')
    if brief['schemaVersion'] != 'research-brief.v1':
        raise InvalidResearch('Unsupported brief version')
    if not isinstance(brief['issue'], str) or not re.fullmatch(r'SHE-[1-9][0-9]*', brief['issue']):
        raise InvalidResearch('Invalid issue identifier')
    if brief['intendedUse'] not in ('gameplay', 'experiments'):
        raise InvalidResearch('Intended use must be gameplay or experiments')
    for key in ('question', 'hypothesis', 'verification', 'validation', 'uncertainty'):
        text(brief[key])
    texts(brief['acceptanceCriteria'])
    if not isinstance(brief['dataSources'], list) or not 1 <= len(brief['dataSources']) <= 50:
        raise InvalidResearch('Data sources required')
    for source in brief['dataSources']:
        fields(source, 'reference revision kind limitations')
        for key in ('reference', 'revision', 'limitations'):
            text(source[key])
        if source['kind'] not in ('observed', 'synthetic', 'modeled'):
            raise InvalidResearch('Source kind must distinguish observations and assumptions')
    return digest(brief)


def assess(bundle):
    """Check evidence structure and independent attestations, not scientific truth."""
    fields(bundle, 'schemaVersion brief model engineeringGate researchGate')
    if bundle['schemaVersion'] != 'research-release.v1':
        raise InvalidResearch('Unsupported release version')
    brief_hash = validate_brief(bundle['brief'])
    model = bundle['model']
    fields(model, 'id version codeRevision author briefDigest reproduction errorAnalysis uncertainty limitations')
    for key in ('id', 'version', 'author', 'errorAnalysis', 'uncertainty'):
        text(model[key])
    if not isinstance(model['codeRevision'], str) or not re.fullmatch(r'[0-9a-f]{40}', model['codeRevision']):
        raise InvalidResearch('Pin the full code commit')
    if model['briefDigest'] != brief_hash:
        raise InvalidResearch('Model refers to a different brief')
    texts(model['limitations'])
    reproduction = model['reproduction']
    fields(reproduction, 'environment command seeds inputs rulesVersion evidence')
    for key in ('environment', 'rulesVersion', 'evidence'):
        text(reproduction[key])
    texts(reproduction['command'])
    texts(reproduction['inputs'])
    seeds = reproduction['seeds']
    if not isinstance(seeds, list) or not 1 <= len(seeds) <= 1000 or any(type(s) is not int or s < 0 for s in seeds):
        raise InvalidResearch('Explicit nonnegative integer seeds required')
    subject = digest({'brief': bundle['brief'], 'model': model})
    reasons = []
    reviewers = []
    for name in ('engineeringGate', 'researchGate'):
        gate = bundle[name]
        fields(gate, 'status reviewer subjectDigest evidence')
        if gate['status'] not in ('PASS', 'FAIL', 'NOT_EVALUATED'):
            raise InvalidResearch('Invalid gate status')
        text(gate['reviewer'])
        texts(gate['evidence'])
        reviewers.append(gate['reviewer'].strip().casefold())
        if gate['subjectDigest'] != subject:
            reasons.append(name + ': stale review')
        if gate['status'] != 'PASS':
            reasons.append(name + ': ' + gate['status'])
    if len(set(reviewers + [model['author'].strip().casefold()])) != 3:
        reasons.append('Independent engineering and research reviewers required')
    return {'schemaVersion': 'research-assessment.v1', 'status': 'HELD' if reasons else 'ACCEPTED',
            'reasons': reasons, 'subjectDigest': subject, 'briefDigest': brief_hash,
            'lane': 'research', 'model': {'id': model['id'], 'version': model['version'],
            'codeRevision': model['codeRevision'], 'intendedUse': bundle['brief']['intendedUse']},
            'requiredDispatchLabels': ['hbl-agent-ready', 'hbl-coordinator-approved'],
            'dispatchAuthorized': False, 'remoteWrites': 0}
