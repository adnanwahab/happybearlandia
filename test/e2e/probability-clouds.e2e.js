import {test,expect} from '@playwright/test';
test('probability clouds replay to identical canvas hashes and exact SVG opacity',async({page})=>{
 await page.goto('/reality-compiler');
 const result=await page.evaluate(async()=>{
  const {drawEnsembleCanvas,drawEnsembleSvg,mountEnsembleView,ensembleDisplayReport}=await import('/world/reality/ensemble-view.js');
  const {createCity}=await import('/world/city/seed.js');
  const {compileRealityProposal}=await import('/world/reality/compiler.js');
  const {executeRealityExperiment,normalizeRealityRequest}=await import('/world/reality/runtime-core.js');
  const {ensembleRealityFutures}=await import('/world/reality/ensemble-core.js');
  const request=normalizeRealityRequest({program:compileRealityProposal('Build housing'),initial:createCity({households:1}),runs:7,months:1,seed:42,parameterUncertainty:[]});
  const render=async()=>{
   const ensemble=await ensembleRealityFutures(await executeRealityExperiment(request),{month:1});
   const worldContext={buildings:ensemble.records.map((r,i)=>({id:r.buildingIds[0],poly:[[i*10,0],[i*10+6,0],[i*10+6,6],[i*10,6]]}))};
   const report=ensembleDisplayReport(ensemble,{worldContext});
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
   drawEnsembleCanvas(canvas.getContext('2d'),report,{enabled:true});
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',canvas.getContext('2d').getImageData(0,0,512,64).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
   return {hash,ensemble,worldContext,report};
  };
  const a=await render(),b=await render();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(svg);
  const records=[0,1,3,7].map(present=>({present,frequency:present/7,center:[present*10,0]}));
  drawEnsembleSvg(svg,{completedFutures:7,records},{enabled:true});
  const host=document.createElement('div');document.body.append(host);const panel=mountEnsembleView(host);panel.update(a.ensemble,{worldContext:a.worldContext});host.querySelector('details').open=true;await new Promise(r=>setTimeout(r,30));
  return {hashes:[a.hash,b.hash],opacities:[...svg.querySelectorAll('path')].map(p=>Number(p.getAttribute('stroke-opacity'))),legend:host.textContent,seeds:a.report.runs.map(r=>r.seed)};
 });
 expect(result.hashes[0]).toBe(result.hashes[1]);expect(result.opacities).toEqual([1/7,3/7,1]);
 expect(result.legend).toContain('7 actual completed futures');expect(result.legend).toContain('opacity = present / selected futures');
 for(const seed of result.seeds)expect(result.legend).toContain(String(seed));
});
