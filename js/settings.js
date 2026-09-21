// Pantalla de ajustes: horario, exportar/importar, estado del almacenamiento y ayuda.
import {
  clampHours, buildExport, exportFileName, validateImport, formatBytes, formatDateLong, dateKey,
} from './logic.js';
import { getAllDays, importAll, getSetting, setSetting } from './db.js';
import { ICONS } from './icons.js';

const TEMPLATE = `
<div class="sheet">
  <header class="sheet-top">
    <button type="button" class="backbtn" id="setBack"><span class="backicon"></span>VOLVER</button>
    <h1 class="sheet-title">Ajustes</h1>
  </header>

  <section class="block">
    <h2>Horario de la agenda</h2>
    <div class="fields">
      <label>Desde <select id="selStart"></select></label>
      <label>Hasta <select id="selEnd"></select></label>
    </div>
    <p class="note">Las horas que quedan fuera del rango no se borran: siguen guardadas, solo se ocultan.</p>
  </section>

  <section class="block">
    <h2>Tus datos</h2>
    <p class="note" id="lastExport"></p>
    <div class="btnrow">
      <button type="button" class="btn" id="btnExport">Guardar archivo</button>
      <button type="button" class="btn" id="btnShare" hidden>Compartir</button>
      <label class="btn" for="fileImport">Importar archivo</label>
      <input type="file" id="fileImport" hidden>
    </div>
    <div id="importPanel" class="panel" hidden>
      <p id="importText"></p>
      <div class="btnrow">
        <button type="button" class="btn danger" id="btnConfirmImport">Reemplazar todo</button>
        <button type="button" class="btn" id="btnCancelImport">Cancelar</button>
      </div>
    </div>
    <p class="msg" id="dataMsg" role="status"></p>
  </section>

  <section class="block">
    <h2>Almacenamiento</h2>
    <p id="persistInfo"></p>
    <p class="note" id="usageInfo"></p>
    <div class="btnrow"><button type="button" class="btn" id="btnPersist" hidden>Pedir de nuevo</button></div>
  </section>

  <section class="block help">
    <h2>Qué borra tus datos</h2>
    <p>Tus datos viven <strong>solo en este celular</strong>. No hay nube ni cuenta: nadie más tiene una copia. Se pierden si:</p>
    <ul>
      <li><strong>Borrás los datos de navegación o del sitio</strong> en Chrome (Ajustes de Chrome → Privacidad → Borrar datos) o los datos de la app en Ajustes del celular → Aplicaciones.</li>
      <li><strong>Desinstalás la app</strong> de la pantalla de inicio.</li>
      <li><strong>Cambiás de celular</strong>, lo restaurás de fábrica o cambiás de navegador: los datos no viajan solos.</li>
      <li>Usás la app en una <strong>ventana de incógnito</strong>: se borra al cerrarla.</li>
    </ul>
    <h2>Por qué el archivo es tu única copia</h2>
    <p>El botón <strong>Guardar archivo</strong> genera un <code>.json</code> con todo. Guardalo fuera del celular (Drive, mandátelo por WhatsApp, a tu mail). Hacelo seguido, por ejemplo una vez por semana: lo que no exportaste, no se puede recuperar.</p>
    <h2>Cómo recuperar tus datos</h2>
    <p>Instalá la app en el celular nuevo (o de nuevo en el actual), entrá a <strong>Ajustes → Importar archivo</strong> y elegí el <code>.json</code>. Vas a ver un resumen y una confirmación antes de reemplazar nada.</p>
  </section>
</div>`;

