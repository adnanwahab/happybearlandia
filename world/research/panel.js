import { getInstitution, contentHash, createExperimentRecord } from './institutions.js';
import { contextFromURL, contextURL, shellURL } from '../universe/navigation.js';
const script=document.querySelector('script[data-research-app]');
const appId=script?.dataset.researchApp, facility=getInstitution(appId);
if(facility) { try { install(); } catch { const error=document.createElement('p');error.role='alert';error.textContent='Invalid research context link. Open Research facilities from the Universe shell to start a valid context.';document.body.prepend(error); } }
function install() {
 const context=contextFromURL(location.href);
 const panel=document.createElement('details');panel.id='research-context';
 panel.style.cssText='position:relative;z-index:20;background:#142738;color:#edf7fa;padding:14px 20px;font:14px/1.5 system-ui;border:1px solid #749ca6;max-width:1100px;margin:12px auto';
 const summary=document.createElement('summary');summary.textContent=facility.name+' · World context & experiment record';panel.append(summary);
 const description=document.createElement('p');description.textContent=facility.interactions+' '+facility.limitations;panel.append(description);
 const refs=document.createElement('p');refs.textContent=facility.reference+' City effects disabled.';panel.append(refs);
 for(const [title,url] of [['Return to World',shellURL('world',context)],['Research facilities',contextURL('/world/research/index.html',context)]]) {const a=document.createElement('a');a.textContent=title;a.href=url;a.style.cssText='color:#8df0da;margin-right:20px';panel.append(a);}
 const button=document.createElement('button');button.type='button';button.textContent='Export current display snapshot';button.style.margin='12px';panel.append(button);
 const status=document.createElement('p');status.role='status';status.textContent='Snapshot records current controls and visible text, not an independently validated run. Outputs may reflect an earlier configuration; run the lab after changing controls.';panel.append(status);
 document.body.prepend(panel);
 button.onclick=async()=>{button.disabled=true;try {
 const inputs={};for(const [i,el] of [...document.querySelectorAll('input,select,textarea')].entries()){if(panel.contains(el)||el.type==='password'||el.type==='file')continue;inputs[el.id||el.name||String(i)]=el.type==='checkbox'?el.checked:el.value;}
 const outputs={};for(const selector of ['#status','#engine','#metrics','#m0','#m1','#m2','#m3','#assessment','#legend','#lab-heading']){const el=document.querySelector(selector);if(el)outputs[selector]=el.textContent.trim();}
 const backendText=[outputs['#status'],outputs['#engine']].join(' ');
 // Do not infer execution from a ready/fallback banner. Unreported is intentional.
 const backend=/CPU.*(?:complete|evaluations)|complete.*CPU/i.test(backendText)?'CPU':/(?:GPU computation \+ readback complete|complete.*WebGPU)/i.test(backendText)?'WebGPU':'unreported';
 const sources={};for(const node of document.querySelectorAll('script')){if(node===script)continue;if(node.src){const u=new URL(node.src);if(u.origin!==location.origin)continue;const response=await fetch(u);if(!response.ok)throw Error('Model source unavailable');sources[u.pathname]=await response.text();}else if(node.textContent.trim())sources['inline:'+Object.keys(sources).length]=node.textContent;}
 // Hash the directly imported dependencies as well as entry scripts.
 for(const [path,source] of Object.entries({...sources})){for(const match of source.matchAll(/from\s*['"](\.[^'"]+)['"]/g)){const u=new URL(match[1],new URL(path,location.origin));const response=await fetch(u);if(!response.ok)throw Error('Model dependency unavailable');sources[u.pathname]=await response.text();}}
 const rawSeed=inputs.seed;const seed=rawSeed===undefined||rawSeed===''?null:Number(rawSeed);
 const record=await createExperimentRecord({appId,context,inputs,outputs,seed,backend,modelHash:await contentHash(sources)});
 const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=appId+'-display-snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Exported display snapshot with SHA-256 source/input hashes. This record authorizes no city effect.';
 }catch(error){status.textContent='Snapshot unavailable: '+error.message;}finally{button.disabled=false;}};
}
