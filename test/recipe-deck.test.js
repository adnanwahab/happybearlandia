import {test, expect} from 'bun:test';
import {createCardOrder} from '../world/decision/recipe-deck.js';
import {createDecisionManifest, normalizeDecisionInput} from '../world/decision/contracts.js';
import {housingModel, createHousingScenarios} from '../world/models/housing/index.js';
test('card moves reject boundaries; undo/redo, branching and copies are isolated', () => {
 const h=createCardOrder(['a','b','c']);
 expect(h.move('a',-1)).toBe(false); expect(h.move('missing',1)).toBe(false);
 expect(h.move('a',2)).toBe(false); expect(h.canUndo).toBe(false);
 expect(h.move('a',1)).toBe(true); expect(h.ids).toEqual(['b','a','c']);
 h.undo(); expect(h.ids).toEqual(['a','b','c']); h.redo(); expect(h.ids).toEqual(['b','a','c']);
 h.undo(); h.move('c',-1); expect(h.canRedo).toBe(false);
 const copy=h.ids; copy.reverse(); expect(h.ids).toEqual(['a','c','b']);
 const other=createCardOrder(['a','b','c']); expect(other.canUndo).toBe(false);
});
test('move history is bounded',()=>{const h=createCardOrder(['a','b']);for(let i=0;i<60;i++)h.move('a',i%2?-1:1);let n=0;while(h.undo())n++;expect(n).toBe(50);});
test('all edited parameters and uncertainty survive manifest without card order',()=>{
 const input=normalizeDecisionInput({name:'Recipe',decision:'Housing',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:1,years:1,scenarios:createHousingScenarios()},housingModel);
 const before=structuredClone(input);const h=createCardOrder(housingModel.parameters.map(p=>p.id));h.move(h.ids[0],1);h.undo();h.redo();
 expect(input).toEqual(before);
 const manifest=createDecisionManifest(input,housingModel);
 expect(manifest.experiment.scenarios).toEqual(input.scenarios);
 expect(manifest.parameterDefinitions.map(p=>p.id)).toEqual(housingModel.parameters.map(p=>p.id));
 expect(JSON.stringify(manifest)).not.toContain('cardOrder');
});
