// Director de orquesta: estado de la pantalla, carga/guardado del día, botones.
import {
  dateKey, addDays, formatDateLong, countSummary, formatSummary, applyStatus, applyReason,
} from './logic.js';
import { getDay, saveDay, getSetting } from './db.js';
import { renderAgenda, refreshRow, markNow } from './agenda.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');
const agendaEl = $('agenda');

const state = {
  date: null,       // día que se está viendo, "YYYY-MM-DD"
  day: null,        // datos de ese día
  startHour: 6,
  endHour: 24,
  dirty: false,     // hay cambios sin guardar
  timer: null,      // temporizador del guardado diferido
  nav: 0,           // contador para descartar cargas de días que llegaron tarde
  lastToday: null,  // cuál era "hoy" en la última revisión (para detectar la medianoche)
};

const emptyDay = (date) => ({
  date,
  priorities: [0, 1, 2].map(() => ({ text: '', done: false })),
  slots: {},
});

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
  const day = (await getDay(date)) || emptyDay(date);
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

// ---------- Arranque ----------
async function init() {
  $('prev').innerHTML = ICONS.prev;
  $('next').innerHTML = ICONS.next;

  try {
    state.startHour = await getSetting('startHour', 6);
    state.endHour = await getSetting('endHour', 24);
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
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW no registrado', e));
  });
}
