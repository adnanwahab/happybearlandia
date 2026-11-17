#!/usr/bin/env python3
"""Fail closed if standard host GitHub credential files contain plaintext secrets.
macOS gh authentication must use Keychain, which sandboxed commands cannot read.
Never print credential values.
"""
import os
from pathlib import Path
import re
import sys


def check():
    home = Path.home()
    config = Path(os.environ.get('GH_CONFIG_DIR', home / '.config/gh'))
    files = [config / 'hosts.yml', home / '.git-credentials', home / '.netrc']
    for path in files:
        if path.exists():
            value = path.read_text()
            if (path.name == 'hosts.yml' and re.search(r'oauth_token:\s*\S+', value)) or (
                path.name != 'hosts.yml' and 'github' in value.lower()
            ):
                print('Blocked: plaintext GitHub credential file; migrate host gh authentication to macOS Keychain before pilot', file=sys.stderr)
                return 1
    return 0


if __name__ == '__main__':
    sys.exit(check())
