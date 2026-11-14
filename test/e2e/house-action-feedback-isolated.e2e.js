import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/house/action-feedback.js','utf8').replaceAll('export function','function');
const css=readFileSync('world/house/house.css','utf8');
test('keyboard admission stays pending until acknowledgment and rejection remains readable with reduced motion and no renderer',async({page})=>{
 await page.setContent('<main><button id="read">Read</button><button id="reject">Reject</button></main>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:source+`;window.feedback=mountActionFeedback(document.querySelector('main'));document.querySelector('#read').onclick=()=>feedback.run(()=>new Promise(resolve=>window.ack=resolve),{type:'read',personId:'p1'});document.querySelector('#reject').onclick=()=>feedback.run(()=>({accepted:false,reason:'Object occupied'}),{type:'sit'});`});
 await page.screenshot({path:'.mini-symphony-evidence/SHE-547-feedback-before.png'});
 await page.locator('#read').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-state=pending]')).toContainText('Pending acknowledgment');await expect(page.locator('[data-state=accepted]')).toHaveCount(0);
 await page.locator('#reject').click();await expect(page.locator('[data-state=pending]')).toHaveCount(2);
 await page.evaluate(()=>ack({accepted:true,actionId:'real-action'}));await expect(page.locator('[data-state=accepted]')).toContainText('Accepted');await expect(page.locator('[data-state=rejected]')).toContainText('Object occupied');
 expect(await page.locator('.house-action-character').first().evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
 await page.evaluate(()=>{feedback.observe({completedActions:[]});feedback.observe({minute:10,completedActions:[{id:'real-action',type:'read',completedMinute:9}]});});await expect(page.locator('[data-state=completed]')).toContainText('modeled minute 9');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-547-feedback-after.png'});
});
