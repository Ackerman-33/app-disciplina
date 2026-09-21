// Lógica pura: sin DOM ni IndexedDB, así se puede testear con `node --test`.

export const SCHEMA_VERSION = 1;
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

export function formatSummary({ done, failed, changed, pending }) {
  const base = `${done} cumplido · ${failed} caído · ${pending} sin marcar`;
  return changed > 0 ? `${base} · ${changed} cambió` : base;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const dates = data.days.map((d) => d.date).sort();
  return { ok: true, count: dates.length, first: dates[0] || null, last: dates[dates.length - 1] || null };
}
