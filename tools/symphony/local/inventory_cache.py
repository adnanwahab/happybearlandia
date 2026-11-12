"""Short-lived host-private inventory reuse for observation, never dispatch authority.

scanMetrics belong to the original full scan. inventoryCache reports cache age and
hit status separately; a hit does not mean that the original scan used zero calls.
"""
import copy
import json
import math
import os
from pathlib import Path
import re
import stat
import time
import uuid

import coordinator_host as host


class InventoryCache:
    version = 1
    filename = 'inventory.json'

    def __init__(self, services, directory, ttl_seconds=300, *, clock=time.time):
        if type(ttl_seconds) is not int or not 60 <= ttl_seconds <= 300:
            raise ValueError('Inventory cache TTL must be 60–300 seconds')
        self.services = services
        self.directory = Path(directory)
        self.ttl_seconds = ttl_seconds
        self.clock = clock

    def __getattr__(self, name):
        # Approval and label operations are unchanged underlying host operations.
        return getattr(self.services, name)

    def _directory_fd(self):
        try:
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            fd = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        except OSError:
            raise host.PublicationError('Inventory cache directory is unsafe or unavailable') from None
        info = os.fstat(fd)
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            os.close(fd)
            raise host.PublicationError('Inventory cache directory must be host-owned and mode700')
        return fd

    @staticmethod
    def _timestamp(value):
        return type(value) in (int, float) and math.isfinite(value) and value > 0

    @classmethod
    def _valid_snapshot(cls, snapshot, now):
        if (not isinstance(snapshot, dict) or not isinstance(snapshot.get('issues'), list) or
                not isinstance(snapshot.get('prs'), list) or
                not re.fullmatch('[a-f0-9]{40}', str(snapshot.get('baseSha', ''))) or
                not cls._timestamp(snapshot.get('scannedAt')) or snapshot['scannedAt'] > now or
                snapshot.get('partial') is True or snapshot.get('complete') is False):
            return False
        required = {'id', 'identifier', 'state', 'labels', 'comments', 'blockedBy', 'attachments'}
        for issue in snapshot['issues']:
            if (not isinstance(issue, dict) or not required.issubset(issue) or
                    not all(isinstance(issue[k], str) and issue[k] for k in ('id', 'identifier', 'state')) or
                    not isinstance(issue['labels'], dict) or
                    any(not isinstance(issue[k], list) for k in ('comments', 'blockedBy', 'attachments'))):
                return False
        if len({i['id'] for i in snapshot['issues']}) != len(snapshot['issues']):
            return False
        for pr in snapshot['prs']:
            if (not isinstance(pr, dict) or type(pr.get('number')) is not int or pr['number'] < 1 or
                    pr.get('state') not in ('open', 'closed') or not isinstance(pr.get('head'), dict) or
                    not isinstance(pr.get('base'), dict) or not isinstance(pr.get('files'), list)):
                return False
        return True

    def _load(self, directory_fd):
        try:
            fd = os.open(self.filename, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory_fd)
        except FileNotFoundError:
            return None
        except OSError:
            raise host.PublicationError('Inventory cache path is unsafe; preserve and reconcile') from None
        with os.fdopen(fd) as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or
                    stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1):
                raise host.PublicationError('Inventory cache must be a private host-owned regular file without links')
            try:
                return json.load(stream)
            except (ValueError, UnicodeError):
                return None

    def _write(self, directory_fd, value):
        # Recheck an existing destination before replacing it; never follow links.
        self._load(directory_fd)
        payload = json.dumps(value, allow_nan=False, sort_keys=True) + '\n'
        temporary = '.inventory-' + uuid.uuid4().hex
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=directory_fd)
        try:
            with os.fdopen(fd, 'w') as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.filename, src_dir_fd=directory_fd, dst_dir_fd=directory_fd)
            os.fsync(directory_fd)
        finally:
            try:
                os.unlink(temporary, dir_fd=directory_fd)
            except FileNotFoundError:
                pass

    def _decorate(self, snapshot, *, hit, age, observation):
        result = copy.deepcopy(snapshot)
        result['inventoryCache'] = dict(hit=hit, ageSeconds=age, ttlSeconds=self.ttl_seconds,
                                        observationOnly=observation)
        return result

    def scan(self, *, observation=False, apply=False):
        if type(observation) is not bool or type(apply) is not bool:
            raise ValueError('Inventory cache observation/apply modes must be explicit booleans')
        # Apply and unspecified modes do not even read/write the cache directory.
        if not observation or apply:
            return self._decorate(self.services.scan(), hit=False, age=0, observation=False)
        fd = self._directory_fd()
        try:
            now = self.clock()
            if not self._timestamp(now):
                raise host.PublicationError('Inventory cache clock is invalid')
            receipt = self._load(fd)
            if (isinstance(receipt, dict) and type(receipt.get('version')) is int and receipt['version'] == self.version and
                    receipt.get('invalidated') is not True and self._timestamp(receipt.get('cachedAt')) and
                    receipt['cachedAt'] <= now and now - receipt['cachedAt'] < self.ttl_seconds and
                    self._valid_snapshot(receipt.get('snapshot'), receipt['cachedAt']) and
                    now - receipt['snapshot']['scannedAt'] < self.ttl_seconds):
                return self._decorate(receipt['snapshot'], hit=True,
                                      age=now - receipt['snapshot']['scannedAt'], observation=True)
            # No stale fallback: an underlying failure propagates with the old
            # receipt untouched. Only a complete new scan can replace it.
            snapshot = self.services.scan()
            after = self.clock()
            if not self._timestamp(after) or not self._valid_snapshot(snapshot, after):
                raise host.PublicationError('Inventory cache received an incomplete or invalid snapshot')
            self._write(fd, dict(version=self.version, cachedAt=after,
                                 snapshot=copy.deepcopy(snapshot)))
            return self._decorate(snapshot, hit=False, age=max(0, after - snapshot['scannedAt']),
                                  observation=True)
        finally:
            os.close(fd)

    def invalidate(self):
        """Mark only this cache receipt stale, retaining its prior snapshot."""
        fd = self._directory_fd()
        try:
            receipt = self._load(fd)
            value = copy.deepcopy(receipt) if isinstance(receipt, dict) else {'version': self.version}
            value.update(invalidated=True, invalidatedAt=self.clock())
            self._write(fd, value)
        finally:
            os.close(fd)
