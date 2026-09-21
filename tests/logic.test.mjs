import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, addDays, hoursRange, hourLabel, formatDateLong,
  isDayEmpty, countSummary, validateImport,
  applyStatus, applyReason, formatSummary, REASONS,
  togglePriority, setPriorityText, normalizeDay, ROMAN,
  clampHours, sanitizeHours, buildExport, exportFileName, formatBytes,
  WEEK_ORDER, WEEK_LETTERS, weekdayOf, habitTocaEn, validateHabitInput,
  newHabit, archiveHabit, applyHabitMark, formatDays, sortHabits, currentStreak, buildMarksIndex,
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
  assert.equal(out.schemaVersion, 2);
  assert.deepEqual(out.habits, []);
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

test('sortHabits: por fecha de creación y luego por nombre (sin mutar)', () => {
  const a = { id: 'z', name: 'Ejercicio', createdAt: '2026-09-21' };
  const b = { id: 'y', name: 'Inglés', createdAt: '2026-09-21' };
  const c = { id: 'x', name: 'Limpieza', createdAt: '2026-09-15' };
  const original = [b, a, c];
  assert.deepEqual(sortHabits(original).map((h) => h.name), ['Limpieza', 'Ejercicio', 'Inglés']);
  assert.deepEqual(original.map((h) => h.name), ['Inglés', 'Ejercicio', 'Limpieza']);
});

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
  // lunes 21 (hoy), viernes 18 y miércoles 16 cumplidos; lunes 14 sin marcar => corta ahí
  const marks = { '2026-09-21': 'done', '2026-09-18': 'done', '2026-09-16': 'done' };
  assert.equal(currentStreak(lmx, marks, TODAY, TODAY), 3);
});

test('currentStreak: no cuenta antes de la fecha de creación', () => {
  const nuevo = { ...daily, createdAt: '2026-09-19' };
  const marks = { '2026-09-19': 'done', '2026-09-20': 'done', '2026-09-21': 'done' };
  assert.equal(currentStreak(nuevo, marks, TODAY, TODAY), 3); // 09-18 y antes no existen para este hábito
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
