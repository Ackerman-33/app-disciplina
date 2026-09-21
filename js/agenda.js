// Dibuja los renglones de la agenda. No sabe de IndexedDB: avisa cambios con callbacks.
import { hoursRange, hourLabel } from './logic.js';

const pad2 = (n) => String(n).padStart(2, '0');

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// opts: { day, startHour, endHour, onText(hour, text) }
export function renderAgenda(container, { day, startHour, endHour, onText }) {
  container.textContent = '';
  const frag = document.createDocumentFragment();

  for (const h of hoursRange(startHour, endHour)) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.hour = String(h);

    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.textContent = hourLabel(h);

    const ta = document.createElement('textarea');
    ta.className = 'slot';
    ta.rows = 1;
    ta.placeholder = '—';
    ta.setAttribute('aria-label', `Agenda de las ${hourLabel(h)}`);
    ta.value = day.slots[pad2(h)]?.text ?? '';
    ta.addEventListener('input', () => {
      autoGrow(ta);
      onText(h, ta.value);
    });

    row.append(hour, ta);
    frag.append(row);
  }
  container.append(frag);
  // La altura solo se puede medir con los renglones ya puestos en la página.
  container.querySelectorAll('.slot').forEach(autoGrow);
}

// Pone la barra bronce en la hora actual (o la saca si no estamos viendo HOY).
export function markNow(container, hourOrNull) {
  container.querySelectorAll('.row.now').forEach((r) => r.classList.remove('now'));
  if (hourOrNull === null) return null;
  const row = container.querySelector(`.row[data-hour="${hourOrNull}"]`);
  if (row) row.classList.add('now');
  return row;
}
