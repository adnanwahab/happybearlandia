import copy
from datetime import datetime, timezone
import json
import multiprocessing
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error

import backlog_coordinator as c
from test_backlog_coordinator import FakeServices, FileServices, issue, review, pr
import throughput_scheduler as s
from throughput_policy import GIB


def runtime():
    return dict(generated_at=datetime.now(timezone.utc).isoformat(),counts=dict(running=0,retrying=0,blocked=0),running=[],retrying=[],blocked=[])


def resources():
    return dict(available_memory_bytes=8*GIB,swap_used_bytes=0,disk_free_bytes=30*GIB,cpu_load_ratio=.2)


class FakeMetrics:
    def __init__(self):self.samples=[]
    def observe(self,*args,**kwargs):self.samples.append(args)
    def snapshot(self,**kwargs):return {'samples':len(self.samples)}


def scheduler_child(directory, remote, config):
    s.run_loop(FileServices(remote),lambda:config,Path(directory),1,runtime,resources,
               apply=True,refresh=lambda:None)


class SchedulerTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.directory=Path(self.tmp.name)/'state'
        self.issues=[issue(n) for n in range(1,4)]
        self.services=FakeServices(self.issues)
        self.config=dict(version=1,projectId=c.PROJECT,cap=3,enableApprovals=True,
                         overlapReconciledBy='fixture coordinator',reviews={i['id']:review(i) for i in self.issues},releases={})
        self.refreshes=[]
        self.kw=dict(services=self.services,config_loader=lambda:copy.deepcopy(self.config),directory=self.directory,
                     current_limit=1,runtime_reader=runtime,resource_reader=resources,apply=True,
                     refresh=lambda:self.refreshes.append(1),sleep=lambda _:None)

    def test_one_cycle_respects_actual_worker_limit_and_durable_restart(self):
        metrics=FakeMetrics()
        report=s.run_loop(**self.kw,metrics=metrics)[0]
        self.assertEqual(self.services.calls,['id-1'])
        self.assertEqual(report['cap'],1)
        self.assertEqual(report['scheduler']['new_grants'],1)
        self.assertEqual(self.refreshes,[1])
        s.run_loop(**self.kw)
        self.assertEqual(self.services.calls,['id-1'])
        self.assertEqual(json.loads((self.directory/'throughput.json').read_text()),{'samples':1})

    def test_two_scheduler_processes_share_atomic_lease_and_never_duplicate_grant(self):
        remote=Path(self.tmp.name)/'remote.json'
        remote.write_text(json.dumps(self.services.snapshot))
        processes=[multiprocessing.Process(target=scheduler_child,args=(str(self.directory),str(remote),self.config)) for _ in range(2)]
        for process in processes:process.start()
        for process in processes:
            process.join(10)
            self.assertFalse(process.is_alive())
            self.assertEqual(process.exitcode,0)
        self.assertEqual(json.loads(remote.read_text())['approvals'],['id-1'])
        self.assertEqual(len(c.load_state(self.directory)['leases']),1)

    def test_verified_handoff_replenishes_next_cycle_without_duplicate(self):
        def handoff(_):
            self.services.snapshot['issues'][0]['labels'].pop(c.APPROVAL_LABEL,None)
            self.services.snapshot['issues'][0]['state']='In Progress'
            self.services.snapshot['prs']=[pr(1,self.issues[0])]
        args=dict(self.kw,sleep=handoff)
        reports=s.run_loop(**args,max_cycles=2)
        self.assertEqual(self.services.calls,['id-1','id-2'])
        self.assertEqual(reports[1]['selected'],['SHE-2'])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'released')

    def test_ambiguous_mutation_restarts_from_pending_and_remote_label(self):
        self.services.failure='after'
        report=s.run_loop(**self.kw)[0]
        self.assertIsNotNone(report['scheduler']['error'])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'pending')
        self.services.failure=None
        s.run_loop(**self.kw)
        self.assertEqual(self.services.calls,['id-1'])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'active')

    def test_pressure_or_stale_runtime_audits_but_never_grants(self):
        values=resources();values['swap_used_bytes']=28*GIB
        result=s.run_loop(**dict(self.kw,resource_reader=lambda:values))[0]
        self.assertFalse(result['scheduler']['apply_effective'])
        self.assertEqual(self.services.calls,[])
        old=runtime();old['generated_at']='2000-01-01T00:00:00Z'
        s.run_loop(**dict(self.kw,runtime_reader=lambda:old))
        self.assertEqual(self.services.calls,[])

    def test_deterministic_failure_stops_and_does_not_persist_exception_text(self):
        def bad():raise ValueError('SECRET never persist this')
        reports=s.run_loop(**dict(self.kw,config_loader=bad),max_cycles=20)
        self.assertEqual(len(reports),1)
        self.assertNotIn('SECRET',(self.directory/'scheduler-status.json').read_text())
        self.assertEqual(self.services.reads,0)

    def test_transient_failure_has_three_attempt_budget_and_backoff(self):
        delays=[]
        def bad():raise c.host.PublicationError('fixture transient')
        reports=s.run_loop(**dict(self.kw,config_loader=bad,sleep=delays.append),max_cycles=20)
        self.assertEqual(len(reports),3)
        self.assertEqual(delays,[15,30])
        self.assertEqual(self.services.calls,[])

    def test_runtime_transient_network_failure_is_bounded_but_auth_failure_stops(self):
        def unavailable():raise urllib.error.URLError('fixture unavailable')
        self.assertEqual(len(s.run_loop(**dict(self.kw,runtime_reader=unavailable),max_cycles=10)),3)
        def forbidden():raise urllib.error.HTTPError(s.RUNTIME_URL,401,'fixture auth',{},None)
        self.assertEqual(len(s.run_loop(**dict(self.kw,runtime_reader=forbidden),max_cycles=10)),1)
        self.assertEqual(self.services.calls,[])

    def test_disabled_approval_and_stop_signal_never_mutate(self):
        self.config['enableApprovals']=False
        self.assertEqual(len(s.run_loop(**self.kw,max_cycles=4)),1)
        self.assertEqual(self.services.calls,[])
        stop=threading.Event();stop.set()
        self.assertEqual(s.run_loop(**self.kw,stop=stop),[])

    def test_refresh_failure_retains_successful_grant_without_reexecution(self):
        def bad():raise RuntimeError('fixture unavailable')
        result=s.run_loop(**dict(self.kw,refresh=bad))[0]
        self.assertFalse(result['scheduler']['refresh_accepted'])
        s.run_loop(**self.kw)
        self.assertEqual(self.services.calls,['id-1'])

    def test_watchdog_keeps_old_lease_and_reports_publication_gap(self):
        report=dict(leases={'id-1':dict(identifier='SHE-1',status='active',createdAt=1)},
                    publication_receipts=[dict(identifier='SHE-1',status='committed',at=1)],
                    pullRequests=[dict(number=4,state='open',ci_status='pending',ci_started_at=1)])
        alarms=s.watchdog(runtime(),report,resources())
        self.assertEqual({a['code'] for a in alarms},{'retained-lease-needs-reconciliation','worker-unobserved-or-publication-missing','commit-without-draft-pr','stalled-ci'})
        self.assertEqual(report['leases']['id-1']['status'],'active')

    def test_workflow_limit_is_real_key_and_rejects_ambiguous_config(self):
        path=Path(self.tmp.name)/'WORKFLOW.md'
        path.write_text('---\nagent:\n  max_concurrent_agents: 1\n  max_turns: 20\n---\nPrompt')
        self.assertEqual(s.workflow_limit(path),1)
        for text in ['---\nagent:\n  max_concurrent_agents: 1\n  max_concurrent_agents: 8\n---\n',
                     '---\nagent:\n  max_concurrent_agents: $WORKERS\n---\n']:
            path.write_text(text)
            with self.assertRaises(ValueError):s.workflow_limit(path)

    def test_actual_limit_is_reloaded_each_cycle(self):
        limits=iter([2,1])
        config=copy.deepcopy(self.config);config['scaling']=dict(observedConcurrency=2)
        results=s.run_loop(**dict(self.kw,current_limit=lambda:next(limits),config_loader=lambda:config),max_cycles=2)
        self.assertEqual([r['max_workers'] for r in results],[2,1])
        self.assertEqual(len(self.services.calls),2)


if __name__=='__main__':unittest.main()
