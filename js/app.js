// Director de orquesta: estado de la pantalla, carga/guardado del día, botones.
import {
  dateKey, addDays, formatDateLong, countSummary, formatSummary, applyStatus, applyReason,
  togglePriority, setPriorityText, normalizeDay, sanitizeHours, habitTocaEn, applyHabitMark,
  sortHabits,
} from './logic.js';
import { getDay, saveDay, getSetting, setSetting, getAllHabits } from './db.js';
import { renderAgenda, refreshRow, markNow } from './agenda.js';
import { renderPriorities, refreshPriority } from './priorities.js';
import { renderHabits, refreshHabit } from './habits.js';
import { initSettings } from './settings.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');
const agendaEl = $('agenda');
const priosEl = $('prios');
const habitsEl = $('habits');

const state = {
  date: null,       // día que se está viendo, "YYYY-MM-DD"
  day: null,        // datos de ese día
  startHour: 6,
  endHour: 24,
  habits: [],       // todos los hábitos (también los archivados)
  dirty: false,    // hay cambios sin guardar
  timer: null,      // temporizador del guardado diferido
  nav: 0,           // contador para descartar cargas de días que llegaron tarde
  lastToday: null,  // cuál era "hoy" en la última revisión (para detectar la medianoche)
};

// ---------- Guardado ----------
async function flush() {
  clearTimeout(state.timer);
  state.timer = null;
  if (!state.dirty) return;
  state.dirty = false;
  await saveDay(structuredClone(state.day));
}

function scheduleSave() {
  state.dirty = true;
  clearTimeout(state.timer);
  state.timer = setTimeout(flush, 400);
}

// Guarda el renglón nuevo en el día; si quedó sin texto y sin marca, lo saca (no dejamos fichas vacías).
function putSlot(hour, slot) {
  const key = pad2(hour);
  if (slot.text.trim() === '' && !slot.status) delete state.day.slots[key];
  else state.day.slots[key] = slot;
  updateSummary();
  scheduleSave();
}

function currentSlot(hour) {
  return state.day.slots[pad2(hour)];
}

function onText(hour, text) {
  putSlot(hour, { text: '', status: null, reason: null, ...currentSlot(hour), text });
}

function onStatus(hour, status) {
  putSlot(hour, applyStatus(currentSlot(hour), status));
  refreshRow(agendaEl, hour, currentSlot(hour));
}

function onReason(hour, reason) {
  const slot = currentSlot(hour);
  if (!slot) return;
  putSlot(hour, applyReason(slot, reason));
  refreshRow(agendaEl, hour, currentSlot(hour));
}

function onPriorityText(i, text) {
  state.day.priorities[i] = setPriorityText(state.day.priorities[i], text);
  refreshPriority(priosEl, i, state.day.priorities[i]);
  scheduleSave();
}

function onPriorityToggle(i) {
  state.day.priorities[i] = togglePriority(state.day.priorities[i]);
  refreshPriority(priosEl, i, state.day.priorities[i]);
  scheduleSave();
}

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

// Resumen en vivo: se recalcula solo con cada cambio, sin esperar al cierre del día.
function updateSummary() {
  const c = countSummary(state.day, state.startHour, state.endHour);
  const el = $('summary');
  const parts = [
    ['done', c.done, 'cumplido'],
    ['failed', c.failed, 'caído'],
    ['pending', c.pending, 'sin marcar'],
  ];
  if (c.changed > 0) parts.push(['changed', c.changed, 'cambió']);
  el.replaceChildren(
    ...parts.flatMap(([kind, n, label], i) => {
      const num = document.createElement('span');
      num.className = `n n-${kind}`;
      num.textContent = n;
      const nodes = [num, document.createTextNode(` ${label}`)];
      if (i < parts.length - 1) nodes.push(document.createTextNode(' · '));
      return nodes;
    }),
  );
  el.setAttribute('aria-label', formatSummary(c));
}

// ---------- Pantalla ----------
function updateNow(scroll) {
  const today = dateKey(new Date());
  if (state.date === today) {
    const row = markNow(agendaEl, new Date().getHours());
    if (scroll && row) row.scrollIntoView({ block: 'center' });
    else if (scroll) window.scrollTo(0, 0);
  } else {
    markNow(agendaEl, null);
    if (scroll) window.scrollTo(0, 0);
  }
}

