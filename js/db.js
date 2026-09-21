// Único módulo que toca IndexedDB. El resto de la app usa estas funciones.
import { isDayEmpty, normalizeDay, sanitizeHours } from './logic.js';

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

export const getAllDays = () => run('days', 'readonly', (s) => s.getAll());

// Reemplaza TODO lo guardado por el contenido de un archivo ya validado (validateImport).
// Una sola transacción: si algo falla, no se aplica nada y los datos actuales quedan intactos.
export async function importAll(data) {
  const db = await open();
  const { startHour, endHour } = sanitizeHours(data.settings);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['days', 'settings'], 'readwrite');
    const days = tx.objectStore('days');
    const settings = tx.objectStore('settings');
    days.clear();
    for (const d of data.days) {
      const day = normalizeDay(d);
      if (!isDayEmpty(day)) days.put(day);
    }
    settings.put(startHour, 'startHour');
    settings.put(endHour, 'endHour');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getSetting =(key, fallback) =>
  run('settings', 'readonly', (s) => s.get(key)).then((v) => (v === undefined ? fallback : v));

export const setSetting = (key, value) => run('settings', 'readwrite', (s) => s.put(value, key));
