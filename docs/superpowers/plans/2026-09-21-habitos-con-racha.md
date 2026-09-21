# Hábitos con racha (Etapa 2A) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar hábitos diarios con frecuencia propia (días de la semana), marcas cumplido/no cumplido por día y racha, sin perder ningún dato de la Etapa 1.

**Architecture:** Lógica pura y testeable en `js/logic.js` (toca/racha/validaciones); `js/db.js` sube IndexedDB a versión 2 con un store `habits`; un módulo nuevo `js/habits.js` dibuja el bloque "HÁBITOS" de hoy; `js/settings.js` suma la gestión (alta/edición/archivo). Las marcas viven dentro de la ficha del día (`day.habits`). Se construye en dos entregas probadas en el celu: (1) hábitos y marcas, (2) racha.

**Tech Stack:** HTML/CSS/JS con módulos ES nativos, IndexedDB, service worker. Sin dependencias ni build. Tests con `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-21-habitos-con-racha-design.md`

## Global Constraints

- Sin frameworks, dependencias ni build. Rutas relativas (`./`).
- Tests: correr `node --test` en la raíz del proyecto (**sin** pasarle `tests/` como argumento en Node 24). Estado inicial: 31 tests en verde.
- Fechas locales `YYYY-MM-DD`; nunca `toISOString()` para fechas de día.
- Convención de días de la semana: `Date.getDay()` (0 = domingo … 6 = sábado). Orden visual de botones: `L M X J V S D` = `[1,2,3,4,5,6,0]`.
- Hábito: `{ id, name, days, createdAt, archivedAt }`; `name` 1–40 caracteres (trim), `days` con al menos 1 día sin repetidos, `id` = `crypto.randomUUID()`. Un hábito nunca se borra: se archiva.
- Base IndexedDB `disciplina`: versión 1 → 2. Los stores `days` y `settings` no se tocan.
- Export/import: `schemaVersion` 2 con `habits`; el import acepta versión 1 (sin hábitos) y 2; rechaza > 2.
- Racha estricta: día pasado que tocaba y sin marcar corta; hoy sin marcar es neutro; hoy `failed` corta.
- Cada vez que se agrega un archivo a `js/`, `fonts/` o `icons/`, agregarlo a `ASSETS` en `sw.js` (un test lo verifica). Cada publicación sube `CACHE_VERSION` en `sw.js`.
- Identidad visual: paleta y fuentes ya definidas en `css/style.css` (variables `--bronce`, `--rojo-claro`, `--gris`, etc.). Sin emojis ni íconos de librería. Textos en español rioplatense.
- Todo commit termina con el trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (se pasa como segundo `-m`).
- Al terminar cada entrega publicada: el usuario (Simon) la prueba en su Android antes de seguir con la siguiente.

## Mapa de archivos

| Archivo | Cambio | Responsabilidad |
|---|---|---|
| `js/logic.js` | modificar | toca, validación, marcas, racha, import/export v2 (todo puro) |
| `js/db.js` | modificar | versión 2, store `habits`, `getAllHabits`, `saveHabit`, `importAll` con hábitos |
| `js/habits.js` | **crear** | dibuja el bloque "HÁBITOS" del día (sin acceso a la base) |
| `js/settings.js` | modificar | gestión de hábitos, export/import con hábitos |
| `js/app.js` | modificar | estado de hábitos, marcas en la ficha del día, racha |
| `index.html` | modificar | contenedor `#habits` |
| `css/style.css` | modificar | bloque hábitos y formulario de ajustes |
| `sw.js` | modificar | asset nuevo + `CACHE_VERSION` |
| `tests/logic.test.mjs` | modificar | tests de todo lo puro |
| `CLAUDE.md`, `GUIA-RESPALDO.md` | modificar | estado y guía |

---

## ENTREGA 1 — Hábitos y marcas (sin racha)

### Task 1: Lógica pura de hábitos y formato de export v2

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.test.mjs`

**Interfaces:**
- Produces (todo exportado desde `js/logic.js`):
  - `SCHEMA_VERSION = 2`
  - `WEEK_ORDER = [1,2,3,4,5,6,0]`, `WEEK_LETTERS = {1:'L',2:'M',3:'X',4:'J',5:'V',6:'S',0:'D'}`
  - `weekdayOf(key: string): number`
  - `habitTocaEn(habit, key: string): boolean`
  - `validateHabitInput({name, days}): {ok:true, name, days} | {ok:false, error}`
  - `newHabit({name, days}, todayKey, id): Habit`
  - `archiveHabit(habit, todayKey): Habit`
  - `applyHabitMark(marks, habitId, mark): marks` (no muta; mismo mark = quita)
  - `formatDays(days: number[]): string`
  - `normalizeDay(day)` ahora agrega `habits: {}`; `isDayEmpty(day)` cuenta marcas de hábito
  - `validateImport(data)` acepta v1/v2 y devuelve además `habitCount`
  - `buildExport({days, habits, startHour, endHour, now})` (habits opcional, default `[]`)

- [ ] **Step 1: Actualizar el test viejo de `buildExport` y agregar los tests nuevos**

En `tests/logic.test.mjs`, reemplazar el bloque `import { ... } from '../js/logic.js';` por:

```js
import {
  dateKey, addDays, hoursRange, hourLabel, formatDateLong,
  isDayEmpty, countSummary, validateImport,
  applyStatus, applyReason, formatSummary, REASONS,
  togglePriority, setPriorityText, normalizeDay, ROMAN,
  clampHours, sanitizeHours, buildExport, exportFileName, formatBytes,
  WEEK_ORDER, WEEK_LETTERS, weekdayOf, habitTocaEn, validateHabitInput,
  newHabit, archiveHabit, applyHabitMark, formatDays,
} from '../js/logic.js';
```

En el test `'buildExport arma el archivo con días ordenados por fecha'`, cambiar la línea `assert.equal(out.schemaVersion, 1);` por:

```js
  assert.equal(out.schemaVersion, 2);
  assert.deepEqual(out.habits, []);
