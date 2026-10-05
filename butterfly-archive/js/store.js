// Specimens are kept in this browser's IndexedDB. Only the finished butterfly is stored,
// never the original photographs.

const DB_NAME = 'butterfly-archive';
const STORE = 'specimens';

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const allSpecimens = () => run('readonly', (s) => s.getAll());
export const addSpecimen = (specimen) => run('readwrite', (s) => s.add(specimen));
export const removeSpecimen = (id) => run('readwrite', (s) => s.delete(id));
