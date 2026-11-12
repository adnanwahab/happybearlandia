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

    def test_observation_adapter_reuses_inventory_without_changing_apply_services(self):
        from unittest.mock import Mock, patch
        service=Mock()
        with patch('inventory_cache.InventoryCache') as cache:
            adapter=s._ObservationServices(service,self.directory)
            adapter.scan()
            cache.return_value.scan.assert_called_once_with(observation=True)
            self.assertEqual(adapter.approve,cache.return_value.approve)

    def test_two_readonly_cycles_share_one_full_inventory_and_keep_cache_age(self):
        for task in self.services.snapshot['issues']: task['relations'] = []
        adapter=s._ObservationServices(self.services,self.directory/'inventory-cache')
        results=s.run_loop(**dict(self.kw,services=adapter,apply=False),max_cycles=2)
        self.assertEqual(self.services.reads,1)
        self.assertFalse(results[0]['inventoryCache']['hit'])
        self.assertTrue(results[1]['inventoryCache']['hit'])
        self.assertEqual(results[1]['scheduler']['observation_interval_seconds'],60)
        self.assertEqual(results[1]['scheduler']['full_scan_interval_seconds'],300)
        self.assertEqual(self.services.calls,[])

    def test_one_cycle_respects_actual_worker_limit_and_durable_restart(self):
        metrics=FakeMetrics()
        report=s.run_loop(**self.kw,metrics=metrics)[0]
        self.assertEqual(self.services.calls,['id-1'])
        self.assertEqual(report['cap'],1)
        self.assertEqual(report['scheduler']['new_grants'],1)
        self.assertEqual(self.refreshes,[1])
        self.assertEqual(self.services.reads,2)  # audit + mandatory fresh pre-grant inventory
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
        self.assertEqual(delays,[60,120])
        self.assertEqual(self.services.calls,[])

    def test_runtime_transient_network_failure_is_bounded_but_auth_failure_stops(self):
        def unavailable():raise urllib.error.URLError('fixture unavailable')
        self.assertEqual(len(s.run_loop(**dict(self.kw,runtime_reader=unavailable),max_cycles=10)),3)
        def forbidden():raise urllib.error.HTTPError(s.RUNTIME_URL,401,'fixture auth',{},None)
        self.assertEqual(len(s.run_loop(**dict(self.kw,runtime_reader=forbidden),max_cycles=10)),1)
        self.assertEqual(self.services.calls,[])

    def test_stop_during_final_guard_preserves_pending_without_approval(self):
        stop=threading.Event()
        def final_resources():
            if self.services.reads >= 2:
                stop.set()
            return resources()
        reports=s.run_loop(**dict(self.kw,stop=stop,resource_reader=final_resources),max_cycles=3)
        self.assertEqual(len(reports),1)
        self.assertEqual(self.services.calls,[])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'pending')
        self.assertTrue(reports[0]['scheduler']['stopped'])
        self.assertIsNone(reports[0]['scheduler']['error'])

    def test_disabled_approval_and_stop_signal_never_mutate(self):
        self.config['enableApprovals']=False
        reports=s.run_loop(**self.kw,max_cycles=4)
        self.assertEqual(len(reports),4)
        self.assertEqual(self.services.calls,[])
        self.assertTrue(all(r['scheduler']['error'] is None for r in reports))
        self.assertTrue(all('operator-approvals-disabled' in [a['code'] for a in r['scheduler']['watchdog']] for r in reports))
        stop=threading.Event();stop.set()
        self.assertEqual(s.run_loop(**self.kw,stop=stop),[])

    def test_pregrant_retained_lease_watchdog_blocks_new_work_at_free_capacity(self):
        s.run_loop(**self.kw)
        state=c.load_state(self.directory)
        state['leases']['id-1']['createdAt']=1
        c.atomic(self.directory/'leases.json',state)
        self.config['scaling']=dict(observedConcurrency=2)
        report=s.run_loop(**dict(self.kw,current_limit=2))[0]
        self.assertEqual(self.services.calls,['id-1'])
        self.assertFalse(report['scheduler']['apply_effective'])
        self.assertIn('retained-lease-needs-reconciliation',[a['code'] for a in report['scheduler']['watchdog']])

    def test_known_commit_without_pr_and_actual_review_backlog_block_before_grant(self):
        self.services.snapshot['publication_receipts']=[dict(identifier='SHE-99',status='committed',at=1)]
        report=s.run_loop(**self.kw)[0]
        self.assertEqual(self.services.calls,[])
        self.assertIn('commit-without-draft-pr',[a['code'] for a in report['scheduler']['watchdog']])
        self.services.snapshot.pop('publication_receipts')
        self.services.snapshot['prs']=[dict(number=i,state='open',head=dict(ref='unrelated'),files=[]) for i in range(3)]
        report=s.run_loop(**self.kw)[0]
        self.assertEqual(self.services.calls,[])
        self.assertEqual(report['scheduler']['review_backlog'],3)
        self.assertIn('review-capacity-reserved',[a['code'] for a in report['scheduler']['watchdog']])

    def test_new_review_backlog_or_publication_hold_during_fresh_scan_retains_pending_without_label(self):
        for kind in ['review','publication']:
            with self.subTest(kind=kind):
                services=FakeServices(self.issues)
                def change(service):
                    if service.reads==2:
                        if kind=='review':
                            service.snapshot['prs']=[dict(number=i,title='unrelated',body='',state='open',head=dict(ref='misc'),files=[]) for i in range(3)]
                        else:
                            service.snapshot['publication_receipts']=[dict(identifier='SHE-99',status='committed',at=1)]
                services.change=change
                directory=Path(self.tmp.name)/kind
                result=s.run_loop(**dict(self.kw,services=services,directory=directory))[0]
                self.assertEqual(services.calls,[])
                self.assertFalse(result['scheduler']['apply_effective'])
                self.assertIsNone(result['scheduler']['error'])
                self.assertEqual(c.load_state(directory)['leases']['id-1']['status'],'pending')
                expected='review-capacity-reserved' if kind=='review' else 'commit-without-draft-pr'
                self.assertIn(expected,[a['code'] for a in result['scheduler']['watchdog']])
                if kind=='review':self.assertEqual(result['scheduler']['review_backlog'],3)

    def test_pressure_and_policy_changes_during_mandatory_scan_block_final_mutation(self):
        for kind in ['resources','policy','runtime']:
            with self.subTest(kind=kind):
                changed=[]
                services=FakeServices(self.issues)
                def change(service):
                    if service.reads==2:changed.append(True)
                services.change=change
                def fresh_resources():
                    value=resources()
                    if changed and kind=='resources':value['swap_used_bytes']=28*GIB
                    return value
                def fresh_runtime():
                    value=runtime()
                    if changed and kind=='runtime':value['generated_at']='2000-01-01T00:00:00Z'
                    return value
                def fresh_config():
                    return dict(self.config,enableApprovals=False) if changed and kind=='policy' else copy.deepcopy(self.config)
                directory=Path(self.tmp.name)/kind
                result=s.run_loop(**dict(self.kw,services=services,directory=directory,resource_reader=fresh_resources,
                    runtime_reader=fresh_runtime,config_loader=fresh_config))[0]
                self.assertEqual(services.calls,[])
                self.assertEqual(c.load_state(directory)['leases']['id-1']['status'],'pending')
                self.assertFalse(result['scheduler']['apply_effective'])
                self.assertIsNone(result['scheduler']['error'])

    def test_disabled_observation_resumes_only_after_explicit_policy_becomes_enabled(self):
        self.config['enableApprovals']=False
        def enable(_):self.config['enableApprovals']=True
        reports=s.run_loop(**dict(self.kw,sleep=enable),max_cycles=2)
        self.assertFalse(reports[0]['scheduler']['apply_effective'])
        self.assertTrue(reports[1]['scheduler']['apply_effective'])
        self.assertEqual(self.services.calls,['id-1'])

    def test_shutdown_during_scan_prevents_additive_approval_and_retains_pending(self):
        for during_read in [1,2]:
            with self.subTest(during_read=during_read):
                stop=threading.Event()
                services=FakeServices(self.issues)
                def stopping(service):
                    if service.reads==during_read:stop.set()
                services.change=stopping
                directory=Path(self.tmp.name)/f'stop-{during_read}'
                result=s.run_loop(**dict(self.kw,services=services,stop=stop,directory=directory),max_cycles=3)
                self.assertEqual(services.calls,[])
                self.assertIsNone(result[0]['scheduler']['error'])
                if during_read==2:
                    self.assertEqual(c.load_state(directory)['leases']['id-1']['status'],'pending')

    def test_full_scan_budget_and_fresh_operator_policy_are_enforced(self):
        for interval in [5,15,59]:
            with self.assertRaises(ValueError):s.run_loop(**self.kw,interval=interval)
        config=copy.deepcopy(self.config)
        calls=[]
        def changed():
            calls.append(1)
            return config if len(calls)==1 else dict(config,enableApprovals=False)
        result=s.run_loop(**dict(self.kw,config_loader=changed))[0]
        self.assertEqual(self.services.calls,[])
        self.assertIn('operator-evidence-changed-during-scan',[a['code'] for a in result['scheduler']['watchdog']])

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
        limits=[2]
        config=copy.deepcopy(self.config);config['scaling']=dict(observedConcurrency=2)
        results=s.run_loop(**dict(self.kw,current_limit=lambda:limits[0],config_loader=lambda:config,sleep=lambda _:limits.__setitem__(0,1)),max_cycles=2)
        self.assertEqual([r['max_workers'] for r in results],[2,1])
        self.assertEqual(len(self.services.calls),2)


if __name__=='__main__':unittest.main()
