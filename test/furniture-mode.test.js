import {test,expect} from 'bun:test';
import {furnitureChoices} from '../world/house/furniture-mode.js';
test('furniture picker uses only connected catalog costs and actual household savings',()=>{const rows=furnitureChoices({furnitureCatalog:{desk:{cost:250},plant:{cost:30},invalid:{cost:NaN}}},{savings:100});expect(rows.map(r=>r.type)).toEqual(['desk','plant']);expect(rows[0].affordable).toBe(false);expect(rows[1].affordable).toBe(true);expect(furnitureChoices()).toEqual([]);expect(furnitureChoices({furnitureCatalog:{desk:{cost:250}}},{} )[0].affordable).toBe(false);});

test('electronic furniture keeps clear catalog labels',()=>{expect(furnitureChoices({furnitureCatalog:{tv:{cost:200},computer:{cost:500}}},{savings:1000}).map(r=>r.label)).toEqual(['TV','Computer']);});
