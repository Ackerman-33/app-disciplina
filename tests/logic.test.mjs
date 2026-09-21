import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, addDays, hoursRange, hourLabel, formatDateLong,
  isDayEmpty, countSummary, validateImport,
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
