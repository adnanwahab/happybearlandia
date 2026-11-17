import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';

// Execute the real page module with controlled view/network boundaries, as in
// the Future Machine coordinator tests. No browser or live server is required.
const source=await readFile(new URL('../world/city/lab.js',import.meta.url),'utf8');
async function boot(){
 const window=new EventTarget(),nodes=new Map();
 const node=()=>({value:'',replaceChildren(){},classList:{toggle(){}}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelectorAll:()=>[]};
 const tiles={state:null,destroyed:0,updates:0,update(state){this.state=state;this.updates++;},destroy(){this.state=null;this.destroyed++;}};
 const noop=()=>{};
 const context=createContext({document,URL,location:{href:'https://example.test/world/city-lab.html'},
  addEventListener:window.addEventListener.bind(window),
  fetch:async()=>({ok:true,json:async()=>({experiments:[]})})});
 const modules={
  './life.js':{mountLife:()=>({update:noop})},
  './policy-comparison.js':{housingDrainageExperiment:noop,POLICY_COMPARISON_VERSION:'fixture',POLICY_FLOOD_QUERY:''},
  './spatial-tiles-view.js':{mountCityTiles:()=>tiles},
  './unblock-view.js':{mountProjectUnblock:()=>({update:noop})},
  './seed.js':{createCityFromArea:noop},
 };
 const page=new SourceTextModule(source,{context});
 await page.link(specifier=>{const exports=modules[specifier];if(!exports)throw Error(`Missing adapter: ${specifier}`);return new SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{context});});
 await page.evaluate();
 const hide=persisted=>{const event=new Event('pagehide');Object.defineProperty(event,'persisted',{value:persisted});window.dispatchEvent(event);};
 return {tiles,hide};
}

test('cached City Lab navigation retains tile state and still cleans up on final unload',async()=>{
 const {tiles,hide}=await boot();
 const replay={month:12,tiles:['district:d1'],camera:{x:100,y:50}};
 tiles.update(replay);const updates=tiles.updates;
 hide(true);hide(true);
 expect(tiles.destroyed).toBe(0);
 expect(tiles.state).toBe(replay);
 expect(tiles.updates).toBe(updates);
 hide(false);
 expect(tiles.destroyed).toBe(1);
 expect(tiles.state).toBeNull();
});

test('ordinary City Lab unload disposes its tiles',async()=>{
 const {tiles,hide}=await boot();
 hide(false);
 expect(tiles.destroyed).toBe(1);
});