```

Agregar al final del archivo:

```js
// ---------- Etapa 2A: hábitos ----------
const daily = { id: 'h1', name: 'Inglés', days: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-09-10', archivedAt: null };

test('WEEK_ORDER y WEEK_LETTERS: semana L M X J V S D', () => {
  assert.deepEqual(WEEK_ORDER.map((n) => WEEK_LETTERS[n]), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
});

test('weekdayOf usa la fecha local: 2026-09-21 es lunes, 2026-09-20 domingo', () => {
  assert.equal(weekdayOf('2026-09-21'), 1);
  assert.equal(weekdayOf('2026-09-20'), 0);
});

test('habitTocaEn: solo los días elegidos', () => {
  const lmv = { ...daily, days: [1, 3, 5] };
  assert.equal(habitTocaEn(lmv, '2026-09-21'), true); // lunes
  assert.equal(habitTocaEn(lmv, '2026-09-22'), false); // martes
  assert.equal(habitTocaEn(lmv, '2026-09-23'), true); // miércoles
});

test('habitTocaEn: no toca antes de crearse', () => {
  assert.equal(habitTocaEn(daily, '2026-09-09'), false);
  assert.equal(habitTocaEn(daily, '2026-09-10'), true);
});

test('habitTocaEn: archivado deja de tocar desde el día de archivo', () => {
  const arch = { ...daily, archivedAt: '2026-09-20' };
  assert.equal(habitTocaEn(arch, '2026-09-19'), true);
  assert.equal(habitTocaEn(arch, '2026-09-20'), false);
});

test('validateHabitInput acepta, limpia y ordena', () => {
  assert.deepEqual(validateHabitInput({ name: '  Inglés ', days: [5, 1, 1, 3] }), { ok: true, name: 'Inglés', days: [1, 3, 5] });
});

test('validateHabitInput rechaza nombre vacío, largo, sin días o días inválidos', () => {
  assert.equal(validateHabitInput({ name: '   ', days: [1] }).ok, false);
  assert.equal(validateHabitInput({ name: 'x'.repeat(41), days: [1] }).ok, false);
  assert.equal(validateHabitInput({ name: 'Ok', days: [] }).ok, false);
  assert.equal(validateHabitInput({ name: 'Ok', days: [9, -1] }).ok, false);
  assert.equal(validateHabitInput({ name: 'x'.repeat(40), days: [0] }).ok, true);
});

test('newHabit y archiveHabit', () => {
  const h = newHabit({ name: 'Inglés', days: [1] }, '2026-09-21', 'abc');
  assert.deepEqual(h, { id: 'abc', name: 'Inglés', days: [1], createdAt: '2026-09-21', archivedAt: null });
  const a = archiveHabit(h, '2026-09-25');
  assert.equal(a.archivedAt, '2026-09-25');
  assert.equal(h.archivedAt, null); // no muta
});

test('applyHabitMark: marca, cambia y quita (sin mutar)', () => {
  const m0 = {};
  const m1 = applyHabitMark(m0, 'h1', 'done');
  assert.deepEqual(m1, { h1: 'done' });
  assert.deepEqual(m0, {});
  assert.deepEqual(applyHabitMark(m1, 'h1', 'failed'), { h1: 'failed' });
  assert.deepEqual(applyHabitMark(m1, 'h1', 'done'), {});
  assert.deepEqual(applyHabitMark(undefined, 'h2', 'done'), { h2: 'done' });
});

test('formatDays', () => {
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6]), 'Todos los días');
  assert.equal(formatDays([5, 1, 3]), 'L X V');
  assert.equal(formatDays([0, 6]), 'S D');
});

test('normalizeDay agrega habits vacío y respeta el existente', () => {
  assert.deepEqual(normalizeDay({ date: 'x' }).habits, {});
  assert.deepEqual(normalizeDay({ date: 'x', habits: { h1: 'done' } }).habits, { h1: 'done' });
});

test('isDayEmpty: una marca de hábito cuenta como contenido', () => {
  assert.equal(isDayEmpty({ date: 'x', slots: {}, priorities: [], habits: {} }), true);
  assert.equal(isDayEmpty({ date: 'x', slots: {}, priorities: [], habits: { h1: 'failed' } }), false);
});

test('validateImport: acepta v1 sin hábitos y v2 con hábitos', () => {
  const base = { app: 'app-disciplina', days: [] };
  const h = { id: 'a', name: 'Inglés', days: [1], createdAt: '2026-09-10', archivedAt: null };
  const v1 = validateImport({ ...base, schemaVersion: 1 });
  assert.equal(v1.ok, true);
  assert.equal(v1.habitCount, 0);
  const v2 = validateImport({ ...base, schemaVersion: 2, habits: [h, { ...h, id: 'b', archivedAt: '2026-09-20' }] });
  assert.equal(v2.ok, true);
  assert.equal(v2.habitCount, 2);
});

test('validateImport: rechaza v2 sin hábitos, hábitos inválidos y versiones futuras', () => {
  const base = { app: 'app-disciplina', days: [] };
  const h = { id: 'a', name: 'Inglés', days: [1], createdAt: '2026-09-10', archivedAt: null };
  assert.equal(validateImport({ ...base, schemaVersion: 2 }).ok, false);
  assert.equal(validateImport({ ...base, schemaVersion: 2, habits: [{ ...h, days: [9] }] }).ok, false);
  assert.equal(validateImport({ ...base, schemaVersion: 2, habits: [{ ...h, name: '' }] }).ok, false);
  assert.equal(validateImport({ ...base, schemaVersion: 2, habits: [{ ...h, createdAt: 'ayer' }] }).ok, false);
  assert.equal(validateImport({ ...base, schemaVersion: 3, habits: [] }).ok, false);
});

