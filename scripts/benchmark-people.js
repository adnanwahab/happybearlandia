// node scripts/benchmark-people.js <isolated-base-url> [10000,50000,100000] [days] [output.json]
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const [base,populations='10000,50000,100000',dayText='1',output='/private/tmp/hbl-people-benchmark.json']=process.argv.slice(2);
if(!base||!/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Supply an explicitly isolated local server URL.');
const counts=populations.split(',').map(Number),days=Number(dayText);
if(counts.length>4||counts.some(n=>!Number.isInteger(n)||n<1||n>250000)||!Number.isInteger(days)||days<1||days>31)throw new Error('Invalid bounded benchmark settings. Model schema also validates each population.');
const browser=await chromium.launch({headless:true}),reports=[];
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/world/bench/people`);await page.waitForFunction(()=>Boolean(window.hblPeopleBenchmark),null,{timeout:30000});
 for(const population of counts){const report=await page.evaluate(({population,days})=>window.hblPeopleBenchmark.run({population,days,seed:42}),{population,days});reports.push(report);console.log(JSON.stringify({population,days,wallMs:report.wallMs,simulationMs:report.simulationMs,simulatedDaysPerSecond:report.simulatedDaysPerSecond,frameProbe:report.frameProbe,typedStateBytes:report.typedStateBytes}));}
 await writeFile(output,JSON.stringify({version:'hbl.people-benchmark-suite.v1',errors,reports},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
