import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('keyboard and touch-sized static controls, readonly and rerender history',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<main><h1>Recipe card controls · synthetic fixture</h1><div id="deck"></div></main>');
 await page.addStyleTag({content:'.recipe-card-actions button{min-height:44px;min-width:44px}article{padding:16px;border:1px solid #aaa;margin:8px}'});
 const source=await readFile('world/decision/recipe-deck.js','utf8');
 await page.addScriptTag({type:'module',content:source+`
 const histories=new Map(); let readonly=false;
 const container=document.querySelector('#deck');
 const render=()=>{container.innerHTML='<section data-control-group="policy"><h2>Policy cards</h2><article data-parameter-id="a"><label>Permitting</label><input value="6"></article><article data-parameter-id="b"><label>Density</label><input value="2"></article></section>';window.refreshDeck=mountRecipeDeck(container,histories,'plan-a',()=>readonly);};
 window.setDeckReadonly=v=>{readonly=v;window.refreshDeck();};window.renderDeck=render;render();`});
 const ids=()=>page.locator('article').evaluateAll(ns=>ns.map(n=>n.dataset.parameterId));
 await expect(page.getByRole('button',{name:'Undo card move',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Move Permitting down',exact:true}).press('Enter');expect(await ids()).toEqual(['b','a']);
 await page.getByRole('button',{name:'Undo card move',exact:true}).press('Enter');expect(await ids()).toEqual(['a','b']);
 await page.getByRole('button',{name:'Redo card move',exact:true}).press('Enter');expect(await ids()).toEqual(['b','a']);
 await page.evaluate(()=>window.renderDeck());expect(await ids()).toEqual(['b','a']);
 await page.evaluate(()=>window.setDeckReadonly(true));for(const b of await page.getByRole('button').all())await expect(b).toBeDisabled();
 await page.evaluate(()=>window.setDeckReadonly(false));await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Move Permitting up',exact:true}).click();expect(await ids()).toEqual(['a','b']);
 await expect(page.locator('[role="status"]')).toContainText('model inputs unchanged');
});
