import { filterExperimentRecords } from "./experiment-registry.js";
const DB_NAME = "happybearlandia-civic-experiments";
const DB_VERSION = 1;
const STORE = "records";

function openDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is not available in this environment"));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Failed to open experiment store"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("savedAt", "savedAt");
        store.createIndex("experimentId", "experiment.id");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore(mode, fn, indexedDb) {
  const db = await openDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = fn(store, resolve, reject);
      } catch (error) {
        reject(error);
        return;
      }
      tx.onerror = () => reject(tx.error || new Error("Experiment store transaction failed"));
      if (result !== undefined) resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function saveExperimentRecord(record, options = {}) {
  if (!record?.id) throw new Error("saveExperimentRecord requires a record id");
  return withStore("readwrite", (store, resolve, reject) => {
    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(record);
  }, options.indexedDb);
}

export async function loadExperimentRecord(id, options = {}) {
  if (!id) return null;
  return withStore("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  }, options.indexedDb);
}

export async function listExperimentRecords(limit = 20, options = {}) {
  return withStore("readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const rows = filterExperimentRecords(request.result || [], options.filters)
        .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))
        .slice(0, Math.max(1, limit));
      resolve(rows);
    };
  }, options.indexedDb);
}

export async function deleteExperimentRecord(id, options = {}) {
  return withStore("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(true);
  }, options.indexedDb);
}
