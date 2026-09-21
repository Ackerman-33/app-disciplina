# Etapa 2A — Hábitos diarios con racha (diseño)

Fecha: 2026-09-21 · Estado: pendiente de revisión de Simon

## Contexto
La Etapa 1 (agenda, cumplimiento, prioridades, export/import) está terminada y confirmada en el Android de Simon. La Etapa 2 original tiene tres piezas independientes; se construyen en orden, cada una con su diseño y su prueba en el celu:

1. **2A — Hábitos con racha** (este documento)
2. 2B — Cierre nocturno de 2 minutos (se apoya en 2A: repasa los hábitos del día)
3. 2C — Días tipo (plantillas de agenda)

Hábitos que Simon quiere construir: inglés 15-20 min por día, ejercicio (hoy no hace), alimentación ordenada, limpieza de la casa repartida en días cortos.

## Decisiones ya tomadas con Simon
- **Cada hábito tiene su propia frecuencia**: días de la semana en que "toca".
- **Un día pasado que tocaba y quedó sin marcar rompe la racha** (criterio estricto). Hoy sin marcar todavía no rompe nada.

## Modelo de datos
Base IndexedDB `disciplina`: **versión 1 → 2**.

### Store nuevo `habits` (`keyPath: "id"`)
```
{ id, name, days: [0..6], createdAt: "YYYY-MM-DD", archivedAt: null | "YYYY-MM-DD" }
```
- `days`: días de la semana en que toca, con la convención de `Date.getDay()` (0 = domingo … 6 = sábado). Al menos 1 día. Sin repetidos.
- `name`: texto recortado (trim), 1 a 40 caracteres.
- `id`: `crypto.randomUUID()`.
- Un hábito **nunca se borra**: se archiva (`archivedAt` = día en que se archivó). Así el historial y las rachas pasadas no cambian.
- Un hábito **toca** en una fecha `d` si: `d >= createdAt`, (`archivedAt` es `null` o `d < archivedAt`) y el día de la semana de `d` está en `days`.

### Marcas por día
La ficha del día (`days`) suma un campo: `habits: { [habitId]: "done" | "failed" }`. Ausente = sin registrar. `normalizeDay` lo completa con `{}` en fichas viejas. `isDayEmpty` cuenta una marca de hábito como contenido.

### Migración 1 → 2
`onupgradeneeded` crea el store `habits` si `oldVersion < 2`. Los stores `days` y `settings` no se tocan: ningún dato existente cambia.

### Export / import
- Export pasa a `schemaVersion: 2` y agrega `habits: [...]` (todos, incluidos archivados).
- `validateImport` acepta `schemaVersion` 1 o 2. En la 1 no hay `habits` (se importa como lista vacía). En la 2 exige `habits` como arreglo con `id`, `name`, `days` y `createdAt` válidos. Rechaza versiones mayores a 2.
- `importAll` reemplaza también el store `habits` (misma transacción única "todo o nada").

## Racha (lógica pura en `logic.js`, con tests)
```
habitTocaEn(habit, dateKey) -> boolean
currentStreak(habit, marksByDate, asOfKey, todayKey) -> number
```
`marksByDate`: `{ "YYYY-MM-DD": "done" | "failed" }` para ese hábito. `asOfKey`: día que se está viendo, acotado a `todayKey` (para fechas futuras se usa hoy).

Algoritmo: se recorre desde `asOf` hacia atrás, mirando **solo los días que tocan**, hasta `createdAt`:
- Día que toca y `done` → suma 1 y sigue.
- Día que toca y `failed` → corta.
- Día que toca y sin marca:
  - si es `asOf` y además es hoy → **neutro** (no suma ni corta; el día no terminó),
  - en cualquier otro caso → corta.
- Día que no toca → se saltea.

## Interfaz
- **Bloque "HÁBITOS"** entre las prioridades y la agenda (`#habits`). Muestra solo los hábitos que tocan en la fecha que se ve. Cada fila: nombre, racha en texto seco (`RACHA 12`, Bebas) y dos marcas (tilde y cruz, los mismos SVG). Tocar la marca activa la apaga (vuelve a sin registrar), igual que en la agenda. Si no toca ningún hábito ese día, el bloque se oculta.
- **AJUSTES → Hábitos** (sección nueva en `settings.js`): lista de hábitos activos con editar y archivar; formulario de alta con nombre y 7 botones L M X J V S D (más un atajo "Todos los días"); no permite guardar sin nombre o sin ningún día. Con lista vacía muestra sugerencias de un toque (Inglés, Ejercicio, Alimentación, Limpieza) que precargan el nombre.
- Se puede marcar hábitos en días pasados (igual que la agenda). La racha se muestra "a la fecha que se está viendo".
- El resumen en vivo de la agenda no cambia (sigue contando solo renglones de agenda).

## Límites conocidos (a propósito, YAGNI)
- Editar los días de un hábito reinterpreta también el pasado (la racha se recalcula al vuelo, no se guarda historial de configuraciones).
- No hay "reactivar" un hábito archivado: se crea uno nuevo.
- No hay mejor racha histórica, metas semanales ni avisos.

## Archivos
- Modificar: `js/logic.js` (habitTocaEn, currentStreak, validaciones, normalizeDay, isDayEmpty, buildExport v2), `js/db.js` (versión 2, CRUD de hábitos, importAll), `js/app.js`, `js/settings.js`, `index.html`, `css/style.css`, `sw.js` (nuevo asset + `CACHE_VERSION`), `CLAUDE.md`.
- Crear: `js/habits.js` (dibuja el bloque de hoy).
- Tests: `tests/logic.test.mjs` (racha, toca, validación v1/v2, normalizeDay, isDayEmpty, buildExport).

## Construcción en dos pasos (cada uno se publica y se prueba en el celu)
1. **Hábitos y marcas** (sin racha): migración de la base, alta/edición/archivo en Ajustes, bloque "HÁBITOS" y export/import v2.
2. **Racha**: `currentStreak` (con sus tests) y mostrarla en cada fila.

## Verificación
- `node --test` (rachas: diario seguido; días salteados que no tocan; día pasado sin marcar corta; hoy sin marcar neutro; hoy `failed` corta; frontera `createdAt`; hábito archivado; validación import v1 y v2).
- Navegador de la PC: crear hábitos, marcar, recargar, ciclo exportar → alterar → importar, abrir con datos v1 existentes y comprobar que no se pierde nada tras la migración.
- Celu: instalar la versión nueva sobre la vieja (¡con datos!) y comprobar que la agenda, prioridades y marcas anteriores siguen intactas.