function render(scroll) {
  const today = dateKey(new Date());
  $('dateLabel').textContent = formatDateLong(state.date);
  $('datePicker').value = state.date;
  $('today').setAttribute('aria-current', String(state.date === today));
  renderPriorities(priosEl, {
    priorities: state.day.priorities,
    onText: onPriorityText,
    onToggle: onPriorityToggle,
  });
  renderHabitBlock();
  renderAgenda(agendaEl, {
    day: state.day,
    startHour: state.startHour,
    endHour: state.endHour,
    onText,
    onStatus,
    onReason,
  });
  updateSummary();
  updateNow(scroll);
}

async function showDate(date, { scroll = true } = {}) {
  const mine = ++state.nav;
  await flush(); // primero guardo lo del día que dejo
  const day = normalizeDay((await getDay(date)) || { date });
  if (mine !== state.nav) return; // el usuario ya pidió otro día mientras cargaba
  state.date = date;
  state.day = day;
  render(scroll);
}

// Cada 30 s (y al volver a la app): mueve la barra de la hora y detecta que pasó la medianoche.
function tick() {
  const today = dateKey(new Date());
  if (today !== state.lastToday) {
    const wasViewingToday = state.date === state.lastToday;
    state.lastToday = today;
    if (wasViewingToday) return showDate(today);
    $('today').setAttribute('aria-current', String(state.date === today));
  }
  updateNow(false);
}

// ---------- Ajustes ----------
async function loadHours() {
  const { startHour, endHour } = sanitizeHours({
    startHour: await getSetting('startHour', 6),
    endHour: await getSetting('endHour', 24),
  });
  state.startHour = startHour;
  state.endHour = endHour;
}

async function onHoursChange(startHour, endHour) {
  state.startHour = startHour;
  state.endHour = endHour;
  render(false);
  await setSetting('startHour', startHour);
  await setSetting('endHour', endHour);
}

async function loadHabitData() {
  state.habits = sortHabits(await getAllHabits());
}

async function onHabitsChanged() {
  await loadHabitData();
  renderHabitBlock();
}

// Después de importar un archivo: se vuelve a leer todo desde la base de datos.
async function onDataReplaced() {
  await loadHours();
  await loadHabitData();
  await showDate(state.date, { scroll: false });
}

// Le pide al navegador que no borre los datos si el celular se queda sin espacio.
// Chrome decide solo (suele aceptar si la app está instalada): por eso se reintenta en cada apertura.
async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (err) {
    console.warn('No se pudo pedir almacenamiento persistente', err);
  }
}

// ---------- Arranque ----------
async function init() {
  $('prev').innerHTML = ICONS.prev;
  $('next').innerHTML = ICONS.next;

  try {
    await loadHours();
    await loadHabitData();
    state.lastToday = dateKey(new Date());
    await showDate(state.lastToday);
  } catch (err) {
    console.error(err);
    agendaEl.innerHTML = '<p class="fatal">No se pudo abrir el almacenamiento del navegador. Cerrá la app y volvé a abrirla; si sigue igual, no uses una ventana privada.</p>';
    return;
  }

  $('prev').addEventListener('click', () => showDate(addDays(state.date, -1)));
  $('next').addEventListener('click', () => showDate(addDays(state.date, 1)));
  $('today').addEventListener('click', () => showDate(dateKey(new Date())));
  $('datePicker').addEventListener('change', (e) => {
    if (e.target.value) showDate(e.target.value);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else tick();
  });
  window.addEventListener('pagehide', flush);
  setInterval(tick, 30000);

  initSettings({
    root: $('settings'),
    openBtn: $('openSettings'),
    hooks: {
      getHours: () => ({ start: state.startHour, end: state.endHour }),
      onHoursChange,
      getHabits: () => state.habits,
      onHabitsChanged,
      flush,
      onDataReplaced,
    },
  });
  requestPersistence();
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW no registrado', e));
  });
}
