import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, addDays, hoursRange, hourLabel, formatDateLong,
  isDayEmpty, countSummary, validateImport,
  applyStatus, applyReason, formatSummary, REASONS,
  togglePriority, setPriorityText, normalizeDay, ROMAN,
  clampHours, sanitizeHours, buildExport, exportFileName, formatBytes,
} from '../js/logic.js';

test('dateKey usa la fecha LOCAL, no UTC', () => {
  // 22:30 hora local del 20 de septiembre: con toISOString en Argentina daría el 21.
  assert.equal(dateKey(new Date(2026, 8, 20, 22, 30)), '2026-09-20');
  assert.equal(dateKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('addDays cruza fin de mes y de año', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('hoursRange: fin exclusivo (6 a 24 => 6..23)', () => {
  const h = hoursRange(6, 24);
  assert.equal(h.length, 18);
  assert.equal(h[0], 6);
  assert.equal(h[h.length - 1], 23);
  assert.deepEqual(hoursRange(7, 9), [7, 8]);
  assert.deepEqual(hoursRange(9, 9), []);
});

test('hourLabel', () => {
  assert.equal(hourLabel(6), '06:00');
  assert.equal(hourLabel(23), '23:00');
});

test('formatDateLong en español', () => {
  assert.equal(formatDateLong('2026-09-20'), 'DOM 20 SEP 2026');
  assert.equal(formatDateLong('2026-09-21'), 'LUN 21 SEP 2026');
});

test('isDayEmpty', () => {
  assert.equal(isDayEmpty(null), true);
  assert.equal(isDayEmpty({ date: 'x', slots: {}, priorities: [{ text: '', done: false }] }), true);
  assert.equal(isDayEmpty({ date: 'x', slots: { '07': { text: 'inglés', status: null, reason: null } } }), false);
  assert.equal(isDayEmpty({ date: 'x', slots: { '07': { text: '  ', status: null, reason: null } } }), true);
  assert.equal(isDayEmpty({ date: 'x', slots: {}, priorities: [{ text: 'algo', done: false }] }), false);
  assert.equal(isDayEmpty({ date: 'x', slots: { '07': { text: '', status: 'done', reason: null } } }), false);
});

test('countSummary: "sin registrar" con texto no es caído', () => {
  const day = {
    date: '2026-09-20',
    slots: {
      '06': { text: 'despertar', status: 'done', reason: null },
      '07': { text: 'inglés', status: 'failed', reason: 'impulso' },
      '08': { text: 'llevar hijos', status: 'changed', reason: null },
      '09': { text: 'limpiar', status: null, reason: null },
      '10': { text: '', status: null, reason: null },
    },
  };
  assert.deepEqual(countSummary(day, 6, 24), { done: 1, failed: 1, changed: 1, pending: 1 });
});

test('countSummary ignora horas fuera del rango visible', () => {
  const day = { date: 'x', slots: { '05': { text: 'madrugada', status: 'done', reason: null }, '07': { text: 'a', status: null, reason: null } } };
  assert.deepEqual(countSummary(day, 6, 24), { done: 0, failed: 0, changed: 0, pending: 1 });
});

test('countSummary con día vacío o nulo', () => {
  assert.deepEqual(countSummary(null, 6, 24), { done: 0, failed: 0, changed: 0, pending: 0 });
});

test('validateImport acepta un export válido y resume', () => {
  const data = {
    app: 'app-disciplina', schemaVersion: 1, exportedAt: '2026-09-20T22:00:00.000Z',
    settings: { startHour: 6, endHour: 24 },
    days: [{ date: '2026-09-18', slots: {}, priorities: [] }, { date: '2026-09-20', slots: {}, priorities: [] }],
  };
  const r = validateImport(data);
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.first, '2026-09-18');
  assert.equal(r.last, '2026-09-20');
});

test('validateImport rechaza basura', () => {
  assert.equal(validateImport(null).ok, false);
  assert.equal(validateImport({}).ok, false);
  assert.equal(validateImport({ app: 'otra-app', schemaVersion: 1, days: [] }).ok, false);
  assert.equal(validateImport({ app: 'app-disciplina', schemaVersion: 99, days: [] }).ok, false);
  assert.equal(validateImport({ app: 'app-disciplina', schemaVersion: 1, days: [{ date: 'mal' }] }).ok, false);
  assert.equal(validateImport({ app: 'app-disciplina', schemaVersion: 1, days: 'no' }).ok, false);
});

// ---------- Etapa 1B: marcas ----------
test('applyStatus: un toque marca, el mismo toque desmarca', () => {
  const s0 = { text: 'inglés', status: null, reason: null };
  const s1 = applyStatus(s0, 'done');
  assert.equal(s1.status, 'done');
  assert.equal(s1.text, 'inglés');
  assert.equal(applyStatus(s1, 'done').status, null);
});

test('applyStatus funciona sobre un renglón que todavía no existe', () => {
  const s = applyStatus(undefined, 'failed');
  assert.deepEqual(s, { text: '', status: 'failed', reason: null });
});

test('applyStatus: al cambiar de marca se borra el motivo', () => {
  const failed = { text: 'x', status: 'failed', reason: 'impulso' };
  const s = applyStatus(failed, 'changed');
  assert.equal(s.status, 'changed');
  assert.equal(s.reason, null);
});

test('applyStatus no modifica el objeto original', () => {
  const s0 = { text: 'a', status: null, reason: null };
  applyStatus(s0, 'done');
  assert.equal(s0.status, null);
});

test('applyReason: solo con "no cumplido"; tocar el mismo motivo lo quita', () => {
  const failed = { text: 'x', status: 'failed', reason: null };
  const r1 = applyReason(failed, 'cansancio');
  assert.equal(r1.reason, 'cansancio');
  assert.equal(applyReason(r1, 'cansancio').reason, null);
  assert.equal(applyReason(r1, 'impulso').reason, 'impulso');
  const done = { text: 'x', status: 'done', reason: null };
  assert.equal(applyReason(done, 'impulso').reason, null);
});

test('REASONS trae los 5 motivos definidos', () => {
  assert.deepEqual(REASONS.map((r) => r.id), ['impulso', 'cansancio', 'imprevisto', 'procrastine', 'otro']);
});

test('formatSummary: "cambió" aparece solo si es mayor que 0', () => {
  assert.equal(
    formatSummary({ done: 3, failed: 1, changed: 0, pending: 2 }),
    '3 cumplido · 1 caído · 2 sin marcar',
  );
  assert.equal(
    formatSummary({ done: 3, failed: 1, changed: 2, pending: 0 }),
    '3 cumplido · 1 caído · 0 sin marcar · 2 cambió',
  );
});

// ---------- Etapa 1C: prioridades ----------
test('ROMAN: numeración I, II, III', () => {
  assert.deepEqual(ROMAN, ['I', 'II', 'III']);
});

test('togglePriority alterna hecho / no hecho', () => {
  const p = { text: 'Inglés', done: false };
  const p1 = togglePriority(p);
  assert.equal(p1.done, true);
  assert.equal(togglePriority(p1).done, false);
  assert.equal(p.done, false); // no muta el original
});

test('togglePriority no marca hecha una prioridad vacía', () => {
  assert.equal(togglePriority({ text: '', done: false }).done, false);
  assert.equal(togglePriority({ text: '   ', done: false }).done, false);
});

test('setPriorityText: si borro todo el texto, se des-marca', () => {
  assert.deepEqual(setPriorityText({ text: 'algo', done: true }, ''), { text: '', done: false });
  assert.deepEqual(setPriorityText({ text: 'algo', done: true }, 'otra cosa'), { text: 'otra cosa', done: true });
});

test('normalizeDay completa prioridades y renglones que falten', () => {
  const d = normalizeDay({ date: '2026-09-21', slots: { '07': { text: 'a', status: null, reason: null } } });
  assert.equal(d.priorities.length, 3);
  assert.deepEqual(d.priorities[0], { text: '', done: false });
  assert.equal(d.slots['07'].text, 'a');
  const d2 = normalizeDay({ date: 'x', priorities: [{ text: 'solo una', done: true }] });
  assert.equal(d2.priorities.length, 3);
  assert.deepEqual(d2.priorities[0], { text: 'solo una', done: true });
  assert.deepEqual(d2.slots, {});
});

// ---------- Etapa 1D: horario, export, formatos ----------
test('clampHours acota a 0-23 / 1-24', () => {
  assert.deepEqual(clampHours(-3, 30, 'start'), { startHour: 0, endHour: 24 });
  assert.deepEqual(clampHours(6, 24, 'start'), { startHour: 6, endHour: 24 });
});

test('clampHours: el fin siempre queda después del inicio', () => {
  // muevo el inicio por encima del fin => el fin se corre
  assert.deepEqual(clampHours(20, 18, 'start'), { startHour: 20, endHour: 21 });
  assert.deepEqual(clampHours(23, 18, 'start'), { startHour: 23, endHour: 24 });
  // muevo el fin por debajo del inicio => el inicio se corre
  assert.deepEqual(clampHours(10, 8, 'end'), { startHour: 7, endHour: 8 });
  assert.deepEqual(clampHours(10, 1, 'end'), { startHour: 0, endHour: 1 });
});

test('sanitizeHours usa 6-24 si vienen valores inválidos', () => {
  assert.deepEqual(sanitizeHours(undefined), { startHour: 6, endHour: 24 });
  assert.deepEqual(sanitizeHours({ startHour: 'x', endHour: null }), { startHour: 6, endHour: 24 });
  assert.deepEqual(sanitizeHours({ startHour: 5, endHour: 23 }), { startHour: 5, endHour: 23 });
  assert.deepEqual(sanitizeHours({ startHour: 12, endHour: 3 }), { startHour: 12, endHour: 13 });
});

test('buildExport arma el archivo con días ordenados por fecha', () => {
  const now = new Date('2026-09-21T10:00:00.000Z');
  const out = buildExport({
    days: [{ date: '2026-09-20', slots: {}, priorities: [] }, { date: '2026-09-18', slots: {}, priorities: [] }],
    startHour: 6, endHour: 24, now,
  });
  assert.equal(out.app, 'app-disciplina');
  assert.equal(out.schemaVersion, 1);
  assert.equal(out.exportedAt, '2026-09-21T10:00:00.000Z');
  assert.deepEqual(out.settings, { startHour: 6, endHour: 24 });
  assert.deepEqual(out.days.map((d) => d.date), ['2026-09-18', '2026-09-20']);
  // el archivo generado tiene que ser aceptado por nuestro propio validador
  assert.equal(validateImport(out).ok, true);
});

test('exportFileName usa la fecha local', () => {
  assert.equal(exportFileName(new Date(2026, 8, 21, 23, 50)), 'disciplina-2026-09-21.json');
});

test('formatBytes', () => {
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(1536), '1,5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5,0 MB');
});
