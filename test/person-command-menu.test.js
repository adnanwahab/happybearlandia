import {test,expect} from 'bun:test';
import {isCommandClick} from '../world/people/person-command-menu.js';
test('walk clicks require same pointer, left button and no camera drag',()=>{const start={id:1,x:100,y:100};expect(isCommandClick(start,{pointerId:1,button:0,clientX:102,clientY:103})).toBe(true);expect(isCommandClick(start,{pointerId:1,button:0,clientX:120,clientY:103})).toBe(false);expect(isCommandClick(start,{pointerId:2,button:0,clientX:100,clientY:100})).toBe(false);expect(isCommandClick(start,{pointerId:1,button:2,clientX:100,clientY:100})).toBe(false);});
