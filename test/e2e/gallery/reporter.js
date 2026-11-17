import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {sha256,sourceIdentity} from './source.js';
import {evidenceStatus,buildReport,renderGallery} from './report.js';
import {redact} from '../../helpers/browser-evidence.js';

export default class GalleryReporter{
  constructor(options={}){this.root=resolve(options.outputDir??'test-results/regression-gallery');}
  tests=[];
  errors=[];
  onError(error){this.errors.push(redact(error.message??'Unknown runner error'));}
  onBegin(){this.source=sourceIdentity();}
  onTestEnd(test,result){
    const root=this.root;
    const bytes=name=>{
      const a=result.attachments.find(a=>a.name===name);
      return a?.body??(a?.path?readFileSync(a.path):null);
    };
    const raw=bytes('gallery-observation');
    const observation=raw?JSON.parse(raw.toString()):null;
    const png=bytes('gallery-screen');
    const id=sha256(test.id+':'+result.retry).slice(0,24);
    mkdirSync(join(root,'screens'),{recursive:true});
    let screenshot=null;
    if(png){const url=`screens/${id}.png`;writeFileSync(join(root,url),png);screenshot={url,sha256:sha256(png)};}
    const artifacts=[];
    for(const [index,a] of result.attachments.entries()){
      if(a.contentType!=='application/json'||a.name.startsWith('gallery-')||a.name==='browser-errors')continue;
      const data=a.body??(a.path?readFileSync(a.path):null);
      if(!data)continue;
      const url=`screens/${id}-${index}.json`;
      writeFileSync(join(root,url),data);artifacts.push({name:a.name,url,sha256:sha256(data)});
    }
    this.tests.push({id,file:relative(process.cwd(),test.location.file).replaceAll('\\','/'),
      title:test.titlePath().join(' › '),actualStatus:result.status,expectedStatus:test.expectedStatus,
      retry:result.retry,durationMs:result.duration,observation,screenshot,artifacts,
      errors:result.errors.map(error=>redact(error.message??'Unknown test error')),
      browserErrors:bytes('browser-errors')?JSON.parse(bytes('browser-errors').toString()):null,
      status:evidenceStatus({status:result.status,expectedStatus:test.expectedStatus,observation,screenshot,currentSource:this.source})});
  }
  onEnd(result){
    const current=sourceIdentity();
    for(const t of this.tests)t.status=evidenceStatus({status:t.actualStatus,
      expectedStatus:t.expectedStatus,observation:t.observation,screenshot:t.screenshot,currentSource:current});
    const report=buildReport(this.tests,current,result.status);
    report.errors=this.errors;
    const complete=!report.missingPaths.length&&!this.errors.length&&this.tests.every(t=>t.status==='checks-passed');
    report.coverageStatus=complete?'complete':'incomplete';
    const root=this.root;mkdirSync(root,{recursive:true});
    writeFileSync(join(root,'receipts.json'),JSON.stringify(report,null,2)+'\n');
    writeFileSync(join(root,'index.html'),renderGallery(report));
    // A skipped GPU backend or launch failure must not turn a gallery green.
    return {status:result.status==='passed'&&!complete?'failed':result.status};
  }
}
