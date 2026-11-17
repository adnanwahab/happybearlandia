import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
test('copy failure is selectable and retryable; copied URL reopens exact scenario',async({page},info)=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async url=>{if(!window.allowCopy)throw new Error('Denied');window.copiedURL=url;}},configurable:true});
 });
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await expect(page.getByRole('button',{name:'Share comparison',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.getByTestId('future-machine-timeline').fill('16');await page.getByTestId('future-machine-timeline').dispatchEvent('input');
 const before=await page.evaluate(()=>({id:futureMachine.history.experimentId,recipe:futureMachine.history.recipe,metrics:futureMachine.state.diff.metrics}));
 const copy=page.getByRole('button',{name:'Copy comparison link',exact:true});await expect(copy).toHaveCount(1);
 await copy.focus();await page.keyboard.press('Enter');
 await expect(page.locator('.fm-status')).toContainText('Could not copy automatically');
 const input=page.getByRole('textbox',{name:'Comparison URL',exact:true});await input.focus();
 expect(await input.evaluate(el=>el.selectionEnd-el.selectionStart)).toBe((await input.inputValue()).length);
 await page.screenshot({path:info.outputPath('copy-fallback.png'),fullPage:true});
 await page.evaluate(()=>window.allowCopy=true);await copy.click();await expect(page.locator('.fm-status')).toContainText('Comparison link copied');
 const url=await page.evaluate(()=>window.copiedURL);expect(url).toBe(await input.inputValue());
 const other=await page.context().browser().newContext();const reopened=await other.newPage();
 try{await reopened.goto(url);await ready(reopened);expect(await reopened.evaluate(()=>({id:futureMachine.history.experimentId,recipe:futureMachine.history.recipe,metrics:futureMachine.state.diff.metrics}))).toEqual(before);expect(await reopened.evaluate(()=>futureMachine.state.month)).toBe(16);}finally{await other.close();}
});
test('native share has success, cancellation and recoverable failure feedback',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared=data;if(window.shareFailure)throw new DOMException('failed',window.shareFailure);}}));
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const share=page.getByRole('button',{name:'Share comparison',exact:true});await share.click();await expect(page.locator('.fm-status')).toHaveText('Comparison shared.');
 expect(await page.evaluate(()=>window.shared.url)).toBe(await page.getByRole('textbox',{name:'Comparison URL',exact:true}).inputValue());
 await page.evaluate(()=>window.shareFailure='AbortError');await share.click();await expect(page.locator('.fm-status')).toContainText('Sharing cancelled');
 await page.evaluate(()=>window.shareFailure='NotAllowedError');await share.click();await expect(page.locator('.fm-status')).toContainText('Browser sharing failed');await expect(page.getByRole('button',{name:'Copy comparison link',exact:true})).toBeEnabled();
});
