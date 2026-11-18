// Actual-server smoke harness: HBL_METHODOLOGY_URL overrides isolated server origin.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const origin=process.env.HBL_METHODOLOGY_URL || 'http://127.0.0.1:41984';
const output=process.env.HBL_METHODOLOGY_ARTIFACTS || '/tmp/backlog-methodology-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [390,320]){
 const page=await browser.newPage({viewport:{width,height:800},acceptDownloads:true});
 await page.goto(origin+'/world/decision/backlog-methodology/index.html');
 await page.getByRole('button',{name:'Run diagnostic',exact:true}).click();
 await page.getByText('Retrospective diagnostic complete.',{exact:false}).waitFor();
 const actual=JSON.parse(await page.locator('#report pre').textContent());
 const expected=await page.evaluate(async()=>{const {runPublishedHousingDiagnostic}=await import('/world/decision/backtest.js');const {methodologyReport}=await import('/world/decision/backlog-methodology/report.js');return methodologyReport(await runPublishedHousingDiagnostic({runs:20,seed:42}));});
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Underlying diagnostic/report mismatch');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download report JSON'}).click();const dl=await pending;await dl.saveAs(`${output}/report-${width}.json`);
 const downloaded=JSON.parse(await Bun.file(`${output}/report-${width}.json`).text());if(JSON.stringify(downloaded)!==JSON.stringify(actual))throw Error('Download mismatch');
 if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow');
 await page.locator('#evaluation').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/report-${width}.png`});
 await page.getByRole('link',{name:'Known limitations',exact:true}).click();await page.screenshot({path:`${output}/limitations-${width}.png`});
 await page.close();
 }
 const page=await browser.newPage({viewport:{width:320,height:800}});
 await page.route('**/houston-history.js',route=>route.abort());
 await page.goto(origin+'/world/decision/backlog-methodology/index.html');await page.getByRole('button',{name:'Run diagnostic',exact:true}).click();await page.getByText('Diagnostic unavailable.',{exact:false}).waitFor();
 if(!await page.getByRole('button',{name:'Download report JSON'}).isDisabled())throw Error('Failure enabled download');
 await page.screenshot({path:`${output}/error-320.png`});
 console.log('PASS: 390/320 real diagnostic, JSON equality, download equality, overflow, navigation; failed import disables download. Artifacts: '+output);
}finally{await browser.close();}
