import {test, expect} from 'bun:test';
import {createPopulationModel} from '../world/population/model.js';
import {normalizePopulationConfig, POPULATION_VERSION} from '../world/population/contracts.js';

test('one million represented people do not allocate one million explicit resident rows',()=>{
  const model=createPopulationModel({population:1000,representedPopulation:1_000_000,seed:42});
  expect(model.config.population).toBe(1000);
  expect(model.weight).toBe(1000);
  for(const values of Object.values(model.people)) {
    if(ArrayBuffer.isView(values)) expect(values.length).toBe(1000);
  }
  expect(model.people.household.length*model.weight).toBe(1_000_000);
  const replay=createPopulationModel({population:1000,representedPopulation:1_000_000,seed:42});
  expect(replay.people).toEqual(model.people);
  expect(replay.prefix).toBe(model.prefix);
});

test('explicit million-row requests fail schema validation rather than silently changing the model',()=>{
  expect(POPULATION_VERSION).toBe('1.3.0');
  expect(normalizePopulationConfig({}).population).toBe(10000);
  expect(()=>createPopulationModel({population:1_000_000,seed:42})).toThrow();
});