export function initSettings({ root, openBtn, hooks }) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  root.querySelector('.backicon').innerHTML = ICONS.prev;

  let pendingImport = null;

  // ----- abrir / cerrar (respeta el botón "atrás" del celular) -----
  function open() {
    root.hidden = false;
    document.body.classList.add('noscroll');
    root.scrollTop = 0;
    history.pushState({ settings: true }, '');
    refreshAll();
  }
  function close(fromPop = false) {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('noscroll');
    hidePanel();
    if (!fromPop && history.state?.settings) history.back();
  }
  openBtn.addEventListener('click', open);
  $('setBack').addEventListener('click', () => close(false));
  window.addEventListener('popstate', () => close(true));

  // ----- horario -----
  const selStart = $('selStart');
  const selEnd = $('selEnd');
  for (let h = 0; h <= 23; h++) selStart.add(new Option(`${String(h).padStart(2, '0')}:00`, h));
  for (let h = 1; h <= 24; h++) selEnd.add(new Option(`${String(h).padStart(2, '0')}:00`, h));

  function refreshHours() {
    const { start, end } = hooks.getHours();
    selStart.value = start;
    selEnd.value = end;
  }
  function onHoursInput(changed) {
    const { startHour, endHour } = clampHours(+selStart.value, +selEnd.value, changed);
    selStart.value = startHour;
    selEnd.value = endHour;
    hooks.onHoursChange(startHour, endHour);
  }
  selStart.addEventListener('change', () => onHoursInput('start'));
  selEnd.addEventListener('change', () => onHoursInput('end'));

  // ----- exportar -----
  const msg = (text, isError = false) => {
    const el = $('dataMsg');
    el.textContent = text;
    el.classList.toggle('error', isError);
  };

  async function refreshLastExport() {
    const iso = await getSetting('lastExport', null);
    $('lastExport').textContent = iso
      ? `Último archivo guardado: ${formatDateLong(dateKey(new Date(iso)))}.`
      : 'Todavía no guardaste ningún archivo. Sin él, tus datos existen solo en este celular.';
  }

  async function doExport(share) {
    try {
      await hooks.flush(); // que el archivo incluya lo último que escribiste
      const now = new Date();
      const { start, end } = hooks.getHours();
      const days = await getAllDays();
      const data = buildExport({ days, startHour: start, endHour: end, now });
      const name = exportFileName(now);
      const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });

      if (share) {
        try {
          await navigator.share({ files: [file], title: name });
        } catch (e) {
          if (e.name === 'AbortError') return; // cerró el menú de compartir: no es un error
          throw e;
        }
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      await setSetting('lastExport', now.toISOString());
      await refreshLastExport();
      msg(`Archivo generado: ${name} (${days.length} ${days.length === 1 ? 'día' : 'días'}). Guardalo fuera del celular.`);
    } catch (err) {
      console.error(err);
      msg('No se pudo generar el archivo. Probá de nuevo.', true);
    }
  }
  $('btnExport').addEventListener('click', () => doExport(false));
  $('btnShare').addEventListener('click', () => doExport(true));
  // "Compartir" solo aparece si este navegador puede compartir archivos.
  try {
    const probe = new File(['{}'], 'x.json', { type: 'application/json' });
    if (navigator.canShare?.({ files: [probe] })) $('btnShare').hidden = false;
  } catch { /* sin Web Share: queda solo "Guardar archivo" */ }

  // ----- importar -----
  function hidePanel() {
    pendingImport = null;
    $('importPanel').hidden = true;
  }

  $('fileImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite elegir el mismo archivo otra vez
    hidePanel();
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      msg('Ese archivo no se pudo leer: no es un .json válido.', true);
      return;
    }
    const check = validateImport(data);
    if (!check.ok) {
      msg(check.error, true);
      return;
    }
    pendingImport = data;
    msg('');
    const rango = check.count
      ? `del ${formatDateLong(check.first)} al ${formatDateLong(check.last)}`
      : 'sin ningún día con datos';
    $('importText').textContent =
      `Este archivo tiene ${check.count} ${check.count === 1 ? 'día' : 'días'} (${rango}). ` +
      'Importarlo REEMPLAZA todo lo que hay ahora en este celular.';
    $('importPanel').hidden = false;
  });

  $('btnCancelImport').addEventListener('click', () => {
    hidePanel();
    msg('Importación cancelada. No se tocó nada.');
  });

  $('btnConfirmImport').addEventListener('click', async () => {
    if (!pendingImport) return;
    const data = pendingImport;
    hidePanel();
    try {
      await hooks.flush();
      await importAll(data);
      await hooks.onDataReplaced();
      refreshHours();
      msg(`Listo: se importaron ${data.days.length} ${data.days.length === 1 ? 'día' : 'días'}.`);
    } catch (err) {
      console.error(err);
      msg('No se pudo importar. Tus datos actuales no se tocaron.', true);
    }
  });

  // ----- almacenamiento -----
  async function refreshStorage() {
    const info = $('persistInfo');
    const btn = $('btnPersist');
    btn.hidden = true;
    if (!navigator.storage?.persisted) {
      info.textContent = 'Este navegador no informa si el almacenamiento es persistente. Exportá seguido.';
      $('usageInfo').textContent = '';
      return;
    }
    const persisted = await navigator.storage.persisted();
    if (persisted) {
      info.textContent = 'Almacenamiento persistente: ACTIVO. Android no debería borrar tus datos si se queda sin espacio. Pero eso NO te protege si borrás los datos del navegador o desinstalás la app.';
    } else {
      info.textContent = 'Almacenamiento persistente: NO concedido. Chrome lo decide solo y suele darlo cuando la app está instalada y la usás seguido. Hasta entonces, Android podría borrar datos si le falta espacio: exportá seguido.';
      btn.hidden = false;
    }
    try {
      const { usage } = await navigator.storage.estimate();
      $('usageInfo').textContent = `Espacio que ocupan tus datos y la app: ${formatBytes(usage || 0)}.`;
    } catch {
      $('usageInfo').textContent = '';
    }
  }
  $('btnPersist').addEventListener('click', async () => {
    await navigator.storage.persist();
    await refreshStorage();
  });

  function refreshAll() {
    refreshHours();
    refreshLastExport();
    refreshStorage();
    msg('');
  }
}
