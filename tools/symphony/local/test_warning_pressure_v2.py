import unittest
import current_pressure as p
import test_current_pressure as fixtures

class WarningPressureV2Test(unittest.TestCase):
 def samples(self):
  samples=fixtures.CurrentPressureTest().samples()
  for s in samples:s.update(pressure_level=2,headroom_estimate_bytes=4*p.GIB)
  return samples
 def decide(self,samples):return p.evaluate(samples,now=1021,allow_warning_pressure=True)
 def test_warning_is_opt_in_and_does_not_skip_headroom(self):
  samples=self.samples();self.assertFalse(p.evaluate(samples,now=1021)['allow']);self.assertTrue(self.decide(samples)['allow'])
  samples[0]['headroom_estimate_bytes']-=1;self.assertFalse(self.decide(samples)['allow'])
 def test_critical_pressure_never_admitted(self):
  for level in [4,True,3,None]:
   samples=self.samples();samples[1]['pressure_level']=level;self.assertFalse(self.decide(samples)['allow'])
 def test_warning_never_bypasses_paging_cpu_or_disk(self):
  for field,value in [('cpu_busy_ratio',.851),('disk_free_bytes',10*p.GIB-1),('swapouts_pages',100000),('swap_used_bytes',9*p.GIB)]:
   samples=self.samples();samples[1][field]=value;self.assertFalse(self.decide(samples)['allow'])
 def test_normal_pressure_keeps_two_gib_headroom_requirement(self):
  self.assertTrue(self.decide(fixtures.CurrentPressureTest().samples())['allow'])
