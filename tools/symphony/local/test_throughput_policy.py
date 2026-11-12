import time
import unittest

from throughput_policy import GIB, capacity_decision, rank_rows


def healthy():
    return dict(available_memory_bytes=8*GIB, swap_used_bytes=0, disk_free_bytes=30*GIB, cpu_load_ratio=.3)


class PolicyTest(unittest.TestCase):
    def test_missing_ranking_retains_priority_and_identifier(self):
        rows=[dict(id='a',identifier='SHE-1',priority=3),dict(id='b',identifier='SHE-2',priority=1)]
        self.assertEqual(rank_rows(rows, {})[0]['id'],'b')
        self.assertNotIn('eligible',rows[0])

    def test_lanes_prevent_research_from_consuming_every_short_slot(self):
        rows=[dict(id=str(i),identifier=f'SHE-{i}',eligible=True) for i in range(12)]
        reviews={str(i):dict(scheduling=dict(lane='fast' if i<6 else 'feature' if i<10 else 'research',
                    gameplayImpact=3,effortHours=1,successProbability=.9)) for i in range(12)}
        ranked=rank_rows(rows,dict(reviews=reviews))
        self.assertEqual([reviews[r['id']]['scheduling']['lane'] for r in ranked[:6]],
                         ['fast','fast','fast','feature','feature','research'])
        self.assertEqual(set(r['id'] for r in ranked),set(r['id'] for r in rows))

    def test_scoring_rewards_useful_small_work_without_changing_eligibility(self):
        rows=[dict(id='a',identifier='SHE-1',eligible=False),dict(id='b',identifier='SHE-2',eligible=True)]
        reviews={key:dict(scheduling=dict(lane='fast',gameplayImpact=5,effortHours=effort,successProbability=.9))
                 for key,effort in [('a',.5),('b',3)]}
        ranked=rank_rows(rows,dict(reviews=reviews))
        self.assertEqual(ranked[0]['id'],'a')
        self.assertFalse(ranked[0]['eligible'])
        for change in [dict(lane='unknown'),dict(effortHours=0),dict(successProbability=float('nan'))]:
            with self.assertRaises(ValueError): rank_rows(rows,dict(reviews={'a':dict(scheduling=change)}))

    def test_real_swap_pressure_holds_new_grants_without_cancelling_work(self):
        values=healthy();values['swap_used_bytes']=28*GIB
        decision=capacity_decision(values,1,1)
        self.assertEqual(decision['grant_limit'],0)
        self.assertFalse(decision['active_workers_cancelled'])

    def test_unknown_stale_disk_memory_and_cpu_measurements_hold(self):
        for key,value in [('available_memory_bytes',GIB),('disk_free_bytes',GIB),('cpu_load_ratio',.9),('sampled_at',time.time()-90)]:
            values=healthy();values[key]=value
            self.assertTrue(capacity_decision(values,1)['hold_new_grants'])
        self.assertTrue(capacity_decision({},1)['hold_new_grants'])
        for val in [True,0,13]:
            with self.assertRaises(ValueError): capacity_decision(healthy(),val)

    def test_four_six_eight_twelve_are_modeled_not_invented_live_capacity(self):
        for requested in [4,6,8,12]:
            decision=capacity_decision(healthy(),requested,requested)
            self.assertEqual(decision['grant_limit'],1)
            self.assertEqual(decision['live_capacity_claim'],1)
        self.assertEqual(capacity_decision(healthy(),1,12)['grant_limit'],1)

    def test_scale_requires_evidence_and_degradation_reduces_new_grants(self):
        evidence=dict(observedConcurrency=1,scaleApprovedBy='fixture operator',sampleWorkerHours=2,
                      acceptedChangesPerWorkerHour=2,baselineAcceptedChangesPerWorkerHour=1,
                      failureRate=0,retryRate=0,reviewBacklog=1)
        self.assertEqual(capacity_decision(healthy(),4,4,evidence)['grant_limit'],4)
        evidence['failureRate']=.3
        self.assertEqual(capacity_decision(healthy(),4,4,evidence)['grant_limit'],1)
        evidence['reviewBacklog']=3
        self.assertTrue(capacity_decision(healthy(),4,4,evidence)['hold_new_grants'])


if __name__=='__main__': unittest.main()