test('buildExport v2 incluye hábitos ordenados por fecha de creación', () => {
  const out = buildExport({
    days: [],
    habits: [
      { id: 'b', name: 'Ejercicio', days: [1], createdAt: '2026-09-15', archivedAt: null },
      { id: 'a', name: 'Inglés', days: [1], createdAt: '2026-09-10', archivedAt: null },
    ],
    startHour: 6, endHour: 24, now: new Date('2026-09-21T10:00:00.000Z'),
  });
  assert.equal(out.schemaVersion, 2);
  assert.deepEqual(out.habits.map((h) => h.id), ['a', 'b']);
  assert.equal(validateImport(out).ok, true);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `node --test 2>&1 | grep -E "does not provide|ℹ (tests|pass|fail)"`
Expected: `SyntaxError: The requested module '../js/logic.js' does not provide an export named 'WEEK_ORDER'` (o similar) y `fail 1`.

- [ ] **Step 3: Implementar en `js/logic.js`**

3a. Cambiar `export const SCHEMA_VERSION = 1;` por `export const SCHEMA_VERSION = 2;`.

3b. Reemplazar la función `isDayEmpty` completa por:

```js
export function isDayEmpty(day) {
  if (!day) return true;
  const slots = Object.values(day.slots || {});
  if (slots.some((s) => (s.text || '').trim() !== '' || s.status)) return false;
  const prios = day.priorities || [];
  if (prios.some((p) => (p.text || '').trim() !== '' || p.done)) return false;
  if (Object.keys(day.habits || {}).length > 0) return false;
  return true;
}
```

3c. Reemplazar la función `normalizeDay` completa por:

```js
export function normalizeDay(day) {
  const saved = Array.isArray(day.priorities) ? day.priorities : [];
  return {
    ...day,
    priorities: ROMAN.map((_, i) => ({ text: saved[i]?.text ?? '', done: saved[i]?.done ?? false })),
    slots: day.slots || {},
    habits: day.habits && typeof day.habits === 'object' ? { ...day.habits } : {},
  };
}
```

3d. Reemplazar `buildExport` completa por:

```js
export function buildExport({ days, habits = [], startHour, endHour, now }) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    settings: { startHour, endHour },
    days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
    habits: [...habits].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)),
  };
}
```

3e. Reemplazar desde la línea `const DATE_RE = ...` hasta el final del archivo (`validateImport`) por:

```js
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidHabit(h) {
  return (
    !!h &&
    typeof h.id === 'string' && h.id !== '' &&
    typeof h.name === 'string' && h.name.trim() !== '' &&
    Array.isArray(h.days) && h.days.length > 0 &&
    h.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    typeof h.createdAt === 'string' && DATE_RE.test(h.createdAt) &&
    (h.archivedAt === null || (typeof h.archivedAt === 'string' && DATE_RE.test(h.archivedAt)))
  );
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'El archivo no tiene el formato esperado.' };
  if (data.app !== APP_ID) return { ok: false, error: 'Este archivo no es un export de esta app.' };
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'El archivo viene de una versión más nueva de la app.' };
  }
  if (!Array.isArray(data.days)) return { ok: false, error: 'Faltan los días en el archivo.' };
  if (data.days.some((d) => !d || typeof d.date !== 'string' || !DATE_RE.test(d.date))) {
    return { ok: false, error: 'Hay días con fecha inválida.' };
  }
  if (data.schemaVersion >= 2 && (!Array.isArray(data.habits) || !data.habits.every(isValidHabit))) {
    return { ok: false, error: 'Hay hábitos inválidos en el archivo.' };
  }
  const dates = data.days.map((d) => d.date).sort();
  return {
    ok: true,
    count: dates.length,
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
    habitCount: Array.isArray(data.habits) ? data.habits.length : 0,
  };
}

// ---------- Hábitos ----------
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEK_LETTERS = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' };

export const weekdayOf = (key) => parseKey(key).getDay();

// ¿Este hábito "toca" en esa fecha?
export function habitTocaEn(habit, key) {
  if (key < habit.createdAt) return false; // "YYYY-MM-DD" se ordena bien como texto
  if (habit.archivedAt && key >= habit.archivedAt) return false;
  return habit.days.includes(weekdayOf(key));
}

export function validateHabitInput({ name, days }) {
  const clean = (name || '').trim();
  if (!clean) return { ok: false, error: 'Poné un nombre.' };
  if (clean.length > 40) return { ok: false, error: 'El nombre puede tener hasta 40 caracteres.' };
  const uniq = [...new Set(days || [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (uniq.length === 0) return { ok: false, error: 'Elegí al menos un día.' };
  return { ok: true, name: clean, days: uniq.sort((a, b) => a - b) };
}

export const newHabit = ({ name, days }, todayKey, id) => ({ id, name, days, createdAt: todayKey, archivedAt: null });

export const archiveHabit = (habit, todayKey) => ({ ...habit, archivedAt: todayKey });

// Tocar la marca activa la quita; tocar la otra la cambia. No muta el objeto original.
export function applyHabitMark(marks, habitId, mark) {
  const next = { ...(marks || {}) };
  if (next[habitId] === mark) delete next[habitId];
  else next[habitId] = mark;
  return next;
}

export function formatDays(days) {
  if (days.length === 7) return 'Todos los días';
  return WEEK_ORDER.filter((n) => days.includes(n)).map((n) => WEEK_LETTERS[n]).join(' ');
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `node --test 2>&1 | grep -E "✖|ℹ (tests|pass|fail)"`
Expected: `fail 0` (los 31 anteriores + los nuevos, todos en verde).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.test.mjs
git commit -m "Etapa 2A: logica pura de habitos y export v2" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Base de datos versión 2 con store `habits` (migración segura)

**Files:**
- Modify: `js/db.js`

**Interfaces:**
- Consumes: `isDayEmpty`, `normalizeDay`, `sanitizeHours` (ya importados de `logic.js`).
- Produces: `getAllHabits(): Promise<Habit[]>`, `saveHabit(habit): Promise<void>`; `importAll(data)` ahora reemplaza también los hábitos (`data.habits`, o lista vacía si el archivo es v1).

- [ ] **Step 1: Subir la versión y crear el store con migración**

En `js/db.js`, cambiar `const DB_VERSION = 1;` por `const DB_VERSION = 2;` y reemplazar la función `open` completa por:

```js
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        // oldVersion es 0 en una instalación nueva y 1 si viene de la Etapa 1.
        if (event.oldVersion < 1) {
          db.createObjectStore('days', { keyPath: 'date' });
          db.createObjectStore('settings');
        }
        if (event.oldVersion < 2) db.createObjectStore('habits', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Si una versión futura necesita actualizar la base, esta conexión se cierra para no bloquearla.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
```

- [ ] **Step 2: Agregar lectura y guardado de hábitos**

Debajo de `export const getAllDays = ...` agregar:

```js
export const getAllHabits = () => run('habits', 'readonly', (s) => s.getAll());
export const saveHabit = (habit) => run('habits', 'readwrite', (s) => s.put(habit));
```

- [ ] **Step 3: `importAll` también reemplaza los hábitos**

Reemplazar la función `importAll` completa por:

```js
export async function importAll(data) {
  const db = await open();
  const { startHour, endHour } = sanitizeHours(data.settings);
  const habits = Array.isArray(data.habits) ? data.habits : []; // un archivo v1 no trae hábitos
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['days', 'settings', 'habits'], 'readwrite');
    const days = tx.objectStore('days');
    const settings = tx.objectStore('settings');
    const habitStore = tx.objectStore('habits');
    days.clear();
    habitStore.clear();
    for (const d of data.days) {
      const day = normalizeDay(d);
      if (!isDayEmpty(day)) days.put(day);
    }
    for (const h of habits) habitStore.put(h);
    settings.put(startHour, 'startHour');
    settings.put(endHour, 'endHour');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
```

- [ ] **Step 4: Verificar la migración con datos reales de la Etapa 1 (navegador de la PC)**

Levantar el servidor (`preview_start` con `app-local`). Abrir `http://localhost:8080/manifest.json` (una página del mismo origen que **no** abre la base) y ejecutar en la consola/JS:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k);
await new Promise((res) => { const r = indexedDB.deleteDatabase('disciplina'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
await new Promise((res, rej) => {
  const r = indexedDB.open('disciplina', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('days', { keyPath: 'date' }); r.result.createObjectStore('settings'); };
  r.onsuccess = () => {
    const tx = r.result.transaction('days', 'readwrite');
    tx.objectStore('days').put({ date: '2026-09-20', priorities: [{ text: 'Vieja prioridad', done: true }, { text: '', done: false }, { text: '', done: false }], slots: { '07': { text: 'dato de la Etapa 1', status: 'done', reason: null } } });
    tx.oncomplete = () => { r.result.close(); res(); };
    tx.onerror = () => rej(tx.error);
  };
});
'base v1 creada con un día';
```

Luego navegar a `http://localhost:8080/`, ir al día anterior (`#prev`) y ejecutar:

```js
await new Promise((r) => setTimeout(r, 500));
const dbs = await indexedDB.databases();
const db = await new Promise((res) => { const r = indexedDB.open('disciplina'); r.onsuccess = () => res(r.result); });
({
  version: dbs.find((d) => d.name === 'disciplina').version,
  stores: [...db.objectStoreNames],
  prioridad: document.querySelectorAll('.pinput')[0].value,
  renglon7: document.querySelector('.row[data-hour="07"] textarea').value,
});
```

Expected: `version: 2`, `stores` contiene `days`, `habits`, `settings`, `prioridad: "Vieja prioridad"`, `renglon7: "dato de la Etapa 1"` (los datos de la Etapa 1 sobrevivieron a la migración).

- [ ] **Step 5: Correr los tests y commit**

Run: `node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"` → `fail 0`.

```bash
git add js/db.js
git commit -m "Etapa 2A: base de datos v2 con store de habitos y migracion" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Gestión de hábitos en AJUSTES

**Files:**
- Modify: `js/settings.js`, `js/app.js`, `css/style.css`

**Interfaces:**
- Consumes: `getAllHabits`, `saveHabit` (db.js); `validateHabitInput`, `newHabit`, `archiveHabit`, `formatDays`, `WEEK_ORDER`, `WEEK_LETTERS`, `dateKey` (logic.js).
- Produces: `initSettings` acepta dos hooks nuevos: `hooks.getHabits(): Habit[]` (todos, incluidos archivados) y `hooks.onHabitsChanged(): Promise<void>` (app.js recarga `state.habits`).

- [ ] **Step 1: `app.js` — estado de hábitos y los dos hooks**

En `js/app.js`:

1. En el import de `./logic.js` no hace falta nada nuevo todavía. Cambiar `import { getDay, saveDay, getSetting, setSetting } from './db.js';` por:

```js
import { getDay, saveDay, getSetting, setSetting, getAllHabits } from './db.js';
```

2. En el objeto `state`, agregar debajo de `endHour: 24,`:

```js
  habits: [],       // todos los hábitos (también los archivados)
```

3. Debajo de la función `onDataReplaced` reemplazarla por (y agregar las dos funciones nuevas antes de ella):

```js
async function loadHabitData() {
  state.habits = await getAllHabits();
}

async function onHabitsChanged() {
  await loadHabitData();
}

// Después de importar un archivo: se vuelve a leer todo desde la base de datos.
async function onDataReplaced() {
  await loadHours();
  await loadHabitData();
  await showDate(state.date, { scroll: false });
}
```

(la definición vieja de `onDataReplaced` y su comentario se eliminan.)

4. En `init()`, después de `await loadHours();` agregar `await loadHabitData();`.

5. En los `hooks` de `initSettings({...})` agregar:

```js
      getHabits: () => state.habits,
      onHabitsChanged,
```

- [ ] **Step 2: `settings.js` — imports y sección en la plantilla**

Reemplazar los imports de arriba del archivo por:

```js
import {
  clampHours, buildExport, exportFileName, validateImport, formatBytes, formatDateLong, dateKey,
  validateHabitInput, newHabit, archiveHabit, formatDays, WEEK_ORDER, WEEK_LETTERS,
} from './logic.js';
import { getAllDays, importAll, getSetting, setSetting, getAllHabits, saveHabit } from './db.js';
import { ICONS } from './icons.js';
```

En `TEMPLATE`, justo **después** de la `</section>` de "Horario de la agenda" y antes de `<section class="block">` de "Tus datos", insertar:

```html
  <section class="block" id="habitsBlock">
    <h2>Hábitos</h2>
    <p class="note">Cada hábito toca solo los días que elijas. La racha cuenta únicamente esos días.</p>
    <ul class="hlist" id="habitList"></ul>
    <div id="habitSuggest" hidden>
      <p class="note">Todavía no tenés hábitos. Tocá uno para empezar:</p>
      <div class="chips" id="habitChips"></div>
    </div>
    <form class="hform" id="habitForm" hidden novalidate>
      <label class="flabel">Nombre <input type="text" id="habitName" maxlength="40" autocomplete="off"></label>
      <div class="flabel">Días en que toca</div>
      <div class="dayrow" id="dayRow" role="group" aria-label="Días en que toca"></div>
      <button type="button" class="textbtn" id="daysAll">Todos los días</button>
      <p class="msg error" id="habitMsg" role="alert"></p>
      <div class="btnrow">
        <button type="submit" class="btn">Guardar</button>
        <button type="button" class="btn" id="habitCancel">Cancelar</button>
      </div>
    </form>
    <div class="btnrow"><button type="button" class="btn" id="habitAdd">Nuevo hábito</button></div>
  </section>
```

- [ ] **Step 3: `settings.js` — lógica de la sección**

Justo **antes** de la función `refreshAll()` (al final de `initSettings`) insertar:

```js
  // ----- hábitos -----
  const SUGGESTIONS = ['Inglés', 'Ejercicio', 'Alimentación', 'Limpieza'];
  const DAY_NAMES = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };
  let editingId = null; // id del hábito que se edita; null = uno nuevo
  let confirmingId = null; // hábito que está esperando la confirmación de "archivar"
  let chosenDays = new Set();

  const mkBtn = (label, cls, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const dayRow = $('dayRow');
  for (const n of WEEK_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'daybtn';
    b.dataset.day = String(n);
    b.textContent = WEEK_LETTERS[n];
    b.setAttribute('aria-label', DAY_NAMES[n]);
    b.addEventListener('click', () => {
      if (chosenDays.has(n)) chosenDays.delete(n);
      else chosenDays.add(n);
      paintDays();
    });
    dayRow.append(b);
  }

  function paintDays() {
    dayRow.querySelectorAll('.daybtn').forEach((b) =>
      b.setAttribute('aria-pressed', String(chosenDays.has(Number(b.dataset.day)))),
    );
  }

  function renderHabitList() {
    const active = hooks.getHabits().filter((h) => !h.archivedAt);
    const list = $('habitList');
    list.textContent = '';
    for (const h of active) {
      const li = document.createElement('li');
      li.className = 'hitem';
      const info = document.createElement('div');
      info.className = 'hinfo';
      const name = document.createElement('strong');
      name.textContent = h.name;
      const days = document.createElement('span');
      days.className = 'note';
      days.textContent = formatDays(h.days);
      info.append(name, days);
      const actions = document.createElement('div');
      actions.className = 'hactions';
      if (confirmingId === h.id) {
        actions.append(
          mkBtn('Sí, archivar', 'btn danger small', async () => {
            await saveHabit(archiveHabit(h, dateKey(new Date())));
            confirmingId = null;
            await hooks.onHabitsChanged();
            renderHabitList();
          }),
          mkBtn('No', 'btn small', () => {
            confirmingId = null;
            renderHabitList();
          }),
        );
      } else {
        actions.append(
          mkBtn('Editar', 'btn small', () => openForm(h)),
          mkBtn('Archivar', 'btn small', () => {
            confirmingId = h.id;
            renderHabitList();
          }),
        );
      }
      li.append(info, actions);
      list.append(li);
    }
    // Las sugerencias aparecen solo si no hay ningún hábito y el formulario está cerrado.
    const showSuggest = active.length === 0 && $('habitForm').hidden;
    $('habitSuggest').hidden = !showSuggest;
    const chips = $('habitChips');
    chips.textContent = '';
    if (showSuggest) for (const s of SUGGESTIONS) chips.append(mkBtn(s, 'chip', () => openForm(null, s)));
  }

  function openForm(habit, presetName = '') {
    editingId = habit ? habit.id : null;
    $('habitName').value = habit ? habit.name : presetName;
    chosenDays = new Set(habit ? habit.days : []);
    paintDays();
    $('habitMsg').textContent = '';
    $('habitForm').hidden = false;
    $('habitAdd').hidden = true;
    renderHabitList();
    $('habitName').focus();
  }

  function closeForm() {
    $('habitForm').hidden = true;
    $('habitAdd').hidden = false;
    renderHabitList();
  }

  $('habitAdd').addEventListener('click', () => openForm(null));
  $('habitCancel').addEventListener('click', closeForm);
  $('daysAll').addEventListener('click', () => {
    chosenDays = new Set(WEEK_ORDER);
    paintDays();
  });
  $('habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const check = validateHabitInput({ name: $('habitName').value, days: [...chosenDays] });
    if (!check.ok) {
      $('habitMsg').textContent = check.error;
      return;
    }
    const existing = editingId ? hooks.getHabits().find((h) => h.id === editingId) : null;
    const habit = existing
      ? { ...existing, name: check.name, days: check.days }
      : newHabit({ name: check.name, days: check.days }, dateKey(new Date()), crypto.randomUUID());
    try {
      await saveHabit(habit);
      await hooks.onHabitsChanged();
      closeForm();
    } catch (err) {
      console.error(err);
      $('habitMsg').textContent = 'No se pudo guardar. Probá de nuevo.';
    }
  });
```

Y reemplazar la función `refreshAll` completa por:

```js
  function refreshAll() {
    refreshHours();
    refreshLastExport();
    refreshStorage();
    confirmingId = null;
    $('habitForm').hidden = true;
    $('habitAdd').hidden = false;
    renderHabitList();
    msg('');
  }
```

- [ ] **Step 4: `style.css` — estilos de la sección**

Agregar antes de la regla `.fatal {`:

```css
/* ---------- Hábitos en Ajustes ---------- */
.hlist { list-style: none; margin: 0 0 12px; padding: 0; }
.hitem { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-top: 1px solid var(--linea); }
.hinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hinfo strong { font-size: 15px; overflow-wrap: anywhere; }
.hactions { display: flex; gap: 6px; flex-shrink: 0; }
.btn.small { min-height: 40px; padding: 0 12px; font-size: 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.chips .chip { min-height: 40px; padding: 0 14px; font-size: 13px; color: var(--hueso); }
.hform { margin: 0 0 14px; padding: 14px; border: 1px solid var(--linea); background: var(--fila); }
.flabel { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--gris); }
.flabel input {
  min-height: 44px; padding: 0 10px; border-radius: 0; text-transform: none; letter-spacing: 0;
  font-family: var(--mono); font-size: 15px; color: var(--hueso); background: var(--fondo); border: 1px solid var(--linea);
}
.flabel input:focus { outline: 0; border-color: var(--bronce-apagado); }
.dayrow { display: flex; gap: 6px; margin-bottom: 10px; }
.daybtn {
  flex: 1; min-height: 44px; font-family: var(--titulo); font-size: 22px; letter-spacing: .04em;
  color: var(--gris); border: 1px solid var(--linea);
}
.daybtn[aria-pressed="true"] { color: var(--fondo); background: var(--bronce); border-color: var(--bronce); }
.textbtn { padding: 8px 0; margin-bottom: 8px; font-family: var(--titulo); font-size: 16px; letter-spacing: .14em; text-transform: uppercase; color: var(--bronce-apagado); }
.textbtn:active { color: var(--bronce); }
```

- [ ] **Step 5: Verificar en el navegador de la PC**

Servidor local + ventana de 360×440. Limpiar service worker y cachés (ver Task 2 Step 4, sin recrear la base). Abrir la app → AJUSTES:

1. La sección "Hábitos" muestra las 4 sugerencias. Tocar "Inglés": se abre el formulario con "Inglés" en el nombre y **ningún día** marcado.
2. Tocar Guardar sin días: aparece "Elegí al menos un día.". Tocar "Todos los días" → los 7 botones quedan bronce → Guardar. El hábito aparece en la lista con "Todos los días" y las sugerencias desaparecen.
3. "Nuevo hábito" → nombre "Ejercicio", días L, X, V → Guardar. Lista: "L X V".
4. "Editar" Ejercicio → cambiar a "L M X J V" → Guardar → la lista muestra "L M X J V".
5. "Archivar" Ejercicio → aparece "Sí, archivar / No" → "No" cancela; "Sí, archivar" lo saca de la lista.
6. Comprobar en la base: ejecutar `(await import('./js/db.js')).getAllHabits()` → el hábito archivado sigue guardado con `archivedAt` = fecha de hoy.

Expected: todos los puntos se cumplen y no hay errores en consola.

- [ ] **Step 6: Tests y commit**

Run: `node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"` → `fail 0`.

```bash
git add js/settings.js js/app.js css/style.css
git commit -m "Etapa 2A: gestion de habitos en Ajustes (alta, edicion, archivo)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Bloque "HÁBITOS" en la pantalla principal con marcas

**Files:**
- Create: `js/habits.js`
- Modify: `index.html`, `js/app.js`, `css/style.css`, `sw.js`

**Interfaces:**
- Consumes: `habitTocaEn`, `applyHabitMark` (logic.js); `state.habits`, `state.day.habits`.
- Produces: `renderHabits(container, { habits, marks, onMark })`, `refreshHabit(container, id, mark)` en `js/habits.js`. `onMark(habitId, 'done'|'failed')`.

- [ ] **Step 1: Crear `js/habits.js`**

```js
// Bloque "HÁBITOS" del día que se está viendo. Sin IndexedDB: avisa con callbacks.
import { ICONS } from './icons.js';

const MARKS = [
  { mark: 'done', label: 'Cumplido' },
  { mark: 'failed', label: 'No cumplido' },
];

function paint(row, mark) {
  row.querySelectorAll('.mark').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === mark)));
}

// opts: { habits (los que tocan hoy), marks: { [id]: 'done'|'failed' }, onMark(id, mark) }
export function renderHabits(container, { habits, marks, onMark }) {
  container.textContent = '';
  container.hidden = habits.length === 0; // si hoy no toca ninguno, el bloque no se muestra
  if (habits.length === 0) return;

  const title = document.createElement('h2');
  title.className = 'prios-title'; // mismo estilo de título que "Lo que hoy no se negocia"
  title.textContent = 'Hábitos';
  container.append(title);

  for (const h of habits) {
    const row = document.createElement('div');
    row.className = 'habit';
    row.dataset.id = h.id;

    const name = document.createElement('div');
    name.className = 'hname';
    name.textContent = h.name;

    const box = document.createElement('div');
    box.className = 'hmarks';
    for (const m of MARKS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mark';
      b.dataset.status = m.mark;
      b.setAttribute('aria-label', `${m.label}: ${h.name}`);
      b.innerHTML = ICONS[m.mark];
      b.addEventListener('click', () => onMark(h.id, m.mark));
      box.append(b);
    }

    row.append(name, box);
    container.append(row);
    paint(row, marks[h.id] ?? null);
  }
}

export function refreshHabit(container, id, mark) {
  const row = container.querySelector(`.habit[data-id="${CSS.escape(id)}"]`);
  if (row) paint(row, mark);
}
```

- [ ] **Step 2: `index.html` — contenedor**

Entre la línea `<section id="prios" ...></section>` y `<main id="agenda" ...>` agregar:

```html
  <section id="habits" class="habits" aria-label="Hábitos de hoy" hidden></section>
```

- [ ] **Step 3: `sw.js` — asset nuevo**

En `ASSETS`, después de `'./js/db.js',` agregar `'./js/habits.js',`.

- [ ] **Step 4: `app.js` — dibujar y marcar**

1. Cambiar el import de `./logic.js` agregando `habitTocaEn, applyHabitMark` al final de la lista:

```js
import {
  dateKey, addDays, formatDateLong, countSummary, formatSummary, applyStatus, applyReason,
  togglePriority, setPriorityText, normalizeDay, sanitizeHours, habitTocaEn, applyHabitMark,
} from './logic.js';
```

2. Agregar debajo de `import { renderPriorities, refreshPriority } from './priorities.js';`:

```js
import { renderHabits, refreshHabit } from './habits.js';
```

3. Debajo de `const priosEl = $('prios');` agregar `const habitsEl = $('habits');`.

4. Agregar (por ejemplo debajo de `onPriorityToggle`):

```js
// Solo los hábitos que "tocan" en la fecha que se está viendo.
function visibleHabits() {
  return state.habits.filter((h) => habitTocaEn(h, state.date));
}

function renderHabitBlock() {
  renderHabits(habitsEl, { habits: visibleHabits(), marks: state.day.habits, onMark: onHabitMark });
}

function onHabitMark(id, mark) {
  state.day.habits = applyHabitMark(state.day.habits, id, mark);
  refreshHabit(habitsEl, id, state.day.habits[id] ?? null);
  scheduleSave();
}
```

5. En `render(scroll)`, justo después del bloque `renderPriorities(priosEl, {...});` agregar `renderHabitBlock();`.

6. Reemplazar `onHabitsChanged` por:

```js
async function onHabitsChanged() {
  await loadHabitData();
  renderHabitBlock();
}
```

- [ ] **Step 5: `style.css` — bloque de hábitos**

Agregar antes de `/* ---------- Marcas de cumplimiento ---------- */`:

```css
/* ---------- Hábitos de hoy ---------- */
.habits { max-width: var(--ancho-max); margin: 0 auto; border-bottom: 1px solid var(--bronce-apagado); }
.habit {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center;
  min-height: 56px; padding-left: 16px; background: var(--fila); border-top: 1px solid var(--linea);
}
.habit:nth-of-type(even) { background: var(--fila-alt); }
.hname { padding: 12px 8px 12px 0; font-size: 15px; overflow-wrap: anywhere; }
.hmarks { display: flex; padding-right: 4px; }
```

- [ ] **Step 6: Verificar en el navegador de la PC**

Limpiar service worker y cachés, recargar dos veces. Con los hábitos creados en la Task 3 (crear uno "Inglés" todos los días y "Ejercicio" solo L X V):

1. En la pantalla principal aparece el bloque "HÁBITOS" entre prioridades y agenda, solo con los que tocan hoy (hoy es lunes: aparecen ambos; navegar a un martes con `#next`: solo "Inglés").
2. Tocar el tilde de "Inglés": queda bronce (`aria-pressed="true"`). Tocar la cruz: pasa a rojo y el tilde se apaga. Tocar la cruz otra vez: queda sin marca.
3. Recargar: las marcas siguen. Navegar a otro día y volver: siguen.
4. Un día donde no toca ningún hábito: el bloque no se ve (`#habits` con `hidden`).
5. Comprobar `(await import('./js/db.js')).getDay('YYYY-MM-DD')` (fecha de hoy) → tiene `habits: { <id>: 'done' }`.

Expected: todo se cumple sin errores de consola.

- [ ] **Step 7: Tests y commit**

Run: `node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"` → `fail 0` (incluye el test que verifica `ASSETS`).

```bash
git add js/habits.js index.html js/app.js css/style.css sw.js
git commit -m "Etapa 2A: bloque de habitos del dia con marcas cumplido / no cumplido" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Exportar e importar con hábitos

**Files:**
- Modify: `js/settings.js`

**Interfaces:**
- Consumes: `getAllHabits` (db.js), `buildExport` con `habits`, `validateImport().habitCount`, `hooks.onDataReplaced` (ya recarga los hábitos), `renderHabitList` (Task 3).

- [ ] **Step 1: Exportar incluye los hábitos**

En `doExport`, reemplazar las líneas:

```js
      const days = await getAllDays();
      const data = buildExport({ days, startHour: start, endHour: end, now });
```

por:

```js
      const days = await getAllDays();
      const habits = await getAllHabits();
      const data = buildExport({ days, habits, startHour: start, endHour: end, now });
```

- [ ] **Step 2: El cartel de importar cuenta los hábitos**

En el manejador de `#fileImport`, reemplazar la asignación de `$('importText').textContent = ...` por:

```js
    const habitos = check.habitCount
      ? ` y ${check.habitCount} ${check.habitCount === 1 ? 'hábito' : 'hábitos'}`
      : '';
    $('importText').textContent =
      `Este archivo tiene ${check.count} ${check.count === 1 ? 'día' : 'días'}${habitos} (${rango}). ` +
      'Importarlo REEMPLAZA todo lo que hay ahora en este celular.';
```

- [ ] **Step 3: Al importar, se refresca la lista de hábitos**

En el manejador de `#btnConfirmImport`, después de `refreshHours();` agregar `renderHabitList();`.

- [ ] **Step 4: Verificar el ciclo completo (navegador de la PC)**

Con 2 hábitos (uno archivado) y marcas en 2 días:

1. AJUSTES → capturar el archivo exportado (interceptar `URL.createObjectURL` y `HTMLAnchorElement.prototype.click`, como en la Etapa 1D) → `JSON.parse` → verificar `schemaVersion === 2`, `habits.length === 2` (incluye el archivado) y `days[..].habits` con las marcas.
2. Alterar: crear un hábito "BORRAR", marcar algo distinto.
3. Importar el archivo capturado → cartel dice "N días y 2 hábitos" → "Reemplazar todo" → la lista de hábitos vuelve a los 2 originales ("BORRAR" desaparece) y las marcas coinciden con el export.
4. **Compatibilidad**: importar un archivo v1 (sin campo `habits`, por ejemplo `{ app:'app-disciplina', schemaVersion:1, exportedAt:'2026-09-20T00:00:00.000Z', settings:{startHour:6,endHour:24}, days:[{date:'2026-09-20',slots:{'07':{text:'x',status:null,reason:null}},priorities:[]}] }`) → importa sin error, el día se ve, y no quedan hábitos.

Expected: los 4 puntos se cumplen.

- [ ] **Step 5: Commit**

```bash
git add js/settings.js
git commit -m "Etapa 2A: exportar e importar incluye habitos (v2, compatible con v1)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Publicar la Entrega 1 y prueba en el celu

**Files:**
- Modify: `sw.js` (`CACHE_VERSION`), `CLAUDE.md`

- [ ] **Step 1: Subir la versión de la caché**

En `sw.js` cambiar `'disciplina-v7'` por `'disciplina-v8'`.

- [ ] **Step 2: Actualizar el estado en `CLAUDE.md`**

En la sección "Estado actual", reemplazar la línea que empieza con `- Siguiente: planificar la Etapa 2` por:

```
- **Etapa 2A en curso.** Diseño: `docs/superpowers/specs/2026-09-21-habitos-con-racha-design.md`; plan: `docs/superpowers/plans/2026-09-21-habitos-con-racha.md`. Entrega 1 (hábitos y marcas) publicada como `disciplina-v8`; Entrega 2 (racha) pendiente. Base IndexedDB en versión 2 (store `habits`); export en `schemaVersion` 2.
```

Y cambiar `(hoy `disciplina-v7`)` por `(hoy `disciplina-v8`)`.

- [ ] **Step 3: Tests, commit, push y verificación de Pages**

```bash
node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"
git add sw.js CLAUDE.md
git commit -m "Etapa 2A entrega 1: habitos y marcas publicados (sw v8)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

Verificar que `https://ackerman-33.github.io/app-disciplina/sw.js` contiene `disciplina-v8` y que cada archivo de `ASSETS` responde 200 (mismo chequeo de la Etapa 1E).

- [ ] **Step 4: Prueba en el Android de Simon (checkpoint — no seguir hasta que confirme)**

Pedirle a Simon: cerrar la app del todo y abrirla **dos veces**; comprobar que **sus datos anteriores siguen** (agenda, prioridades, marcas); AJUSTES → crear "Inglés" (todos los días) y "Ejercicio" (L X V); ver el bloque HÁBITOS en la pantalla principal; marcar tilde/cruz; cerrar y reabrir; AJUSTES → Guardar archivo → Importar ese mismo archivo. Esperar su confirmación antes de la Entrega 2.

---

## ENTREGA 2 — Racha

### Task 7: Lógica de la racha

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.test.mjs`

**Interfaces:**
- Produces:
  - `currentStreak(habit, marks, asOfKey, todayKey): number` — `marks` es `{ 'YYYY-MM-DD': 'done'|'failed' }` de ese hábito.
  - `buildMarksIndex(days): { [habitId]: { [dateKey]: 'done'|'failed' } }`

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/logic.test.mjs` agregar `currentStreak, buildMarksIndex,` al final de la lista del import, y al final del archivo:

```js
// ---------- Etapa 2A: racha ----------
const TODAY = '2026-09-21'; // lunes
const d = (n) => addDays(TODAY, n); // d(-1) = ayer

test('currentStreak: días seguidos cumplidos; hoy sin marcar es neutro', () => {
  const marks = { [d(-3)]: 'done', [d(-2)]: 'done', [d(-1)]: 'done' };
  assert.equal(currentStreak(daily, marks, TODAY, TODAY), 3);
});

test('currentStreak: hoy cumplido suma uno', () => {
  const marks = { [d(-2)]: 'done', [d(-1)]: 'done', [TODAY]: 'done' };
  assert.equal(currentStreak(daily, marks, TODAY, TODAY), 3);
});

test('currentStreak: hoy marcado "no cumplido" corta', () => {
  const marks = { [d(-2)]: 'done', [d(-1)]: 'done', [TODAY]: 'failed' };
  assert.equal(currentStreak(daily, marks, TODAY, TODAY), 0);
});

test('currentStreak: un día pasado sin marcar corta', () => {
  const marks = { [d(-3)]: 'done', [d(-1)]: 'done' }; // falta anteayer
  assert.equal(currentStreak(daily, marks, TODAY, TODAY), 1);
  assert.equal(currentStreak(daily, { [d(-2)]: 'done' }, TODAY, TODAY), 0); // ayer sin marcar
});

test('currentStreak: los días que no tocan se saltean sin cortar', () => {
  const lmx = { ...daily, days: [1, 3, 5] }; // lunes, miércoles, viernes
  // lunes 21 (hoy), viernes 18, miércoles 16 cumplidos; lunes 14 sin marcar => corta ahí
  const marks = { '2026-09-21': 'done', '2026-09-18': 'done', '2026-09-16': 'done' };
  assert.equal(currentStreak(lmx, marks, TODAY, TODAY), 3);
});

test('currentStreak: no cuenta antes de la fecha de creación', () => {
  const nuevo = { ...daily, createdAt: '2026-09-19' };
  const marks = { '2026-09-19': 'done', '2026-09-20': 'done', '2026-09-21': 'done' };
  assert.equal(currentStreak(nuevo, marks, TODAY, TODAY), 3); // 09-18 y antes no existen
});

test('currentStreak: viendo un día pasado se calcula a esa fecha', () => {
  const marks = { '2026-09-17': 'done', '2026-09-18': 'done', '2026-09-19': 'done', '2026-09-20': 'failed' };
  assert.equal(currentStreak(daily, marks, '2026-09-19', TODAY), 3);
  assert.equal(currentStreak(daily, marks, '2026-09-20', TODAY), 0);
});

test('currentStreak: un día pasado sin marcar corta aunque sea el que se mira', () => {
  assert.equal(currentStreak(daily, {}, '2026-09-20', TODAY), 0);
});

test('currentStreak: una fecha futura se calcula a hoy', () => {
  const marks = { [d(-1)]: 'done' };
  assert.equal(currentStreak(daily, marks, '2026-09-30', TODAY), 1);
});

test('currentStreak: hábito archivado no cuenta desde el día de archivo', () => {
  const arch = { ...daily, archivedAt: '2026-09-20' };
  const marks = { '2026-09-17': 'done', '2026-09-18': 'done', '2026-09-19': 'done' };
  assert.equal(currentStreak(arch, marks, '2026-09-19', TODAY), 3);
});

test('buildMarksIndex arma marcas por hábito y fecha', () => {
  const days = [
    { date: '2026-09-20', habits: { h1: 'done', h2: 'failed' } },
    { date: '2026-09-21', habits: { h1: 'done' } },
    { date: '2026-09-19' }, // ficha vieja sin habits
  ];
  assert.deepEqual(buildMarksIndex(days), {
    h1: { '2026-09-20': 'done', '2026-09-21': 'done' },
    h2: { '2026-09-20': 'failed' },
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `node --test 2>&1 | grep -E "does not provide|ℹ (tests|pass|fail)"`
Expected: `does not provide an export named 'currentStreak'`.

- [ ] **Step 3: Implementar en `js/logic.js`**

Agregar al final del archivo:

```js
// Racha: se cuenta hacia atrás SOLO sobre los días que el hábito "toca".
//  - día que toca y cumplido: suma 1
//  - día que toca y "no cumplido", o pasado sin marcar: corta
//  - hoy sin marcar: neutro (el día no terminó)
// `marks` es { 'YYYY-MM-DD': 'done'|'failed' } de UN hábito.
export function currentStreak(habit, marks, asOfKey, todayKey) {
  let key = asOfKey > todayKey ? todayKey : asOfKey;
  let streak = 0;
  while (key >= habit.createdAt) {
    if (habitTocaEn(habit, key)) {
      const mark = marks[key];
      if (mark === 'done') streak++;
      else if (mark === undefined && key === todayKey) {
        // hoy sin marcar todavía: no suma ni corta
      } else break;
    }
    key = addDays(key, -1);
  }
  return streak;
}

// De las fichas de día a { [habitId]: { [fecha]: marca } }, para calcular rachas sin releer la base.
export function buildMarksIndex(days) {
  const index = {};
  for (const day of days) {
    for (const [id, mark] of Object.entries(day.habits || {})) {
      (index[id] ||= {})[day.date] = mark;
    }
  }
  return index;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `node --test 2>&1 | grep -E "✖|ℹ (tests|pass|fail)"`
Expected: `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.test.mjs
git commit -m "Etapa 2A: calculo de racha (currentStreak) y buildMarksIndex con tests" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Mostrar la racha en cada hábito

**Files:**
- Modify: `js/habits.js`, `js/app.js`, `css/style.css`

**Interfaces:**
- Consumes: `currentStreak`, `buildMarksIndex` (Task 7); `getAllDays` (db.js).
- Produces: `renderHabits(container, { habits, marks, streaks, onMark })` con `streaks: { [id]: number }`; `refreshHabit(container, id, mark, streak)`.

- [ ] **Step 1: `habits.js` — la racha en la fila**

En `renderHabits`, cambiar la firma a `{ habits, marks, streaks, onMark }` y reemplazar estas **tres líneas consecutivas** del final del bucle:

```js
    row.append(name, box);
    container.append(row);
    paint(row, marks[h.id] ?? null);
```

por estas (queda todo dentro del mismo bucle `for`):

```js
    const streak = document.createElement('div');
    streak.className = 'hstreak';

    row.append(name, streak, box);
    container.append(row);
    paint(row, marks[h.id] ?? null, streaks[h.id] ?? 0);
```

Reemplazar la función `paint` y `refreshHabit` por:

```js
function paint(row, mark, streak) {
  row.querySelectorAll('.mark').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === mark)));
  const el = row.querySelector('.hstreak');
  el.textContent = `Racha ${streak}`;
  el.classList.toggle('on', streak > 0);
}

export function refreshHabit(container, id, mark, streak) {
  const row = container.querySelector(`.habit[data-id="${CSS.escape(id)}"]`);
  if (row) paint(row, mark, streak);
}
```

- [ ] **Step 2: `style.css` — estilo de la racha**

Cambiar la regla `.habit { display: grid; grid-template-columns: minmax(0, 1fr) auto; ... }` para que use tres columnas: reemplazar `grid-template-columns: minmax(0, 1fr) auto;` por `grid-template-columns: minmax(0, 1fr) auto auto;` y agregar:

```css
.hstreak { padding-right: 8px; font-family: var(--titulo); font-size: 18px; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; color: var(--gris); }
.hstreak.on { color: var(--bronce); }
```

- [ ] **Step 3: `app.js` — índice de marcas y racha**

1. Cambiar el import de logic agregando `currentStreak, buildMarksIndex` al final; y el de db agregando `getAllDays`:

```js
import { getDay, saveDay, getSetting, setSetting, getAllHabits, getAllDays } from './db.js';
```

2. En `state` agregar debajo de `habits: [],`:

```js
  marks: {},        // { [habitId]: { [fecha]: 'done'|'failed' } } para calcular rachas
```

3. Reemplazar `loadHabitData` por:

```js
async function loadHabitData() {
  state.habits = await getAllHabits();
  state.marks = buildMarksIndex(await getAllDays());
}
```

4. Reemplazar `renderHabitBlock` y `onHabitMark` por:

```js
function streakOf(habit) {
  return currentStreak(habit, state.marks[habit.id] || {}, state.date, dateKey(new Date()));
}

function renderHabitBlock() {
  const habits = visibleHabits();
  const streaks = Object.fromEntries(habits.map((h) => [h.id, streakOf(h)]));
  renderHabits(habitsEl, { habits, marks: state.day.habits, streaks, onMark: onHabitMark });
}

function onHabitMark(id, mark) {
  state.day.habits = applyHabitMark(state.day.habits, id, mark);
  const current = state.day.habits[id] ?? null;
  // el índice de rachas se mantiene al día con cada marca
  const byDate = (state.marks[id] ||= {});
  if (current) byDate[state.date] = current;
  else delete byDate[state.date];
  const habit = state.habits.find((h) => h.id === id);
  refreshHabit(habitsEl, id, current, streakOf(habit));
  scheduleSave();
}
```

- [ ] **Step 4: Verificar en el navegador de la PC**

Limpiar service worker y cachés. Con hábito "Inglés" (todos los días, creado hoy):

1. Hoy sin marcar: `RACHA 0` en gris.
2. Marcar tilde: `RACHA 1` en bronce. Tocar tilde otra vez: vuelve a `RACHA 0`.
3. Marcar cruz: `RACHA 0`.
4. Para probar racha larga sin esperar días: crear datos por consola — guardar fichas de los 3 días anteriores con `habits: { <id>: 'done' }` y cambiar el `createdAt` del hábito a hace 5 días con `saveHabit`, recargar → hoy sin marcar muestra `RACHA 3`; marcar hoy → `RACHA 4`; ir al día anterior con `#prev` → `RACHA 3` (a esa fecha); ir a un día donde falte una marca → la racha se corta.
5. Un hábito L X V muestra solo los días que toca y no se corta en los días que no toca.

Expected: todos los valores coinciden con los tests de la Task 7. Sin errores de consola.

- [ ] **Step 5: Tests y commit**

Run: `node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"` → `fail 0`.

```bash
git add js/habits.js js/app.js css/style.css
git commit -m "Etapa 2A: racha visible en cada habito" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Cierre de la 2A — documentación, publicación y prueba en el celu

**Files:**
- Modify: `sw.js`, `CLAUDE.md`, `GUIA-RESPALDO.md`

- [ ] **Step 1: Subir la versión de la caché y actualizar documentos**

- `sw.js`: `'disciplina-v8'` → `'disciplina-v9'`.
- `CLAUDE.md`: en "Estado actual", reemplazar la línea de "Etapa 2A en curso" por: `- **Etapa 2A terminada** (hábitos con frecuencia propia, marcas y racha), publicada como `disciplina-v9`. Pendiente confirmar en el celu. Siguientes piezas de la Etapa 2: 2B (cierre nocturno de 2 minutos) y 2C (días tipo), cada una con su propio diseño y plan.` y cambiar `(hoy `disciplina-v8`)` por `(hoy `disciplina-v9`)`.
- `GUIA-RESPALDO.md`: en la sección 1, agregar debajo del paso 2: `   - El archivo incluye tus días, tus **hábitos** (también los archivados) y tus marcas.`

- [ ] **Step 2: Tests, commit, push y verificación de Pages**

```bash
node --test 2>&1 | grep -E "✖|ℹ (pass|fail)"
git add sw.js CLAUDE.md GUIA-RESPALDO.md
git commit -m "Etapa 2A completa: habitos con racha (sw v9)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

Verificar en `https://ackerman-33.github.io/app-disciplina/` que `sw.js` publica `disciplina-v9` y que los 19 archivos de `ASSETS` responden 200.

- [ ] **Step 3: Prueba en el Android de Simon (checkpoint)**

Pedirle a Simon: abrir la app dos veces para actualizar; comprobar `RACHA 0` en gris en un hábito nuevo; marcar el tilde y ver `RACHA 1` en bronce; recargar; ir al día anterior y volver; hacer un export e importarlo. Confirmar antes de pasar a 2B.

---

## Desviaciones respecto del plan (registradas durante la ejecución)

- **Orden de los hábitos:** al probar la Task 4 apareció que IndexedDB devuelve los hábitos ordenados por `id` (aleatorio). Se agregó `sortHabits(habits)` en `logic.js` (por `createdAt` y luego por nombre, con su test) y se usa en `loadHabitData` y en `buildExport`. Tests: 47.
- **Servidor de pruebas:** se agregó `dev-server.py` (fuera del repo) con `Cache-Control: no-store` porque el servidor simple de Python dejaba al navegador con archivos viejos.

## Self-review (hecha al terminar de escribir)

**Cobertura del spec** — modelo de datos (Task 1, 2), migración 1→2 con datos reales (Task 2 Step 4), marcas en la ficha del día y `normalizeDay`/`isDayEmpty` (Task 1, 4), export/import v1 y v2 con `importAll` atómico (Task 1, 2, 5), racha con todas las reglas (Task 7), bloque HÁBITOS que se oculta si no toca ninguno (Task 4), gestión en Ajustes con sugerencias, "Todos los días", validación, editar y archivar sin borrar (Task 3), marcar días pasados y racha a la fecha vista (Task 4, 7, 8), resumen de la agenda sin cambios (no se toca `countSummary`), dos entregas con prueba en el celu (Task 6, 9). Límites conocidos del spec: no hay tarea porque son "no hacer".

**Placeholders** — sin "TBD/TODO"; todos los pasos de código traen el código.

**Consistencia de tipos** — `renderHabits`/`refreshHabit` cambian de firma entre Task 4 y Task 8 y la Task 8 lo reescribe explícitamente; `validateImport` devuelve `habitCount` (Task 1) que consume Task 5; `hooks.getHabits`/`onHabitsChanged` se definen en Task 3 y `onHabitsChanged` se redefine en Task 4 (indicado); `currentStreak(habit, marks, asOfKey, todayKey)` idéntico en Task 7 y 8.
