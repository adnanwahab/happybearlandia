"""Minimal host adapter extracted from the installed publisher/workpad integration.

Keep the existing publisher and worker hooks unchanged. No model commands run
here; credentials are used only by the trusted host HTTP transport.
"""
import json
import os
from pathlib import Path
import stat
import time
import urllib.request
import urllib.error

REPO = 'adnanwahab/happybearlandia'
BASE = 'sprint/one-city-two-futures-20261111'
STATE = Path.home() / '.local/state/hbl-publisher'


class PublicationError(Exception):
    def __init__(self, message, *, retryable=True):
        super().__init__(message)
        self.retryable = retryable


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


def private_directory(path):
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if os.fstat(fd).st_uid != os.getuid():
            raise PublicationError('Workpad: private state must belong to the host user')
        os.fchmod(fd, 0o700)
    finally:
        os.close(fd)


def private_file(fd):
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
        raise PublicationError('Workpad: invalid private identity file; reconcile host state')
    os.fchmod(fd, 0o600)
