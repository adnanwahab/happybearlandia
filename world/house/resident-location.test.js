import {test, expect} from 'bun:test';
import {activeResidentDate, isOnDate, isResidentVisibleAtHome} from './resident-location.js';
import {recordedPose, residentPresentationLabel} from './scene/residents.js';
import {createPopulationModel, inspectHousehold, serializePopulation, restorePopulation} from '../population/model.js';
import {applyHouseholdSystemCommand} from './system-command.js';
import {dateVenues} from './date-system.js';

test('an active date overrides a coarse HOME anchor without rewriting the person', () => {
  const person = {id: 'city-p0', atHome: true, roomId: 'bedroom', currentActivity: 'HOME',
    date: {id: 'city-h1-date-1', householdId: 'city-h1', phase: 'date',
      venue: {kind: 'park'}, label: 'Walking in the date neighborhood'}};
  const data = {home: {householdId: 'city-h0', systems: {dates: {active: null}}}};
  const before = structuredClone({person, data});
  expect(isOnDate(person, data)).toBe(true);
  expect(activeResidentDate(person, data).householdId).toBe('city-h1');
  expect(isResidentVisibleAtHome(person, data)).toBe(false);
  expect({person, data}).toEqual(before);
  expect(isOnDate({...person, date: {...person.date, status: 'completed', endedMinute: 10}}, data)).toBe(false);
  expect(isOnDate({...person, date: {...person.date, phase: 'cancelled'}}, data)).toBe(false);
});

test('actual active membership is a fallback; date history and other residents are not', () => {
  const person = {id: 'city-p0', atHome: true};
  const active = {id: 'date-1', status: 'active', personIds: [person.id, 'city-p4'],
    venue: {kind: 'cafe'}, activity: {type: 'talk', label: 'Talk together'}};
  const data = {home: {householdId: 'city-h0', systems: {dates: {active}}}};
  expect(activeResidentDate(person, data)).toMatchObject({id: 'date-1', householdId: 'city-h0', activity: 'talk'});
  expect(isOnDate({id: 'city-p1'}, data)).toBe(false);
  const ended = {home: {...data.home, systems: {dates: {active: null, history: [active]}}}};
  expect(isOnDate(person, ended)).toBe(false);
  expect(isOnDate({...person, date: {id: active.id, householdId: 'city-h0'}}, ended)).toBe(false);
  expect(isResidentVisibleAtHome(person, ended)).toBe(true);
  expect(isResidentVisibleAtHome({...person, atHome: false}, ended)).toBe(false);
});

test('home dates and planning stay visible, but travel and actual neighborhood exploration do not', () => {
  const person = {id: 'city-p0', atHome: true};
  const partner = {id: 'city-p4', atHome: true};
  const active = {id: 'date-1', status: 'active', phase: 'date', personIds: [person.id, partner.id],
    venue: {kind: 'home'}, worldPositions: {[person.id]: {x: 0, z: 0}, [partner.id]: {x: 0.8, z: 0}}};
  const data = {home: {householdId: 'city-h0', systems: {dates: {active}}}};
  expect(isOnDate(person, data)).toBe(true);
  expect(isResidentVisibleAtHome(person, data)).toBe(true);
  expect(isResidentVisibleAtHome(partner, data)).toBe(true);
  active.localMovement = {personIds: [person.id]};
  expect(isResidentVisibleAtHome(person, data)).toBe(false);
  expect(isResidentVisibleAtHome(partner, data)).toBe(true);
  active.localMovement = null;
  active.worldPositions[person.id] = {x: 60, z: 0};
  expect(isResidentVisibleAtHome(person, data)).toBe(false);
  active.phase = 'planning';
  active.venue = {kind: 'park'};
  expect(isResidentVisibleAtHome(person, data)).toBe(true);
  active.phase = 'traveling';
  expect(isResidentVisibleAtHome(person, data)).toBe(false);
  active.phase = 'traveling-home';
  expect(isResidentVisibleAtHome(person, data)).toBe(false);
});

test('home date presentation follows its actual activity instead of a stale sleeping routine', () => {
  const person = {id: 'city-p0', atHome: true, roomId: 'bedroom', needActivity: 'Sleeping',
    date: {id: 'date-1', householdId: 'city-h0', phase: 'date', activity: 'talk',
      venue: {kind: 'home'}, label: 'Talk together'}};
  expect(recordedPose({home: {}}, person)).toBe('talk');
  expect(residentPresentationLabel(person, 'sleep')).toBe('Talk together');
  expect(recordedPose({home: {}}, {...person, date: {...person.date, activity: null}})).toBe('idle');
  expect(residentPresentationLabel({...person, date: {...person.date, phase: 'planning'}}, 'sleep')).toBe('Planning a date');
  const completed = {...person, date: {...person.date, status: 'completed'}};
  expect(recordedPose({home: {}}, completed)).toBe('sleep');
  expect(residentPresentationLabel(completed, 'sleep')).toBe('Sleeping');
});

test('a real shared-anchor date is shown separately through checkpoint reload and returns only after explicit completion', () => {
  const m = createPopulationModel({population: 12, householdSize: 4, seed: 42}, {
    buildings: [{id: 'home', kind: 'home', center: [0, 0]}, {id: 'park', kind: 'park', center: [0, 0]}],
  }, {initialMinute: 360, initialTick: 360});
  const householdId = m.prefix + '-h0', ids = [m.prefix + '-p0', m.prefix + '-p4'];
  for (const i of [0, 4]) {
    m.people.ageYears[i] = 30;
    m.people.age[i] = 1;
    m.people.parent1[i] = m.people.parent2[i] = -1;
  }
  m.social.ties[JSON.stringify(ids)] = {a: ids[0], b: ids[1], kind: 'Friends', dating: true,
    friendship: 56, romance: 35, tension: 0, familiarity: 60, memories: [], lastMinute: null};
  const venue = dateVenues(m, inspectHousehold(m, 0).house)[0];
  const result = applyHouseholdSystemCommand(m, {householdId, system: 'dates', type: 'start',
    personIds: ids, consentingPersonIds: ids, venueId: venue.id, travelMode: 'instant'});
  const view = inspectHousehold(m, 0), person = view.memberDetails[0];
  // Supplied public venues can share the coarse city coordinates of a home.
  expect(person.atHome).toBe(true);
  const before = serializePopulation(m);
  expect(isResidentVisibleAtHome(person, view)).toBe(false);
  expect(activeResidentDate(person, view).id).toBe(result.dateId);
  expect(serializePopulation(m)).toEqual(before);
  const restored = restorePopulation(before), otherHome = inspectHousehold(restored, 1);
  expect(activeResidentDate(otherHome.memberDetails[0], otherHome).householdId).toBe(householdId);
  expect(isResidentVisibleAtHome(otherHome.memberDetails[0], otherHome)).toBe(false);
  const minute = restored.minute, hunger = [...restored.people.hunger], cash = [...restored.households.savings];
  applyHouseholdSystemCommand(restored, {householdId, system: 'dates', type: 'end', dateId: result.dateId, travelMode: 'instant'});
  for (const h of [0, 1]) {
    const returned = inspectHousehold(restored, h);
    expect(isOnDate(returned.memberDetails[0], returned)).toBe(false);
    expect(isResidentVisibleAtHome(returned.memberDetails[0], returned)).toBe(true);
  }
  expect(restored.minute).toBe(minute);
  expect([...restored.people.hunger]).toEqual(hunger);
  expect([...restored.households.savings]).toEqual(cash);
  expect(restored.social.ties[JSON.stringify(ids)].memories).toHaveLength(0);
});
