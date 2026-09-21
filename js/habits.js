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
