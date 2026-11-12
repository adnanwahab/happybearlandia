"""Offline services pilot; never starts Symphony or changes real issues."""
import copy
import json
import multiprocessing
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import backlog_coordinator as c
import coordinator_host as host


def issue(n):
    return dict(id=f'id-{n}', identifier=f'SHE-{n}', title=f'Approved fixture {n}', description='bounded fixture task',
                priority=n, state='Todo', team={'id': 'team'}, labels={c.REVIEW_LABEL: 'review'},
                comments=[], blockedBy=[], attachments=[])


def review(i):
    return dict(issueDigest=c.digest(i), baseSha='a'*40, expiresAt=time.time()+3600,
                branch='symphony/'+i['identifier'], reviewedBy='fixture-operator',
                dependencyAudit='Reviewed prose/aliases; no unlisted prerequisites',
                duplicateAudit='Source/merged/open PR audit complete; implementation absent',
                ownershipAudit='Isolated clone; no competing external ownership',
                cleanBaseEvidence='Clean exact sprint base, issue branch and clone preflight audited',
                testEvidence='Exact argv verified runnable at pinned base', implementationAbsent=True,
                files=[f'feature/{i["identifier"]}.py'], interfaces=[], tests=[['python3', '-m', 'unittest']],
                acceptance=['Fixture outcome is observable'], dependencies=[], verifiedPrerequisites={})


def pr(n, i, state='open', draft=True):
    return dict(number=n, title=i['identifier']+' fixture', body='', head={'ref':'symphony/'+i['identifier'], 'sha':'b'*40, 'repo':{'full_name':host.REPO}},
                base={'ref':host.BASE, 'repo':{'full_name':host.REPO}}, html_url=f'https://github.com/{host.REPO}/pull/{n}', state=state,
                draft=draft, files=[f'feature/{i["identifier"]}.py'])


class FakeServices:
    def __init__(self, issues):
        self.snapshot = dict(issues=issues, prs=[], baseSha='a'*40, scannedAt=time.time())
        self.calls=[]
        self.failure=None
        self.reads=0
        self.change=None

    def scan(self):
        self.reads+=1
        if self.change:
            self.change(self)
        return copy.deepcopy(self.snapshot)

    def approval_label(self, team):
        return 'pilot'

    def approve(self, i):
        self.calls.append(i['id'])
        if self.failure == 'before':
            raise host.PublicationError('fixture API unavailable')
        live=next(x for x in self.snapshot['issues'] if x['id']==i['id'])
        live['labels'][c.APPROVAL_LABEL]='pilot'
        if self.failure == 'after':
            raise host.PublicationError('fixture ambiguous response')


def lock_child(directory, output):
    with c.locked(Path(directory)):
        time.sleep(.05)
        with open(output, 'a') as stream:
            stream.write('enter\n');stream.flush()
        time.sleep(.05)
        with open(output, 'a') as stream:
            stream.write('exit\n')


class FileServices(FakeServices):
    def __init__(self, remote):
        self.remote=Path(remote)
    def scan(self):
        return json.loads(self.remote.read_text())
    def approve(self, i):
        data=self.scan()
        next(x for x in data['issues'] if x['id']==i['id'])['labels'][c.APPROVAL_LABEL]='pilot'
        data.setdefault('approvals',[]).append(i['id'])
        c.atomic(self.remote,data)


def coordinator_child(directory, remote, config):
    with c.locked(Path(directory)):
        c.cycle(FileServices(remote),config,Path(directory),True)


class CoordinatorTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory=Path(self.tmp.name)/'state'
        self.issues=[issue(n) for n in range(1,5)]
        self.services=FakeServices(self.issues)
        self.config=dict(version=1, projectId=c.PROJECT, cap=3, enableApprovals=True,
                         overlapReconciledBy='fixture-operator: SHE126/127 have no artifact; distinct host-only slice',
                         reviews={i['id']:review(i) for i in self.issues})

    def run_cycle(self, apply=True):
        if apply:
            with c.locked(self.directory):
                return c.cycle(self.services,self.config,self.directory,True)
        return c.cycle(self.services,self.config,self.directory)

    def test_controlled_three_issue_pilot_restart_and_replenish(self):
        first=self.run_cycle()
        self.assertEqual(first['selected'], ['SHE-1','SHE-2','SHE-3'])
        self.assertEqual(self.services.calls,['id-1','id-2','id-3'])
        self.assertEqual(self.run_cycle()['selected'],[])
        self.issues[0]['labels'].pop(c.APPROVAL_LABEL)
        self.issues[0]['state']='In Review'
        self.services.snapshot['prs']=[pr(10,self.issues[0])]
        self.assertEqual(self.run_cycle()['selected'],['SHE-4'])
        leases=c.load_state(self.directory)['leases']
        self.assertEqual(leases['id-1']['status'],'released')
        self.assertEqual(len(self.services.calls),4)
        self.assertEqual(self.run_cycle()['selected'],[])

    def test_dry_run_no_mutations_or_state_directory(self):
        self.assertEqual(self.run_cycle(False)['selected'],['SHE-1','SHE-2','SHE-3'])
        self.assertEqual(self.services.calls,[])
        self.assertFalse(self.directory.exists())

    def test_native_and_prose_blockers_require_verified_done(self):
        self.issues[0]['blockedBy']=[{'identifier':'SHE-2','state':{'name':'Todo'}}]
        self.issues[0]['description']='Depends on SHE-3 and HBL-ALIAS; reviewed alias maps to SHE-4.'
        self.config['reviews']['id-1']=review(self.issues[0])
        rows=self.run_cycle(False)['issues']; reasons=rows[0]['reasons']
        for ref in ['SHE-2','SHE-3','SHE-4']:
            self.assertTrue(any(ref in r for r in reasons))
        for i in self.issues[1:]:
            i['state']='Done'
        self.config['reviews']['id-1']['verifiedPrerequisites']={f'SHE-{n}':'operator verified merged implementation' for n in range(2,5)}
        self.assertTrue(self.run_cycle(False)['issues'][0]['eligible'])

    def test_review_and_done_never_selected(self):
        for i,status in zip(self.issues,['In Review','Done','In Progress','Rework']):i['state']=status
        self.assertEqual(self.run_cycle(False)['selected'],[])
        self.assertTrue(any('unknown active ownership' in r for r in self.run_cycle(False)['issues'][0]['reasons']) is False)

    def test_duplicate_titles_and_scope_batch_conflicts(self):
        self.issues[1]['title']=self.issues[0]['title']
        rows=self.run_cycle(False)['issues']
        self.assertTrue(any('duplicate title' in r for r in rows[0]['reasons']))
        self.issues[1]['title']='Different'
        for r in self.config['reviews'].values():r['files']=['same/dir']
        self.assertEqual(self.run_cycle(False)['selected'],['SHE-1'])

    def test_prefix_case_and_interface_conflicts(self):
        self.assertTrue(c.overlaps(['World/Foo'],['world/foo/bar.js']))
        self.assertFalse(c.overlaps(['foo'],['foobar']))
        self.config['reviews']['id-2']['interfaces']=['shared']
        self.config['reviews']['id-1']['interfaces']=['shared']
        self.assertNotIn('SHE-2',self.run_cycle(False)['selected'])

    def test_unknown_active_ownership_fails_closed(self):
        self.issues[3]['state']='In Progress'
        del self.config['reviews']['id-4']
        result=self.run_cycle(False)
        self.assertEqual(result['selected'],[])
        self.assertTrue(any('unknown active ownership' in r for r in result['issues'][0]['reasons']))

    def test_existing_merged_and_conflicting_prs(self):
        self.services.snapshot['prs']=[pr(1,self.issues[0],state='closed')]
        self.assertTrue(any('existing PR' in r for r in self.run_cycle(False)['issues'][0]['reasons']))
        other=pr(2,issue(999)); other['files']=['feature/SHE-2.py']
        self.services.snapshot['prs'].append(other)
        self.assertTrue(any('open conflicting PR' in r for r in self.run_cycle(False)['issues'][1]['reasons']))

    def test_missing_workpad_initializes_later_but_duplicates_hold(self):
        self.assertTrue(self.run_cycle(False)['issues'][0]['eligible'])
        self.issues[0]['comments']=[{'id':'a','body':'## Codex Workpad'}, {'id':'b','body':'## Codex Workpad'}]
        self.config['reviews']['id-1']=review(self.issues[0])
        self.assertIn('duplicate workpads',self.run_cycle(False)['issues'][0]['reasons'])

    def test_missing_stale_unsafe_expired_evidence_holds(self):
        for key,bad in [('issueDigest','wrong'),('baseSha','bad'),('branch','main'),('files',['../unsafe']),
                        ('tests',[]),('acceptance',[]),('dependencyAudit',''),('expiresAt',0),('interfaces',None)]:
            with self.subTest(key=key):
                good=self.config['reviews']['id-1'][key]
                self.config['reviews']['id-1'][key]=bad
                self.assertFalse(self.run_cycle(False)['issues'][0]['eligible'])
                self.config['reviews']['id-1'][key]=good
        self.issues[0]['comments'].append({'id':'new','body':'changed scope'})
        self.assertFalse(self.run_cycle(False)['issues'][0]['eligible'])

    def test_ambiguous_approval_restart_reconciles_without_duplicate(self):
        self.services.failure='after'
        with self.assertRaises(host.PublicationError):self.run_cycle()
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'pending')
        self.services.failure=None
        self.run_cycle()
        self.assertEqual(self.services.calls.count('id-1'),1)

    def test_failed_approval_retries_pending_same_claim(self):
        self.services.failure='before'
        with self.assertRaises(host.PublicationError):self.run_cycle()
        self.services.failure=None
        self.run_cycle()
        self.assertEqual(len(c.load_state(self.directory)['leases']),3)
        self.assertEqual(self.services.calls.count('id-1'),2)

    def test_scan_failure_no_label_and_state_corruption_no_reset(self):
        with patch.object(self.services,'scan',side_effect=host.PublicationError('API failure')):
            with self.assertRaises(host.PublicationError):self.run_cycle()
        self.assertEqual(self.services.calls,[])
        c.atomic(self.directory/'leases.json',{'version':0,'leases':{}})
        with self.assertRaises(host.PublicationError):self.run_cycle()
        self.assertEqual(json.loads((self.directory/'leases.json').read_text())['version'],0)

    def test_running_label_removal_retains_until_explicit_release(self):
        self.run_cycle()
        self.issues[0]['labels'].pop(c.APPROVAL_LABEL)
        self.assertEqual(self.run_cycle()['selected'],[])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'held')
        self.config['releases']={'id-1':'Operator confirms stopped and explicitly releases approval'}
        self.assertEqual(self.run_cycle()['selected'],['SHE-4'])
        self.assertNotIn(c.APPROVAL_LABEL,self.issues[0]['labels'])

    def test_changes_between_scan_and_add_fail_closed(self):
        def change(service):
            if service.reads==2:service.snapshot['baseSha']='b'*40
        self.services.change=change
        with self.assertRaisesRegex(host.PublicationError,'changed'):self.run_cycle()
        self.assertEqual(self.services.calls,[])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'pending')

    def test_apply_disabled_without_reconciliation(self):
        self.config.pop('overlapReconciledBy')
        with self.assertRaisesRegex(host.PublicationError,'disabled'):self.run_cycle()
        self.assertEqual(self.services.calls,[])

    def test_cap_beyond_three_requires_actual_draft_proof(self):
        self.config['cap']=4
        with self.assertRaisesRegex(host.PublicationError,'scale'):self.run_cycle(False)

    def test_paginated_inventory_cycles_fail_closed(self):
        calls=[]
        def fetch(cursor):
            calls.append(cursor)
            return {'nodes':[cursor], 'pageInfo':{'hasNextPage':cursor is None,'endCursor':'next'}}
        self.assertEqual(c.paginate(fetch),[None,'next'])
        with self.assertRaises(host.PublicationError):c.paginate(lambda _: {'nodes':[], 'pageInfo':{'hasNextPage':True,'endCursor':'same'}})

    def test_private_state_atomic_before_mutation(self):
        original=self.services.approve
        def approve(i):
            state=c.load_state(self.directory)
            self.assertEqual(state['leases'][i['id']]['status'],'pending')
            self.assertEqual((self.directory/'leases.json').stat().st_mode&0o777,0o600)
            original(i)
        self.services.approve=approve
        self.run_cycle()

    def test_two_coordinator_processes_never_duplicate_or_exceed_three(self):
        remote=Path(self.tmp.name)/'remote.json'
        c.atomic(remote,self.services.snapshot)
        processes=[multiprocessing.Process(target=coordinator_child,args=(str(self.directory),str(remote),self.config)) for _ in range(2)]
        for process in processes:process.start()
        for process in processes:
            process.join(10)
            self.assertEqual(process.exitcode,0)
        self.assertEqual(json.loads(remote.read_text())['approvals'],['id-1','id-2','id-3'])
        self.assertEqual(len(c.load_state(self.directory)['leases']),3)

    def test_mention_only_or_wrong_repo_draft_never_releases_lease(self):
        self.run_cycle()
        self.issues[0]['labels'].pop(c.APPROVAL_LABEL)
        candidate=pr(100,self.issues[0])
        candidate['head']['ref']='unrelated'
        self.services.snapshot['prs']=[candidate]
        self.assertEqual(self.run_cycle()['selected'],[])
        candidate['head']['ref']='symphony/SHE-1'
        candidate['head']['repo']['full_name']='other/repository'
        self.assertEqual(self.run_cycle()['selected'],[])

    def test_interrupted_lease_write_never_calls_approve(self):
        with patch.object(c,'atomic',side_effect=OSError('interrupted disk write')):
            with self.assertRaises(OSError):self.run_cycle()
        self.assertEqual(self.services.calls,[])

    def test_full_live_adapter_paginates_issues_and_every_connection(self):
        template=issue(1)
        connections={'comments':[{'id':'pad','body':'## Codex Workpad'}],
                     'labels':[{'id':'review','name':c.REVIEW_LABEL}],
                     'inverseRelations':[{'type':'blocks','issue':{'identifier':'SHE-2','state':{'name':'Todo'}}}],
                     'relations':[],
                     'attachments':[{'id':'link','url':'https://example.invalid','title':'evidence'}]}
        def api(query, variables):
            if 'issues(first:' in query:
                self.assertEqual(query.count('includeArchived:true'),1)
                node={k:template[k] for k in ['id','identifier','title','description','priority','team']}
                node['state']={'name':'Todo'}
                for field in connections:
                    node[field]={'nodes':[], 'pageInfo':{'hasNextPage':True,'endCursor':'second'}}
                return {'issues':{'nodes':[node] if variables['after'] is None else [],
                    'pageInfo':{'hasNextPage':variables['after'] is None,'endCursor':'second'}}}
            field=next(k for k in connections if k+'(first:' in query)
            return {'issue':{field:{'nodes':[] if variables['after'] is None else connections[field],
                'pageInfo':{'hasNextPage':variables['after'] is None,'endCursor':'second'}}}}
        services=c.Services()
        with patch.object(host,'linear',side_effect=api) as linear, patch.object(services,'github_pages',return_value=[]), patch.object(services,'github',return_value={'object':{'sha':'a'*40}}):
            snapshot=services.scan()
        self.assertEqual(linear.call_count,7)
        self.assertEqual(snapshot['issues'][0]['comments'],connections['comments'])
        self.assertEqual(snapshot['issues'][0]['blockedBy'][0]['identifier'],'SHE-2')
        self.assertEqual(snapshot['issues'][0]['attachments'],connections['attachments'])

    def test_github_read_retries_sanitizes_and_paginates_all_files(self):
        services=c.Services()
        failed=type('Result',(),{'returncode':1,'stdout':'secret','stderr':'secret'})()
        good=type('Result',(),{'returncode':0,'stdout':'[[{"filename":"a"}],[{"filename":"b"}]]'})()
        with patch.object(c.subprocess,'run',side_effect=[failed,good]) as run, patch.object(c.time,'sleep'):
            self.assertEqual(services.github_pages('endpoint'),[{'filename':'a'},{'filename':'b'}])
            self.assertIn('--paginate',run.call_args.args[0])
        with patch.object(c.subprocess,'run',return_value=failed), patch.object(c.time,'sleep'):
            with self.assertRaises(host.PublicationError) as error:services.github('endpoint')
            self.assertNotIn('secret',str(error.exception))

    def test_pending_scope_cannot_be_reinterpreted_on_restart(self):
        self.services.failure='before'
        with self.assertRaises(host.PublicationError):self.run_cycle()
        self.services.failure=None
        self.config['reviews']['id-1']['files']=['changed/scope.py']
        self.assertNotIn('SHE-1',self.run_cycle()['selected'])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['files'],['feature/SHE-1.py'])

    def test_cli_dry_run_outputs_complete_report_without_claims(self):
        import contextlib
        import io
        self.directory.mkdir()
        evidence=self.directory/'readiness.json'
        c.atomic(evidence,self.config)
        report=Path(self.tmp.name)/'report.md'
        snapshot=Path(self.tmp.name)/'report.json'
        with patch.object(c,'STATE',self.directory), patch.object(c,'Services',return_value=self.services), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(c.main(['--dry-run','--evidence',str(evidence),'--report',str(report),'--json-report',str(snapshot)]),0)
        self.assertIn('DRY RUN',report.read_text())
        self.assertEqual(len(json.loads(snapshot.read_text())['issues']),4)
        self.assertEqual(snapshot.stat().st_mode & 0o777,0o600)
        self.assertFalse((self.directory/'leases.json').exists())
        self.assertEqual(self.services.calls,[])

    def test_archived_todo_is_held(self):
        self.issues[0]['archivedAt']='2026-01-01'
        self.assertNotIn('SHE-1',self.run_cycle(False)['selected'])

    def test_broken_symlink_state_and_case_insensitive_git_scope_fail_closed(self):
        self.directory.mkdir()
        (self.directory/'leases.json').symlink_to(self.directory/'missing')
        with self.assertRaises(host.PublicationError):self.run_cycle()
        self.assertEqual(self.services.calls,[])
        self.assertFalse(c.safe_paths(['.GIT/config']))
        self.assertFalse(c.safe_paths(['safe/.Git/index']))

    def test_publisher_handoff_frees_capacity_while_issue_stays_in_progress(self):
        self.run_cycle()
        self.issues[0]['labels'].pop(c.APPROVAL_LABEL)
        self.issues[0]['state']='In Progress'
        self.issues[0]['comments']=[{'id':'pad','body':'## Codex Workpad\nPublished draft; actual validation'}]
        self.services.snapshot['prs']=[pr(100,self.issues[0])]
        self.assertEqual(self.run_cycle()['selected'],['SHE-4'])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'released')

    def test_terminal_state_without_handoff_does_not_silently_release(self):
        self.run_cycle()
        self.issues[0]['labels'].pop(c.APPROVAL_LABEL)
        self.issues[0]['state']='Done'
        self.assertEqual(self.run_cycle()['selected'],[])
        self.assertEqual(c.load_state(self.directory)['leases']['id-1']['status'],'held')

    def test_two_real_processes_serialize_host_lock(self):
        output=Path(self.tmp.name)/'output'
        processes=[multiprocessing.Process(target=lock_child,args=(str(self.directory),str(output))) for _ in range(2)]
        for p in processes:p.start()
        for p in processes:p.join(5);self.assertEqual(p.exitcode,0)
        self.assertEqual(output.read_text().splitlines(),['enter','exit','enter','exit'])


if __name__=='__main__':unittest.main()
