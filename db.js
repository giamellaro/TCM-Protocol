const DB_NAME = 'tcm_logger';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
  const db = req.result;

  if (!db.objectStoreNames.contains('meta')) {
    db.createObjectStore('meta', { keyPath: 'key' });
  }

  if (!db.objectStoreNames.contains('events')) {
    const store = db.createObjectStore('events', { keyPath: 'id' });
    store.createIndex('by_lesson', 'lessonId', { unique: false });
    store.createIndex('by_created', 'createdAt', { unique: false });
  }

  // ✅ NEW: observations store
  if (!db.objectStoreNames.contains('observations')) {
    const store = db.createObjectStore('observations', { keyPath: 'id' });
    store.createIndex('by_lesson', 'lessonId', { unique: false });
    store.createIndex('by_time', 'ts', { unique: false });
  }
};
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode='readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getMeta(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'meta').get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'meta', 'readwrite').put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function addObservation(obs) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('observations', 'readwrite');
    const store = tx.objectStore('observations');
    const req = store.add(obs);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listObservationsByLesson(lessonId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('observations', 'readonly');
    const store = tx.objectStore('observations');
    const index = store.index('by_lesson');
    const req = index.getAll(lessonId);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteObservation(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('observations', 'readwrite');
    const store = tx.objectStore('observations');
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
