import {test,expect} from '@playwright/test';
import {EXPERIENCES} from '../../world/universe/registry.js';

test('directory matches canonical catalog, preserves shortcuts and opens the actual flagship',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/routes');
 await expect(page.locator('[data-experience-id]')).toHaveCount(EXPERIENCES.length);
 const rows=await page.locator('[data-experience-id]').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.experienceId,route:node.querySelector('a').getAttribute('href')})));
 expect(rows).toEqual(EXPERIENCES.map(({id,route})=>({id,route})));
 await expect(page.getByRole('status')).toContainText('31 registered experiences');
 await expect(page.locator('[data-directory-shortcut]')).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Experiment Lab →',exact:true})).toHaveAttribute('href','/world/experiment-lab.html');
 await expect(page.getByRole('link',{name:'Dear Congress ↗',exact:true})).toHaveAttribute('rel','noopener noreferrer');
 await expect(page.locator('[data-experience-id="optimization"] a').last()).toHaveAttribute('href','/world/decision.html?demo=1#advanced');
 await page.getByRole('button',{name:'Worlds & people',exact:true}).click();
 await expect(page.locator('.routes article:visible')).toHaveCount(EXPERIENCES.filter(app=>['worlds','living'].includes(app.category)).length);
 await page.getByRole('button',{name:'All',exact:true}).click();
 await page.locator('[data-experience-id="future-machine"]').getByRole('link',{name:'Open One City, Two Futures →',exact:true}).click();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 expect(await page.evaluate(()=>window.futureMachine.history.seed)).toBe(42);expect(errors).toEqual([]);
});

test('favorites migrate safely, persist, filter and remain usable on a narrow keyboard journey',async({page},info)=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded-directory-test')){localStorage.setItem('hbl-directory-favorites',JSON.stringify(['/world/decision.html?demo=1#advanced','/tools/webgpu/']));sessionStorage.setItem('seeded-directory-test','1');}});
 await page.setViewportSize({width:320,height:844});await page.goto('/routes');
 await expect(page.locator('[data-experience-id]')).toHaveCount(31);
 await page.getByRole('button',{name:'Favorites',exact:true}).click();
 await expect(page.locator('.routes article:visible')).toHaveCount(2);
 await page.getByRole('button',{name:'Remove Optimization from favorites',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Favorites',exact:true}).click();
 await expect(page.locator('.routes article:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'All',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Search workspaces',exact:true});
 await search.fill('two futures');await expect(page.locator('.routes article:visible')).toHaveCount(1);
 const save=page.getByRole('button',{name:'Save One City, Two Futures to favorites',exact:true});await save.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Remove One City, Two Futures from favorites',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-experience-id="future-machine"]').screenshot({path:info.outputPath('directory-flagship-320.png')});
 await search.fill('no-such-workspace');await expect(page.locator('.empty')).toBeVisible();
 await page.getByRole('button',{name:'Show all workspaces',exact:true}).click();await expect(search).toBeFocused();
 await expect(page.locator('.routes article:visible')).toHaveCount(32);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('directory-320.png'),fullPage:true});
});

test('catalog import failure preserves basic flagship links and working filters',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/world/universe/registry.js',route=>route.abort());
 await page.goto('/routes');await expect(page.getByRole('status')).toContainText('full catalog unavailable');
 await expect(page.locator('.routes article')).toHaveCount(24);
 await page.getByRole('searchbox',{name:'Search workspaces',exact:true}).fill('two futures');
 await expect(page.locator('.routes article:visible')).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Open One City, Two Futures →',exact:true})).toHaveAttribute('href','/world/future-machine.html');
 expect(errors).toEqual([]);
});

test('stalled catalog releases basic filters and late loading cannot replace the active fallback',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let release;const delayed=new Promise(resolve=>release=resolve);
 await page.route('**/world/universe/registry.js',async route=>{await delayed;await route.continue();});
 await page.goto('/routes',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('status')).toContainText('full catalog unavailable',{timeout:6000});
 const search=page.getByRole('searchbox',{name:'Search workspaces',exact:true});await search.fill('two futures');
 await expect(page.locator('.routes article:visible')).toHaveCount(1);
 const response=page.waitForResponse('**/world/universe/registry.js');release();await response;
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(search).toHaveValue('two futures');await expect(page.locator('.routes article')).toHaveCount(24);
 await expect(page.locator('.routes article:visible')).toHaveCount(1);expect(errors).toEqual([]);
});

test('denied storage does not prevent browsing or in-memory favorites',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{for(const method of ['getItem','setItem'])Storage.prototype[method]=()=>{throw new DOMException('Storage denied','SecurityError');};});
 await page.goto('/routes');await expect(page.locator('[data-experience-id]')).toHaveCount(31);
 await page.getByRole('button',{name:'Save One City, Two Futures to favorites',exact:true}).click();
 await page.getByRole('button',{name:'Favorites',exact:true}).click();await expect(page.locator('.routes article:visible')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('basic flagship and existing overview links remain available without JavaScript',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
  const page=await context.newPage();await page.goto(baseURL+'/routes');
  await expect(page.locator('.routes article')).toHaveCount(24);
  await expect(page.getByRole('link',{name:'Open One City, Two Futures →',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open WebGPU demos →',exact:true})).toHaveAttribute('href','/tools/webgpu/');
 }finally{await context.close();}
});
