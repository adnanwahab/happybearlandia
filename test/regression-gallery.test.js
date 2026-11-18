import {test,expect} from 'bun:test';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import GalleryReporter from './e2e/gallery/reporter.js';
import {sha256} from './e2e/gallery/source.js';
import {inventory,paths} from './e2e/gallery/inventory.js';
import {buildReport,evidenceStatus,renderGallery} from './e2e/gallery/report.js';

test('inventory covers exactly 101–200 without fabricated routes or receipts',()=>{
  expect(inventory.map(r=>r.id)).toEqual(Array.from({length:100},(_,i)=>`HBL-FUN-${i+101}`));
  expect(inventory.every(r=>r.evidence==='missing'&&r.screenshot===null&&r.receipt===null)).toBe(true);
  expect(paths).toHaveLength(20);expect(new Set(paths.map(p=>p.file)).size).toBe(20);
  expect(inventory.every(r=>r.issue&&r.source&&r.title.startsWith('['+r.id+']'))).toBe(true);
  expect(paths.reduce((n,p)=>n+p.expectedTests,0)).toBe(44);
  const wrapper=readFileSync('test/e2e/regression-gallery.gallery.js','utf8');
  for(const p of paths){expect(existsSync(p.file)).toBe(true);expect(wrapper).toContain(`import './${p.file.split('/').at(-1)}'`);}
  expect(inventory.filter(r=>!r.automation.length).every(r=>r.route===null)).toBe(true);
});
test('reporter saves actual attachment bytes and fails an otherwise passed incomplete run',()=>{
  const outputDir=mkdtempSync(join(tmpdir(),'she786-reporter-'));
  try{
    const reporter=new GalleryReporter({outputDir});reporter.onBegin();
    // Explicit unit fixture, not an application screenshot or acceptance result.
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=','base64');
    reporter.onTestEnd({id:'reporter-unit-fixture',location:{file:resolve(paths[0].file)},
      titlePath:()=>['Reporter unit fixture'],expectedStatus:'passed'},
    {status:'passed',retry:0,duration:1,errors:[],attachments:[
      {name:'gallery-screen',body:png,contentType:'image/png'},
      {name:'gallery-observation',body:Buffer.from(JSON.stringify({source:reporter.source})),contentType:'application/json'},
      {name:'specific-receipt',body:Buffer.from('{"unitFixture":true}'),contentType:'application/json'},
    ]});
    expect(reporter.onEnd({status:'passed'})).toEqual({status:'failed'});
    const report=JSON.parse(readFileSync(join(outputDir,'receipts.json'),'utf8'));
    expect(report.coverageStatus).toBe('incomplete');
    expect(report.missingPaths).toHaveLength(20);
    expect(report.tests[0].screenshot.sha256).toBe(sha256(png));
    expect(readFileSync(join(outputDir,report.tests[0].screenshot.url))).toEqual(png);
    expect(report.tests[0].artifacts[0].name).toBe('specific-receipt');
    expect(readFileSync(join(outputDir,report.tests[0].artifacts[0].url),'utf8')).toBe('{"unitFixture":true}');
    expect(readFileSync(join(outputDir,'index.html'),'utf8')).toContain('Reporter unit fixture');
  }finally{rmSync(outputDir,{recursive:true,force:true});}
});
test('pass requires real screenshot and matching checkout; skips, expected failures and stale evidence fail closed',()=>{
  const currentSource={revision:'abc',fingerprint:'123'};
  const good={status:'passed',expectedStatus:'passed',currentSource,
    observation:{source:currentSource},screenshot:{url:'actual.png',sha256:'hash'}};
  expect(evidenceStatus(good)).toBe('checks-passed');
  for(const status of ['failed','timedOut','interrupted'])expect(evidenceStatus({...good,status})).toBe('failed');
  expect(evidenceStatus({...good,status:'skipped'})).toBe('skipped');
  expect(evidenceStatus({...good,expectedStatus:'failed'})).toBe('failed');
  expect(evidenceStatus({...good,screenshot:null})).toBe('missing-evidence');
  expect(evidenceStatus({...good,observation:null})).toBe('missing-evidence');
  expect(evidenceStatus({...good,currentSource:{...currentSource,fingerprint:'changed'}})).toBe('stale-evidence');
  expect(evidenceStatus({...good,currentSource:{...currentSource,revision:'other'}})).toBe('stale-evidence');
});
test('empty or partial run never hides missing paths or promotes feature acceptance',()=>{
  const report=buildReport([],{revision:'abc',fingerprint:'123'},'failed');
  expect(report.missingPaths).toHaveLength(20);expect(report.featureAcceptance).toBe('unverified');
  expect(renderGallery(report)).toContain('Missing receipt / screenshot');
  const t={id:'one',file:paths[0].file,title:'<script>alert(1)</script>',status:'checks-passed',retry:0,actualStatus:'passed'};
  const partial=buildReport([t],report.source,'passed');
  expect(partial.missingPaths).toHaveLength(20);
  expect(partial.inventory.every(r=>r.evidence==='missing')).toBe(true);
  expect(renderGallery(partial)).toContain('&lt;script&gt;');
  expect(renderGallery(partial)).not.toContain('<script>');
});
