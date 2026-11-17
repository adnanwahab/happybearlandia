import { createRoom, joinRoom, changeRoom, viewRoom, submitRoom } from './model.js';
let database;
function openDatabase() {
  return database ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('hbl-private-proposal-rooms-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('rooms');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Draft storage unavailable. No changes saved.'));
  });
}
async function transaction(id, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('rooms', 'readwrite');
    const store = tx.objectStore('rooms');
    const request = store.get(id);
    let result;
    request.onsuccess = () => {
      try {
        const outcome = operation(request.result);
        result = outcome.result;
        if (outcome.remove) store.delete(id);
        else if (outcome.room) store.put(outcome.room, id);
      } catch (error) { reject(error); tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Draft transaction aborted.'));
  });
}
export const rooms = {
  create: (id, token, name) => transaction(id, old => {
    if (old) throw new Error('Room already exists.');
    const room = createRoom(token, name); return { room, result: viewRoom(room, token) };
  }),
  join: (id, token, name) => transaction(id, old => {
    if (!old) throw new Error('Room missing or deleted.');
    const room = joinRoom(old, token, name); return { room, result: viewRoom(room, token) };
  }),
  read: (id, token) => transaction(id, room => ({ result: viewRoom(room, token) })),
  change: (id, token, command) => transaction(id, old => {
    const room = changeRoom(old, token, command); return { room, result: viewRoom(room, token) };
  }),
  submit: (id, token, revision) => transaction(id, room => ({ result: submitRoom(room, token, revision) })),
  remove: (id, token) => transaction(id, room => {
    if (!viewRoom(room, token).isOwner) throw new Error('Only the owner may delete.');
    return { remove: true, result: true };
  }),
};
