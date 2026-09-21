// "Lo que hoy no se negocia": 3 prioridades numeradas en romano. Sin IndexedDB: avisa con callbacks.
import { ROMAN } from './logic.js';
import { ICONS } from './icons.js';

// Un <canvas> invisible sabe cuánto mide una frase con cierta tipografía: lo usamos para
// que el tachado tenga exactamente el ancho del texto.
let ctx = null;
function textWidth(input) {
  ctx ||= document.createElement('canvas').getContext('2d');
  const cs = getComputedStyle(input);
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(input.value).width;
}

// Lee el estado desde el DOM, así sirve tanto al dibujar como cuando terminan de cargar las fuentes.
function paintStrike(row) {
  const input = row.querySelector('.pinput');
  const strike = row.querySelector('.pstrike');
  const max = input.clientWidth - 8 - 4; // menos el padding izquierdo y derecho del campo
  strike.style.width = `${Math.max(0, Math.min(textWidth(input), max))}px`;
}

function paint(row, p) {
  row.classList.toggle('done', p.done);
  row.querySelector('.pbox').setAttribute('aria-pressed', String(p.done));
  paintStrike(row);
}

// opts: { priorities, onText(i, text), onToggle(i) }
export function renderPriorities(container, { priorities, onText, onToggle }) {
  container.textContent = '';

  const title = document.createElement('h2');
  title.className = 'prios-title';
  title.textContent = 'Lo que hoy no se negocia';
  container.append(title);

  const rows = ROMAN.map((numeral, i) => {
    const row = document.createElement('div');
    row.className = 'prio';
    row.dataset.i = String(i);

    const roman = document.createElement('div');
    roman.className = 'roman';
    roman.textContent = numeral;

    const wrap = document.createElement('div');
    wrap.className = 'ptext';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pinput';
    input.maxLength = 90;
    input.placeholder = '—';
    input.setAttribute('aria-label', `Prioridad ${numeral}`);
    input.value = priorities[i].text;
    input.addEventListener('input', () => onText(i, input.value));
    const strike = document.createElement('span');
    strike.className = 'pstrike';
    wrap.append(input, strike);

    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'pbox';
    box.setAttribute('aria-label', `Marcar hecha la prioridad ${numeral}`);
    box.innerHTML = ICONS.done;
    box.addEventListener('click', () => onToggle(i));

    row.append(roman, wrap, box);
    container.append(row);
    return row;
  });

  // Recién con las filas puestas en la página se puede medir el ancho real.
  rows.forEach((row, i) => paint(row, priorities[i]));
  // Si las fuentes terminan de cargar después, el texto cambia de ancho: se vuelve a medir.
  document.fonts?.ready.then(() => rows.forEach(paintStrike));
}

export function refreshPriority(container, i, p) {
  const row = container.querySelector(`.prio[data-i="${i}"]`);
  if (!row) return;
  const input = row.querySelector('.pinput');
  if (input.value !== p.text) input.value = p.text; // por si la lógica cambió el texto
  paint(row, p);
}
