import fcntl
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import current_pressure as p
import pressure_admission as a


class AdmissionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name).resolve()
        self.state.chmod(0o700)
        self.policy = dict(version=2, allowWarningPressure=True, policy=a.POLICY, issue='SHE-83',
                           maxConcurrentAgents=1, reviewedBy='test-fixture-operator',
                           reviewQuestionId=a.REVIEW_QUESTION_ID, expiresAt=5000)
        self.write(a.POLICY_FILE, self.policy)

    def write(self, name, value):
        path = self.state/name
        path.write_text(json.dumps(value)); path.chmod(0o600)

    def sample(self, stamp):
        return dict(platform='Darwin', pressure_level=1, boot_id='fixture-boot',
                    sampled_at=stamp, monotonic_seconds=stamp-500, collection_seconds=1,
                    headroom_estimate_bytes=3*p.GIB, swap_used_bytes=8*p.GIB,
                    swapouts_pages=10000, page_size_bytes=16384,
                    disk_free_bytes=20*p.GIB, cpu_busy_ratio=.2, errors=[])

    def check(self, stamp, sample=None, issue='SHE-83', limit=1):
        with patch.object(a.time, 'time', return_value=stamp), patch.object(a, '_collect', return_value=sample or self.sample(stamp)) as collect:
            result = a.check(issue, limit, self.state)
        return result, collect.call_count

    def test_first_early_then_stable_and_rolling_bound(self):
        self.assertFalse(self.check(1000)[0]['allow'])
        self.assertFalse(self.check(1010)[0]['allow'])
        self.assertTrue(self.check(1020)[0]['allow'])
        for stamp in (1030, 1040, 1050):
            self.assertTrue(self.check(stamp)[0]['allow'])
        retained = json.loads((self.state/a.SAMPLES_FILE).read_text())
        self.assertEqual(len(retained), 4)
        self.assertEqual(retained[-1]['sampled_at'], 1050)
        self.assertEqual((self.state/a.SAMPLES_FILE).stat().st_mode & 0o777, 0o600)

    def test_stale_reboot_counter_reset_hold_until_new_window(self):
        for change in (dict(boot_id='new'), dict(swapouts_pages=9999)):
            with self.subTest(change=change):
                self.write(a.SAMPLES_FILE, [self.sample(1000)])
                sample=self.sample(1020);sample.update(change)
                self.assertFalse(self.check(1020,sample)[0]['allow'])
        self.write(a.SAMPLES_FILE, [self.sample(900)])
        self.assertFalse(self.check(1020)[0]['allow'])

    def test_bad_intervening_sample_not_skipped(self):
        self.check(1000)
        bad=self.sample(1010);bad['pressure_level']=2
        self.check(1010,bad)
        self.assertFalse(self.check(1020)[0]['allow'])

    def test_approval_mismatch_expiry_and_cap(self):
        for key, value in [('version', True), ('policy', 'other'), ('issue', 'SHE-165'),
                           ('reviewedBy', ''), ('reviewQuestionId', 'invented'),
                           ('expiresAt', 999), ('expiresAt', 999999), ('maxConcurrentAgents', 2)]:
            changed=dict(self.policy);changed[key]=value;self.write(a.POLICY_FILE, changed)
            result,count=self.check(1000)
            self.assertFalse(result['allow']);self.assertEqual(count,0)
        self.write(a.POLICY_FILE,self.policy)
        for issue,limit in [('SHE-165',1),('SHE-83',2),('SHE-83',True)]:
            result,count=self.check(1000,issue=issue,limit=limit)
            self.assertFalse(result['allow']);self.assertEqual(count,0)

    def test_private_permissions_symlink_and_hardlink(self):
        policy=self.state/a.POLICY_FILE
        policy.chmod(0o644)
        self.assertFalse(self.check(1000)[0]['allow'])
        policy.chmod(0o600)
        os.link(policy,self.state/'copy')
        self.assertFalse(self.check(1000)[0]['allow'])
        (self.state/'copy').unlink()
        policy.rename(self.state/'original');policy.symlink_to(self.state/'original')
        self.assertFalse(self.check(1000)[0]['allow'])
        policy.unlink();(self.state/'original').rename(policy)
        self.state.chmod(0o755)
        self.assertFalse(self.check(1000)[0]['allow'])

    def test_lock_contention_holds_without_collection(self):
        lock=self.state/'current-pressure.lock'
        fd=os.open(lock,os.O_CREAT|os.O_RDWR,0o600)
        try:
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            result,count=self.check(1000)
            self.assertFalse(result['allow']);self.assertEqual(count,0)
        finally:os.close(fd)

    def test_revocation_during_collection(self):
        self.check(1000)
        def revoke():
            (self.state/a.POLICY_FILE).unlink()
            return self.sample(1020)
        with patch.object(a.time,'time',return_value=1020),patch.object(a,'_collect',side_effect=revoke):
            self.assertFalse(a.check('SHE-83',1,self.state)['allow'])

    def test_collector_timeout_and_cross_process_clock(self):
        import subprocess
        completed=subprocess.CompletedProcess([],0,json.dumps(self.sample(1000)), '')
        with patch.object(a.subprocess,'run',return_value=completed) as run, patch.object(a.time,'clock_gettime',return_value=9999):
            sample=a._collect()
        self.assertEqual(sample['monotonic_seconds'],9999)
        self.assertEqual(run.call_args.kwargs['timeout'],7)
        with patch.object(a.subprocess,'run',side_effect=subprocess.TimeoutExpired('fixture',7)):
            with patch.object(a.time,'time',return_value=1000):
                self.assertFalse(a.check('SHE-83',1,self.state)['allow'])

    def test_future_retained_sample_cannot_be_skipped(self):
        self.write(a.SAMPLES_FILE,[self.sample(1000),self.sample(1030)])
        self.assertFalse(self.check(1020)[0]['allow'])

    def test_malformed_samples_and_collection_failure(self):
        self.write(a.SAMPLES_FILE, {'not':'observations'})
        self.assertFalse(self.check(1000)[0]['allow'])
        (self.state/a.SAMPLES_FILE).unlink()
        with patch.object(a.time,'time',return_value=1000),patch.object(a,'_collect',side_effect=ValueError):
            self.assertFalse(a.check('SHE-83',1,self.state)['allow'])
        self.assertFalse((self.state/a.SAMPLES_FILE).exists())


if __name__ == '__main__': unittest.main()

class SwapInterveningTest(AdmissionTest):
    def test_over_limit_intervening_sample_cannot_be_skipped(self):
        self.check(1000)
        bad=self.sample(1010); bad['swap_used_bytes']=16*p.GIB+1
        self.check(1010,bad)
        self.assertFalse(self.check(1020)[0]['allow'])
