import {test,expect} from 'bun:test';
import {DOCK_KEY,readDockPreferences} from '../world/tool-panel-dock.js';
test('dock preferences accept only bounded presentation settings',()=>{
 const valid={collapsed:true,floating:false,width:320};
 expect(readDockPreferences({getItem:key=>{expect(key).toBe(DOCK_KEY);return JSON.stringify({build:valid,unknown:valid,why:{...valid,width:900},metrics:{...valid,collapsed:'yes'}});}})).toEqual({build:valid});
});
test('blocked, malformed and absent local storage recover without changing owners',()=>{
 for(const storage of [undefined,{getItem(){throw Error('blocked')}},{getItem:()=>'{broken'},{getItem:()=>null}])expect(readDockPreferences(storage)).toEqual({});
});
