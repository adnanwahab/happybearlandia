import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {mountCityTour} from '../world/city-tour/panel.js';
const domPath=process.env.HBL_TOUR_DOM;
const domTest=domPath?test:test.skip;
domTest('DOM entry: author, reorder, opt-in export, read-only guest, skip invalid, reverse and delete',async()=>{
 const {Window}=await import(domPath),window=new Window({url:'https://local/world'}),doc=window.document;
 const save={schemaVersion:'world-experiment-save.v1',checkpoint:{schemaVersion:'legacy-checkpoint.v1',modelVersion:'neighborhood-activity.v2'},geometry:{area:{source:'synthetic'}},view:{camera:{position:[1,40,3],target:[0,0,0]}}},record={schemaVersion:'world-experiment-record.v1',id:'TourSave001',save,checksum:'sha256:'+createHash('sha256').update(JSON.stringify(save)).digest('hex')};
 let denied=false;const urls=[],panel=mountCityTour({container:doc.body,fetchImpl:async()=>denied?new Response('',{status:403}):Response.json(record),navigate:u=>urls.push(u)});
 const button=name=>[...doc.querySelectorAll('button')].find(b=>b.textContent===name),status=()=>doc.querySelector('[role=status]').textContent;
 const settle=async()=>{for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,2));if(!button('Open as read-only guest').disabled)return;}throw Error('UI did not settle');};
 const inputs=doc.querySelectorAll('input');inputs[1].value='TourSave001';
 for(const text of ['A','B','<script>globalThis.injected=true</script>']){doc.querySelector('textarea').value=text;button('Add saved checkpoint').click();await settle();}
 expect(doc.querySelectorAll('li').length).toBe(3);expect(button('Export read-only recipe').disabled).toBe(true);
 doc.querySelector('[aria-label="Move up step 2"]').click();expect(doc.querySelector('li').textContent).toStartWith('1. B');expect(globalThis.injected).toBeUndefined();
 inputs[2].checked=true;inputs[2].dispatchEvent(new window.Event('change'));button('Export read-only recipe').click();await settle();expect(status()).toContain('No publication');
 button('Open as read-only guest').click();await settle();expect(button('Add saved checkpoint').hidden).toBe(true);
 button('Play').click();await settle();expect(urls.length).toBe(1);
 denied=true;button('Skip / next').click();await settle();expect(status()).toContain('Invalid step 2: Access denied');button('Skip / next').click();await settle();expect(status()).toContain('Invalid step 3');
 button('Reverse route').click();expect(doc.querySelector('li').textContent).toContain('<script>');expect(doc.querySelector('li').textContent).toContain('synthetic');
 button('Delete local tour').click();expect(doc.querySelectorAll('li').length).toBe(0);expect(doc.querySelectorAll('textarea')[1].value).toBe('');panel.dispose();expect(doc.querySelector('details')).toBeNull();window.happyDOM.abort();
});
domTest('carried guest checks loaded identity and restore outcome, marks unavailable stop',async()=>{
 const {Window}=await import(domPath),{anchorRecord,tourURL,TOUR_VERSION}=await import('../world/city-tour/core.js');
 const save={schemaVersion:'world-experiment-save.v1',checkpoint:{schemaVersion:'legacy-checkpoint.v1',modelVersion:'neighborhood-activity.v2'},geometry:{area:{source:'synthetic'}},view:{camera:{position:[1,40,3],target:[0,0,0]}}},record={schemaVersion:'world-experiment-record.v1',id:'TourSave001',save,checksum:'sha256:'+createHash('sha256').update(JSON.stringify(save)).digest('hex')},step=await anchorRecord(record,'Narrative'),recipe={version:TOUR_VERSION,title:'Tour',steps:[step,step,step]};
 for(const mode of ['ok','missing','restore-failed']){
  const window=new Window({url:'https://local'+tourURL(recipe,1)}),doc=window.document;let pauses=0;
  const panel=mountCityTour({container:doc.body,loadedRecord:record,restored:mode!=='restore-failed',pause:()=>pauses++,fetchImpl:async()=>mode==='missing'?new Response('',{status:404}):Response.json(record)});
  for(let i=0;i<40&&doc.querySelector('[role=status]').textContent==='Validating pinned stop…';i++)await new Promise(r=>setTimeout(r,2));
  const status=doc.querySelector('[role=status]').textContent;
  if(mode==='ok')expect(status).toContain('Stop 2/3: saved checkpoint restored');
  if(mode==='missing'){expect(status).toContain('missing');expect(doc.querySelector('[data-invalid=true]').textContent).toContain('Checkpoint missing');}
  if(mode==='restore-failed')expect(status).toContain('not restored');
  expect(pauses).toBe(1);expect(doc.querySelector('details').open).toBe(true);expect([...doc.querySelectorAll('button')].find(b=>b.textContent==='Skip / next').disabled).toBe(false);panel.dispose();window.happyDOM.abort();
 }
});
