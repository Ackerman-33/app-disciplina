// Único módulo que toca IndexedDB. El resto de la app usa estas funciones.
import { isDayEmpty } from './logic.js';

const DB_NAME = 'disciplina';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('days', { keyPath: 'date' });
        db.createObjectStore('settings');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Corre una operación dentro de una transacción y espera a que TERMINE de guardarse.
function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const getDay = (date) => run('days', 'readonly', (s) => s.get(date));

// Un día sin nada escrito ni marcado se borra: no llenamos la base de fichas vacías.
export const saveDay = (day) =>
  isDayEmpty(day)
    ? run('days', 'readwrite', (s) => s.delete(day.date))
    : run('days', 'readwrite', (s) => s.put(day));

export const getSetting = (key, fallback) =>
  run('settings', 'readonly', (s) => s.get(key)).then((v) => (v === undefined ? fallback : v));

export const setSetting = (key, value) => run('settings', 'readwrite', (s) => s.put(value, key));
