import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
test('three player questions reopen receipts, survive refresh, reject mismatch and recover',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByText('Challenge a friend: three policy questions',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Share question 1',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.getByTestId('future-machine-timeline').fill('16');await page.getByTestId('future-machine-timeline').dispatchEvent('input');
 const identity=await page.evaluate(()=>({id:window.futureMachine.history.experimentId,metrics:window.futureMachine.state.diff.metrics}));
 const urls=[];
 for(let i=1;i<=3;i++){
  await page.getByLabel(`Question ${i}`,{exact:true}).fill(`What policy changes outcome ${i}? 🐻 <b>question</b>`);
  await page.getByRole('button',{name:`Share question ${i}`,exact:true}).click();
  const link=page.getByRole('link',{name:`Open question ${i} link`,exact:true});await expect(link).toBeVisible();urls.push(await link.getAttribute('href'));
 }
 for(let i=1;i<=3;i++){
  await page.goto(urls[i-1]);await ready(page);
  await expect(page.getByText(`Shared question: What policy changes outcome ${i}? 🐻 <b>question</b>`,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>({id:window.futureMachine.history.experimentId,metrics:window.futureMachine.state.diff.metrics}))).toEqual(identity);
  expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(16);
 }
 await page.reload();await ready(page);await expect(page.getByText(/^Shared question:/)).toBeVisible();
 const changed=new URL(urls[0]);changed.searchParams.set('month','17');await page.goto(changed.href);await expect(page.getByRole('alert')).toContainText('does not match receipt');expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();
 // Keep URL/receipt context consistent but remove the saved record at the API boundary.
 await page.route('**/api/city-experiments/*',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Experiment not found'})}));
 await page.goto(urls[0]);await expect(page.getByRole('alert')).toContainText(/not found/i);expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();await page.unrouteAll();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();await expect(page.getByRole('link',{name:'Open comparison link'})).toBeVisible();
});

test('a new run wins over delayed startup challenge validation',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.getByText('Challenge a friend: three policy questions',{exact:true}).click();
 await page.getByRole('button',{name:'Share question 1',exact:true}).click();
 const link=page.getByRole('link',{name:'Open question 1 link',exact:true});await expect(link).toBeVisible();
 const url=await link.getAttribute('href');
 await page.addInitScript(()=>{
  const digest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
  crypto.subtle.digest=async(...args)=>{
   if(first){first=false;window.challengeValidationHeld=true;await new Promise(resolve=>window.releaseChallengeValidation=resolve);}
   return digest(...args);
  };
 });
 await page.goto(url);await expect.poll(()=>page.evaluate(()=>window.challengeValidationHeld)).toBe(true);
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const id=await page.evaluate(()=>window.futureMachine.history.experimentId);
 await page.evaluate(()=>window.releaseChallengeValidation());
 // Wait for the deliberately held validator to finish all its async digest work.
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('ready');
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>window.futureMachine.history.experimentId)).toBe(id);
 await expect(page.getByText(/^Shared question:/)).toBeHidden();
});
