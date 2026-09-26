/**
 * Saves live in IndexedDB: a career is a few MB of JSON, more than
 * localStorage reliably holds. Every call is wrapped so a private window or
 * blocked storage just means "no save", never a crash.
 */
const DB = "fairway-manager";
const STORE = "saves";
const KEY = "career";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSave(): Promise<string | null> {
  try {
    return ((await run("readonly", (s) => s.get(KEY))) as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeSave(json: string): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(json, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function deleteSave(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing to delete.
  }
}
