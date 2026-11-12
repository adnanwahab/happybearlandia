import {test,expect} from '@playwright/test';
const route='/world/future-machine.html';
const secret='Bearer private-token alice@example.com 192.168.1.1 typed proposal';
const region=page=>page.getByRole('region',{name:'Optional error report'});
async function clipboard(page,deny=false){
 await page.addInitScript(deny=>{window.copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(deny)throw Error('Denied');window.copies.push(text);}}});},deny);
}
test('homepage mock failure requires consent, copies scrubbed bundle and clears on retry',async({page},info)=>{
 await clipboard(page);
 await page.route('**/api/city-experiments**',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:secret})}));
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 const panel=region(page);await expect(panel).toBeVisible();
 const preview=panel.getByRole('textbox');const report=JSON.parse(await preview.inputValue());
 expect(report.errorType).toBe('comparison-failure');expect(Object.keys(report)).toEqual(['schemaVersion','appVersion','renderer','errorType','traceId']);
 expect(JSON.stringify(report)).not.toContain(secret);expect(report.traceId).toMatch(/^hbl-[0-9a-f]{32}$/);
 await info.attach('scrubbed-mock-failure.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 const copy=panel.getByRole('button',{name:'Copy diagnostic report'});await expect(copy).toBeDisabled();expect(await page.evaluate(()=>window.copies)).toEqual([]);
 await panel.getByRole('checkbox').check();await copy.click();await expect(panel.getByRole('status')).toContainText('copied');expect(await page.evaluate(()=>window.copies)).toEqual([await preview.inputValue()]);
 // A pending retry must clear the prior report and its consent immediately.
 await page.route('**/api/city-experiments**',r=>r.abort());
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect(panel).toBeVisible();await expect(panel.getByRole('checkbox')).not.toBeChecked();await expect(copy).toBeDisabled();
 expect(JSON.parse(await preview.inputValue()).traceId).not.toBe(report.traceId);
});
test('boot import failure has a report and manual clipboard fallback',async({page})=>{
 await clipboard(page,true);await page.route('**/world/future-machine/main.js',r=>r.abort());await page.goto(route);
 const panel=region(page);await expect(panel).toBeVisible();expect(JSON.parse(await panel.getByRole('textbox').inputValue())).toMatchObject({errorType:'boot-failure',renderer:'unknown'});
 await panel.getByRole('checkbox').check();await panel.getByRole('button').click();await expect(panel.getByRole('status')).toContainText('manually');
 expect(await panel.getByRole('textbox').evaluate(n=>n.selectionEnd-n.selectionStart)).toBeGreaterThan(0);
});
test('invalid share reports a fixed category without copying URL inputs',async({page})=>{
 await clipboard(page);await page.goto(route+'?fm='+encodeURIComponent(secret));const panel=region(page);await expect(panel).toBeVisible();const report=JSON.parse(await panel.getByRole('textbox').inputValue());expect(report.errorType).toBe('invalid-share');expect(JSON.stringify(report)).not.toContain(secret);
});
test('fixed trace mock reproduces identical preview and clear revokes consent',async({page})=>{
 await page.goto(route);const result=await page.evaluate(async()=>{
  const {mountDiagnosticReport}=await import('/world/future-machine/diagnostics.js');const host=document.createElement('div');document.body.append(host);
  const report=mountDiagnosticReport(host,{traceId:()=> 'hbl-0123456789abcdef0123456789abcdef'});
  const input={renderer:'canvas2d',errorType:'comparison-failure'};report.show(input);const a=host.querySelector('textarea').value;
  host.querySelector('input').click();report.clear();const cleared=host.querySelector('section').hidden&&!host.querySelector('input').checked&&host.querySelector('button').disabled;
  report.show(input);const b=host.querySelector('textarea').value;report.dispose();return {a,b,cleared,disposed:!host.children.length};
 });expect(result.a).toBe(result.b);expect(result.cleared).toBe(true);expect(result.disposed).toBe(true);
});
