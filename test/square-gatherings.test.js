import { test, expect } from 'bun:test';
import { readGatherings, squareState, CROWD_CAP } from '../world/civilization/square/records.js';
import { createCultureSimulation } from '../world/culture/culture-simulation.js';

function fixture() {
  const model = createCultureSimulation({seed:523, initialMinute:0, parameters:{eventFrequency:0}});
  model.scheduleEvent({type:'block-party', startMinute:1});
  model.scheduleEvent({type:'power-outage', startMinute:1});
  model.scheduleEvent({type:'concert', startMinute:600});
  model.stepTo(300);
  return model;
}
test('reads native retained starts only, retaining identity, clock, source and seed without mutations', () => {
  const model = fixture(), snapshot = model.snapshot(), before = model.serialize();
  const archive = readGatherings(snapshot);
  expect(archive.records).toHaveLength(1);
  expect(archive.seed).toBe('523');
  expect(archive.records[0]).toMatchObject({id:snapshot.history[0].event.id, startMinute:1, endMinute:241, source:'manual'});
  for(let i=0;i<100;i++) for(const at of [0,1,240,241,300]) {
    const state = squareState(archive,0,at);
    expect(state.figures).toBe(at>=1 && at<241 ? CROWD_CAP : 0);
  }
  expect(model.serialize()).toEqual(before);
  expect(readGatherings(model.snapshot())).toEqual(archive);
});
test('active and retained entries deduplicate while conflicting IDs fail closed', () => {
  const model = fixture(); model.scheduleEvent({type:'concert'});
  const snapshot = model.snapshot();
  expect(readGatherings(snapshot).records).toHaveLength(2);
  snapshot.activeEvents[0].endMinute++;
  expect(()=>readGatherings(snapshot)).toThrow('Conflicting');
});
test('missing, unsupported, malformed, empty and fictional paths are explicit', () => {
  expect(()=>readGatherings(null)).toThrow('culture.v1');
  const snapshot = fixture().snapshot();
  snapshot.history = []; snapshot.activeEvents = [];
  expect(readGatherings(snapshot).records).toEqual([]);
  expect(squareState(null,0,0)).toMatchObject({figures:0, title:'Quiet square'});
  expect(squareState(null,0,0,true,'Community day')).toMatchObject({figures:CROWD_CAP,title:'Community day'});
  expect(squareState(null,0,0,true,'   ').label).toContain('no modeled event');
  const invalid = fixture().snapshot(); invalid.history[0].event.startMinute = -1; invalid.history[0].minute = -1;
  expect(()=>readGatherings(invalid)).toThrow('Invalid');
  expect(()=>readGatherings({...snapshot,activeEvents:Array(129).fill({})})).toThrow('bounded');
});
