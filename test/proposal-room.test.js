import { test, expect } from 'bun:test';
import { createRoom, joinRoom, changeRoom, viewRoom, submitRoom } from '../world/invention/room/model.js';
const proposal = policyId => ({ type: 'propose', edit: { parcelId: 'parcel-d0', policyId } });
test('isolated drafts retain authorship and resolve competing policies explicitly', () => {
  const original = createRoom('owner', 'Ada');
  let room = joinRoom(original, 'guest', 'Bo');
  room = changeRoom(room, 'owner', proposal('transit-d0-4'));
  room = changeRoom(room, 'guest', proposal('transit-d0-8'));
  expect(original.proposals).toEqual([]);
  expect(room.proposals.map(row => row.author)).toEqual(['Ada', 'Bo']);
  expect(() => changeRoom(room, 'owner', {type:'review',revision:room.revision,ids:['p2','p3']})).toThrow('one option');
  expect(room.review).toBeNull();
  room = changeRoom(room, 'owner', {type:'review',revision:room.revision,ids:['p3']});
  expect(decodeURIComponent(submitRoom(room, 'owner', room.revision))).toContain('transit-d0-8');
  expect(room.review.blueprint.source).toEqual(original.blueprint.source);
  expect(room.review.blueprint.modelVersion).toBe(original.blueprint.modelVersion);
});
test('guests and unknown identities cannot review, submit, or read private drafts', () => {
  const room = joinRoom(createRoom('owner','Ada'),'guest','Bo');
  expect(() => viewRoom(room,'unknown')).toThrow('Access denied');
  expect(() => viewRoom(undefined,'guest')).toThrow('Access denied');
  expect(() => changeRoom(room,'guest',{type:'review',revision:1,ids:[]})).toThrow('owner');
  expect(() => submitRoom(room,'guest',1)).toThrow('owner');
  expect(() => submitRoom(room,'owner',1)).toThrow('review missing');
  expect(viewRoom(room,'guest').owner).toBeUndefined();
  expect(viewRoom(room,'guest').members).toEqual([{name:'Ada'},{name:'Bo'}]);
});
test('revision isolation, invalid input and comments invalidate review atomically', () => {
  let room = createRoom('owner','Ada');
  expect(() => changeRoom(room,'owner',proposal('bogus'))).toThrow('Unsupported');
  expect(() => changeRoom(room,'owner',{type:'comment',text:' '})).toThrow('Comment');
  expect(() => changeRoom(room,'owner',{type:'review',revision:0,ids:['missing']})).toThrow('selection');
  room = changeRoom(room,'owner',proposal('transit-d0-4'));
  expect(() => changeRoom(room,'owner',{type:'review',revision:0,ids:[]})).toThrow('changed');
  room = changeRoom(room,'owner',{type:'review',revision:1,ids:['p1']});
  const reviewed = structuredClone(room);
  room = changeRoom(room,'owner',{type:'comment',text:'Review utility assumptions'});
  expect(room.review).toBeNull();
  expect(() => submitRoom(room,'owner',reviewed.revision)).toThrow('changed');
  expect(submitRoom(reviewed,'owner',reviewed.revision)).toBe(submitRoom(structuredClone(reviewed),'owner',reviewed.revision));
});
test('authorship is distinct and room limits reject rather than truncate drafts', () => {
  const room = createRoom('owner','Ada');
  expect(() => joinRoom(room,'guest','ada')).toThrow('distinct');
  expect(() => changeRoom(room,'owner',{type:'comment',text:'x'.repeat(501)})).toThrow('Comment');
  const full = {...room,proposals:Array.from({length:100},()=>({}))};
  expect(() => changeRoom(full,'owner',proposal('transit-d0-4'))).toThrow('limit');
});
