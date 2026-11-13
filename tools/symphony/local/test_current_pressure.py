import copy
import unittest
import subprocess
from unittest.mock import patch
import current_pressure as p


class CurrentPressureTest(unittest.TestCase):
    def samples(self):
        first = dict(platform='Darwin', pressure_level=1, boot_id='boot-a',
                     sampled_at=1000, monotonic_seconds=500, collection_seconds=1,
                     headroom_estimate_bytes=2*p.GIB, swap_used_bytes=8*p.GIB,
                     swapouts_pages=1000, page_size_bytes=16384,
                     disk_free_bytes=10*p.GIB, cpu_busy_ratio=.85, errors=[])
        return [first, dict(first, sampled_at=1020, monotonic_seconds=520)]

    def decision(self, samples=None, **options):
        return p.evaluate(self.samples() if samples is None else samples, now=1021, **options)

    def test_idle_historical_swap_warns_without_veto(self):
        result = self.decision()
        self.assertTrue(result['allow'])
        self.assertEqual(len(result['warnings']), 2)
        self.assertEqual(result['metrics']['swapout_bytes_per_second'], 0)
        self.assertFalse(result['active_workers_cancelled'])
        self.assertEqual(result['activation'], 'operator-review-required')

    def test_each_sample_must_meet_every_gate(self):
        for index in (0, 1):
            for field, value in [('platform', 'Linux'), ('pressure_level', 2),
                                 ('pressure_level', 4), ('pressure_level', True),
                                 ('boot_id', ''), ('headroom_estimate_bytes', 2*p.GIB-1),
                                 ('disk_free_bytes', 10*p.GIB-1), ('cpu_busy_ratio', .85001),
                                 ('collection_seconds', 11), ('errors', ['timeout'])]:
                samples = self.samples(); samples[index][field] = value
                with self.subTest(index=index, field=field, value=value):
                    self.assertFalse(self.decision(samples)['allow'])

    def test_missing_negative_nan_and_boolean_hold(self):
        for field in ('sampled_at', 'monotonic_seconds', 'collection_seconds',
                      'headroom_estimate_bytes', 'swap_used_bytes', 'swapouts_pages',
                      'page_size_bytes', 'disk_free_bytes', 'cpu_busy_ratio'):
            for value in (None, -1, float('nan'), float('inf'), True):
                samples = self.samples(); samples[0][field] = value
                with self.subTest(field=field, value=value):
                    self.assertFalse(self.decision(samples)['allow'])

    def test_continuity_and_staleness(self):
        for changes in (dict(boot_id='new-boot'), dict(swapouts_pages=999),
                        dict(page_size_bytes=4096), dict(monotonic_seconds=500),
                        dict(monotonic_seconds=514), dict(monotonic_seconds=531),
                        dict(sampled_at=1017), dict(sampled_at=1022)):
            samples = self.samples(); samples[1].update(changes)
            self.assertFalse(self.decision(samples)['allow'], changes)
        self.assertFalse(p.evaluate(self.samples(), now=1051)['allow'])
        self.assertFalse(p.evaluate(self.samples(), now=999)['allow'])

    def test_swap_rates_and_inclusive_boundaries(self):
        samples = self.samples()
        samples[1]['swapouts_pages'] += 1280  # exactly 1 MiB/sec
        samples[1]['swap_used_bytes'] += 20*256*1024
        self.assertTrue(self.decision(samples)['allow'])
        samples[1]['swapouts_pages'] += 1
        self.assertFalse(self.decision(samples)['allow'])
        samples = self.samples(); samples[1]['swap_used_bytes'] += 20*256*1024+1
        self.assertFalse(self.decision(samples)['allow'])
        samples = self.samples(); samples[1]['swap_used_bytes'] -= p.GIB
        self.assertTrue(self.decision(samples)['allow'])

    def test_single_worker_and_exact_pair_only(self):
        for limit in (0, 2, 12, True, None):
            self.assertFalse(self.decision(current_limit=limit)['allow'])
        for samples in (None, [], [{}], [{}, {}, {}], [None, None]):
            self.assertFalse(p.evaluate(samples, now=1021)['allow'])
        self.assertFalse(p.evaluate(self.samples(), now=float('nan'))['allow'])

    def test_interval_boundaries(self):
        for elapsed in (15, 30):
            samples = self.samples()
            samples[1].update(sampled_at=1000+elapsed, monotonic_seconds=500+elapsed)
            self.assertTrue(p.evaluate(samples, now=1000+elapsed)['allow'])

    def test_timeout_and_wrong_platform_are_held(self):
        with patch.object(p.platform, 'system', return_value='Darwin'), patch.object(p.subprocess, 'run', side_effect=subprocess.TimeoutExpired('fixture', 3)):
            self.assertTrue(p.collect()['errors'])
        with patch.object(p.platform, 'system', return_value='Linux'), patch.object(p.subprocess, 'run') as run:
            self.assertTrue(p.collect()['errors'])
            run.assert_not_called()

    def test_no_input_mutation(self):
        samples = self.samples(); before = copy.deepcopy(samples)
        self.decision(samples)
        self.assertEqual(samples, before)

    def test_native_parser_and_units(self):
        values = ('1\n', 'The system has 17179869184 (1048576 pages with a page size of 16384).\nSystem-wide memory free percentage: 33%\n',
                  'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nSwapouts: 528260030.\n',
                  '{ sec = 1789613553, usec = 300808 }\n',
                  'total = 22528.00M  used = 21469.38M  free = 1058.62M (encrypted)',
                  'Filesystem 1024-blocks Used Available Capacity\n/dev/disk3 239362496 17964908 43266896 30%\n',
                  'CPU usage: 16.19% user, 11.87% sys, 71.92% idle\n')
        parsed = p.parse_native(*values)
        self.assertEqual(parsed['headroom_estimate_bytes'], 17179869184*.33)
        self.assertEqual(parsed['swapouts_pages'], 528260030)
        self.assertAlmostEqual(parsed['cpu_busy_ratio'], .2808)
        self.assertEqual(parsed['disk_free_bytes'], 43266896*1024)
        for index in range(len(values)):
            invalid = list(values); invalid[index] = ''
            if index == 3:  # boot identity is validated by evaluate
                continue
            with self.assertRaises((ValueError, IndexError)):
                p.parse_native(*invalid)

    def test_failed_native_collection_never_guesses(self):
        with patch.object(p.platform, 'system', return_value='Darwin'), patch.object(p.subprocess, 'run', side_effect=OSError):
            result = p.collect()
        self.assertTrue(result['errors'])
        self.assertNotIn('headroom_estimate_bytes', result)
        self.assertFalse(p.evaluate([result, result])['allow'])


if __name__ == '__main__':
    unittest.main()

class SwapCeilingTest(CurrentPressureTest):
    def test_swap_ceiling_inclusive_both_endpoints(self):
        for used, allowed in ((15*p.GIB, True), (16*p.GIB, True), (16*p.GIB+1, False)):
            samples=self.samples()
            for sample in samples: sample['swap_used_bytes']=used
            self.assertEqual(self.decision(samples)['allow'], allowed)
        samples=self.samples(); samples[0]['swap_used_bytes']=16*p.GIB+1
        self.assertFalse(self.decision(samples)['allow'])
