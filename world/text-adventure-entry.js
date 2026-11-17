import {mountTextAdventure} from './text-adventure.js';
export async function startTextAdventure() {
 const root=document.createElement('main');root.id='text-adventure';document.body.replaceChildren(root);
 document.documentElement.className='';document.body.className='';
 document.title='World text adventure · HappyBearLandia';
 function unavailable(message){const title=document.createElement('h1');title.textContent='World · Text adventure unavailable';title.tabIndex=-1;const status=document.createElement('p');status.setAttribute('role','alert');status.textContent=message;root.replaceChildren(title,status);title.focus();}
 // Never silently replace a requested saved/foreign run with synthetic residents.
 const params=new URLSearchParams(location.search);
 if([...params.keys()].some(key=>key!=='text')||location.hash){unavailable('This scene context is not supported in text mode. Saved or restricted run data has not been loaded. Open /world?text=1 explicitly for a fresh synthetic scene.');return;}
 root.textContent='Loading synthetic Population scene…';
 let runtime;
 try{
  const {createPopulationRuntime}=await import('./population/runtime.js');
  runtime=createPopulationRuntime({config:{population:16,seed:42,snapshotId:'text-adventure.v1'},worldContext:{},workerCount:1,stepMinutes:30});
  window.addEventListener('pagehide',()=>runtime.destroy(),{once:true});
  await runtime.ready;mountTextAdventure({root,runtime});
 }catch{runtime?.destroy();unavailable('Population data unavailable. No residents or events have been invented. Reload to retry.');}
}
