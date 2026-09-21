// Lógica pura: sin DOM ni IndexedDB, así se puede testear con `node --test`.

export const SCHEMA_VERSION = 2;
export const APP_ID = 'app-disciplina';

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const pad2 = (n) => String(n).padStart(2, '0');

// Fecha LOCAL como "YYYY-MM-DD". Nunca toISOString(): usa UTC y a la noche daría el día siguiente.
export function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// El fin es exclusivo: hoursRange(6, 24) => 6..23 (la última fila es 23:00–24:00).
export function hoursRange(start, end) {
  const out = [];
  for (let h = start; h < end; h++) out.push(h);
  return out;
}

export const hourLabel = (h) => `${pad2(h)}:00`;

export function formatDateLong(key) {
  const d = parseKey(key);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function isDayEmpty(day) {
  if (!day) return true;
  const slots = Object.values(day.slots || {});
  if (slots.some((s) => (s.text || '').trim() !== '' || s.status)) return false;
  const prios = day.priorities || [];
  if (prios.some((p) => (p.text || '').trim() !== '' || p.done)) return false;
  if (Object.keys(day.habits || {}).length > 0) return false;
  return true;
}

// "Sin registrar" (con texto, sin marca) NO es fallo: va aparte, como pending.
export function countSummary(day, startHour, endHour) {
  const out = { done: 0, failed: 0, changed: 0, pending: 0 };
  if (!day || !day.slots) return out;
  for (const [key, slot] of Object.entries(day.slots)) {
    const h = parseInt(key, 10);
    if (h < startHour || h >= endHour) continue;
    if (slot.status === 'done') out.done++;
    else if (slot.status === 'failed') out.failed++;
    else if (slot.status === 'changed') out.changed++;
    else if ((slot.text || '').trim() !== '') out.pending++;
  }
  return out;
}

export const REASONS = [
  { id: 'impulso', label: 'Impulso' },
  { id: 'cansancio', label: 'Cansancio' },
  { id: 'imprevisto', label: 'Imprevisto' },
  { id: 'procrastine', label: 'Procrastiné' },
  { id: 'otro', label: 'Otro' },
];

// Devuelve el renglón nuevo (no modifica el original).
// Tocar la marca que ya estaba activa la apaga: vuelve a "sin registrar".
export function applyStatus(slot, status) {
  const cur = slot || { text: '', status: null, reason: null };
  return { ...cur, status: cur.status === status ? null : status, reason: null };
}

// El motivo solo tiene sentido si el renglón está "no cumplido". Tocar el mismo motivo lo quita.
export function applyReason(slot, reason) {
  if (!slot || slot.status !== 'failed') return slot;
  return { ...slot, reason: slot.reason === reason ? null : reason };
}

export const ROMAN = ['I', 'II', 'III'];

// Marcar hecha una prioridad vacía no tiene sentido: no hace nada.
export function togglePriority(p) {
  if ((p.text || '').trim() === '') return { ...p };
  return { ...p, done: !p.done };
}

// Si se borra todo el texto, la prioridad vuelve a "no hecha".
export function setPriorityText(p, text) {
  return { text, done: text.trim() === '' ? false : p.done };
}

// Completa lo que le falte a un día (por ejemplo, días guardados con menos de 3 prioridades).
export function normalizeDay(day) {
  const saved = Array.isArray(day.priorities) ? day.priorities : [];
  return {
    ...day,
    priorities: ROMAN.map((_, i) => ({ text: saved[i]?.text ?? '', done: saved[i]?.done ?? false })),
    slots: day.slots || {},
    habits: day.habits && typeof day.habits === 'object' ? { ...day.habits } : {},
  };
}

export function formatSummary({ done, failed, changed, pending }) {
  const base = `${done} cumplido · ${failed} caído · ${pending} sin marcar`;
  return changed > 0 ? `${base} · ${changed} cambió` : base;
}

// Inicio 0-23, fin 1-24 (exclusivo) y el fin siempre después del inicio.
// `changed` dice cuál de los dos acaba de tocar el usuario: ese se respeta y el otro se corre.
export function clampHours(start, end, changed = 'start') {
  let s = Math.min(23, Math.max(0, Math.round(start)));
  let e = Math.min(24, Math.max(1, Math.round(end)));
  if (e <= s) {
    if (changed === 'end') s = e - 1;
    else e = s + 1;
  }
  return { startHour: s, endHour: e };
}

// Para valores que vienen de afuera (archivo importado, base de datos): si algo no sirve, 6 a 24.
export function sanitizeHours(settings) {
  const ok = (n) => typeof n === 'number' && Number.isFinite(n);
  const s = ok(settings?.startHour) ? settings.startHour : 6;
  const e = ok(settings?.endHour) ? settings.endHour : 24;
  return clampHours(s, e, 'start');
}

// Orden estable para mostrar y exportar: por fecha de creación y, si empatan, por nombre.
export const sortHabits = (habits) =>
  [...habits].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, 'es'));

export function buildExport({ days, habits = [], startHour, endHour, now }) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    settings: { startHour, endHour },
    days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
    habits: sortHabits(habits),
  };
}

export const exportFileName = (now) => `disciplina-${dateKey(now)}.json`;

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

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
