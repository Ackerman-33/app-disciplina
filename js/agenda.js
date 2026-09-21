// Dibuja los renglones de la agenda. No sabe de IndexedDB: avisa cambios con callbacks.
import { hoursRange, hourLabel, REASONS } from './logic.js';
import { ICONS } from './icons.js';

const pad2 = (n) => String(n).padStart(2, '0');

const MARKS = [
  { status: 'done', label: 'Cumplido' },
  { status: 'failed', label: 'No cumplido' },
  { status: 'changed', label: 'Cambió' },
];

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// opts: { day, startHour, endHour, onText(hour, text), onStatus(hour, status), onReason(hour, reasonId) }
export function renderAgenda(container, { day, startHour, endHour, onText, onStatus, onReason }) {
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

    const marks = document.createElement('div');
    marks.className = 'marks';
    for (const m of MARKS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mark';
      b.dataset.status = m.status;
      b.setAttribute('aria-label', `${m.label}, ${hourLabel(h)}`);
      b.innerHTML = ICONS[m.status];
      b.addEventListener('click', () => onStatus(h, m.status));
      marks.append(b);
    }

    // Motivos: solo se ven cuando el renglón está "no cumplido".
    const reasons = document.createElement('div');
    reasons.className = 'reasons';
    reasons.hidden = true;
    for (const r of REASONS) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.dataset.reason = r.id;
      c.textContent = r.label;
      c.addEventListener('click', () => onReason(h, r.id));
      reasons.append(c);
    }

    row.append(hour, ta, marks, reasons);
    frag.append(row);
    paintRow(row, day.slots[pad2(h)]);
  }
  container.append(frag);
  // La altura solo se puede medir con los renglones ya puestos en la página.
  container.querySelectorAll('.slot').forEach(autoGrow);
}

// Refleja en pantalla el estado de un renglón (qué marca está activa, si se ven los motivos).
function paintRow(row, slot) {
  const status = slot?.status ?? null;
  row.dataset.status = status ?? '';
  row.querySelectorAll('.mark').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === status)));
  const reasons = row.querySelector('.reasons');
  reasons.hidden = status !== 'failed';
  reasons.querySelectorAll('.chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(slot?.reason === c.dataset.reason)),
  );
}

export function refreshRow(container, hour, slot) {
  const row = container.querySelector(`.row[data-hour="${hour}"]`);
  if (row) paintRow(row, slot);
}

// Pone la barra bronce en la hora actual (o la saca si no estamos viendo HOY).
export function markNow(container, hourOrNull) {
  container.querySelectorAll('.row.now').forEach((r) => r.classList.remove('now'));
  if (hourOrNull === null) return null;
  const row = container.querySelector(`.row[data-hour="${hourOrNull}"]`);
  if (row) row.classList.add('now');
  return row;
}
