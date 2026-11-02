// bun scripts/benchmark-renderer.js [base URL] [scene] [output.json] [baseline.json]
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { BENCHMARK_SCENES } from '../world/render/bench/scenes.js';
const [base='http://localhost:3000',scene='aerial-city',output='/tmp/city-render-benchmark.json',baselinePath]=process.argv.slice(2);
if(!BENCHMARK_SCENES.includes(scene))throw new Error(`Scene must be one of ${BENCHMARK_SCENES.join(', ')}`);
const browser=await chromium.launch({headless:process.env.HEADED!=='1'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/world/bench/${scene}?renderer=${process.env.RENDERER||'webgpu'}&people=500`);
 await page.waitForFunction(()=>!!window.hblCityRenderer,null,{timeout:120000});
 await page.evaluate(({off,quality,geometry})=>{const api=window.hblCityRenderer;api.setAdaptiveQuality(false);api.setQuality(quality);if(geometry)api.setGeometryDetail(geometry);for(const feature of off)api.setFeature(feature,false);},{off:(process.env.OFF_FEATURES||'').split(',').filter(Boolean),quality:process.env.QUALITY||'BALANCED',geometry:process.env.GEOMETRY});
 await page.waitForFunction(()=>window.hblCityRenderer.getPerformanceStats().frames>30,null,{timeout:120000});
 await page.evaluate(()=>window.hblCityRenderer.startBenchmark({scripted:true}));
 await page.waitForFunction(()=>!!window.hblCityRenderer.getPerformanceStats().lastBenchmark,null,{timeout:90000});
 const report=await page.evaluate(()=>window.hblCityRenderer.getPerformanceStats().lastBenchmark);
 report.errors=errors;await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(errors.length)process.exitCode=1;
 if(baselinePath){
  const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
  if(report.backend!==baseline.backend||JSON.stringify(report.viewport)!==JSON.stringify(baseline.viewport)||report.preset!==baseline.preset||JSON.stringify(report.settings)!==JSON.stringify(baseline.settings))throw new Error('Baseline backend, viewport and preset must match');
  const key=baseline.gpuP95Ms!=null&&report.gpuP95Ms!=null?'gpuP95Ms':'p95FrameMs';
  const ratio=report[key]/baseline[key];console.log(`${key}: ${((ratio-1)*100).toFixed(1)}% vs baseline`);
  if(ratio>1.15)process.exitCode=1;
 }
}finally{await browser.close();}
