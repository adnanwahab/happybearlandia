import {test,expect} from 'bun:test';
import {createCanvasRenderer} from '../world/canvas2d-world.js';
import {createCanvasRenderer as existing} from '../world/render/renderer/canvas-renderer.js';
import {startWorld} from '../world/renderer-entry.js';
test('World compatibility entry reuses the active geometry renderer without starting a second engine',()=>{
 expect(createCanvasRenderer).toBe(existing); expect(typeof startWorld).toBe('function');
 expect(()=>createCanvasRenderer({canvas:{getContext:()=>null}})).toThrow('Canvas2D is unavailable');
});
