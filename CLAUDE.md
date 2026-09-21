# App de disciplina personal — contexto del proyecto

## Rol y forma de trabajar
- Claude es el ingeniero de software personal de Simon. **Simon no tiene experiencia programando**: Claude escribe TODO el código y lo guía paso a paso, en **español rioplatense**, con comandos exactos para copiar y pegar.
- Cada término técnico nuevo se explica en una línea la primera vez que aparece.
- Se trabaja por etapas chicas. No se pasa a la siguiente hasta que la anterior corra en el celu de Simon y él lo confirme.
- En cada paso: comandos exactos uno por uno, cómo probarlo en el celu (cómo se abre, qué debería ver) y qué hacer si algo falla. Nunca decir "configurá esto" sin decir exactamente qué tocar.
- Las preferencias de enseñanza generales de Simon están en su `~/.claude/CLAUDE.md` (explicar qué/por qué, glosario, pasos chicos, revisar antes de entregar).

## Objetivo
App de disciplina personal, **solo para Simon, en su celular Android**. Debe empujarlo a ser obsesivo con sus metas. Nada de estética infantil ni gamificación de juego (sin estrellitas, confetti ni insignias).

## Reglas duras
- 100 % local: sin cuentas, sin login, sin servidor, sin base de datos en la nube.
- Funciona sin internet una vez instalada.
- Simple antes que completa. Si algo complica mucho, no va.
- Sin publicidad, sin gamificación infantil.
- Celular Android confirmado. Cuenta de GitHub existente; `gh` (CLI) NO está instalado en la PC: se crea el repo desde la web y se sube con `git push`.

## Stack (confirmado, no volver a preguntar)
- PWA instalable, HTML/CSS/JS simple (módulos ES nativos), **sin frameworks ni build**.
- Datos en IndexedDB, guardados por fecha.
- `manifest.json` + service worker (offline + instalable en pantalla de inicio de Android).
- Hosting: GitHub Pages (repo público), solo el código. Los datos nunca salen del celular.
- Proyecto en `PROYECTO SIMON/app-disciplina`. Se publica en Pages desde la sub-etapa 1A.

## Decisiones técnicas
- Fuentes **autoalojadas** (`fonts/*.woff2`), no `<link>` a Google Fonts: tiene que andar offline.
- **Rutas relativas** (`./`) en todo (Pages sirve bajo `/app-disciplina/`).
- Fechas locales `YYYY-MM-DD` con getFullYear/getMonth/getDate; **nunca `toISOString()`** (es UTC).
- Guardado con debounce (~400 ms) + flush en `blur` y `visibilitychange`.
- Service worker cache-first con caché versionado (`CACHE_VERSION` en `sw.js`): **subir el número en cada publicación** que cambie archivos.
- Lógica pura (fechas, resumen, validación de import) en `js/logic.js`, con tests: correr `node --test` en la raíz (en Node 24 NO pasarle `tests/` como argumento).
- Almacenamiento persistente: `navigator.storage.persist()`; en Android suele concederse si la app está instalada, pero NO es garantía ni protege de "borrar datos"/desinstalar → el export JSON es el único respaldo real.
- Splash de Android: lo arma Chrome con `background_color` + ícono + `name` del manifest; no se diseña libre.

## Contexto real de Simon (diseñar para esto)
- Meta: despertar 7:00 y dormir 23:00 la mayoría de los días.
- Mar a vie 8 a 17: trabajo en piletas. Antes lleva a sus hijos; trayecto casa-trabajo 35 min.
- Lunes y sábado 8 a 15: ventas en la calle. Domingo libre.
- Sonido: mayormente fines de semana, avisan 2-3 días antes. A veces se mezcla con otras tareas el mismo día.
- Hábitos a construir: inglés 15-20 min/día, ejercicio (hoy no hace), alimentación ordenada, limpieza de la casa repartida en días cortos.
- Problema: procrastina y se deja llevar por impulsos. Vive sin horarios fijos y todo mezclado.

## Identidad visual (definida, seguir al pie de la letra)
Estética oscura, seria, cortante — libro de contable viejo de alguien que no perdona un desvío. Cero curvas amigables, cero sombras suaves, cero emojis de sistema.

| Uso | Hex |
|---|---|
| Fondo general | `#0c0b09` |
| Fondo de filas | `#131210` (alternadas `#17150f`) |
| Líneas separadoras | `#2c2820` |
| Acento bronce | `#c9a24b` (apagado `#8a7439`) |
| Alerta / no cumplido | `#8a2b22` (claro `#c1584a`) |
| Texto principal (hueso) | `#e8e1d0` |
| Texto secundario / placeholder | `#8f8a78` |
| Marca "cambió" (gris pizarra) | `#5c6b6a` |
| Tipo de bloque — pileta (PARA MÁS ADELANTE) | `#45614a` |
| Tipo de bloque — ventas (PARA MÁS ADELANTE) | `#8a6a2b` |
| Tipo de bloque — sonido (PARA MÁS ADELANTE) | `#3d5866` |
| Tipo de bloque — personal (PARA MÁS ADELANTE) | `#4a463c` |

Tipografía (autoalojada): títulos, horas y números → **Bebas Neue** (mayúsculas, buen letter-spacing). Texto que Simon escribe y datos → **Space Mono**. Nunca fuentes redondeadas/amigables.

Iconografía: sin emojis ni íconos de librería. SVG propios de trazo fino:
- Cumplido: tilde grueso en trazo recto, bronce.
- No cumplido: cruz fina y filosa, rojo sangre.
- Cambió: flecha semicircular fina, gris pizarra.
- Sin registrar: sin marca ni color (estado neutro, NO es un fallo).

Interacción definida:
- Hora actual: barra vertical de 4 px bronce a la izquierda de la fila (no fondo de color).
- 3 prioridades del día numeradas en romano (I, II, III). Al marcar hecha: texto tachado con una línea fina de un solo trazo (no `line-through`), tilde bronce a la derecha, texto apagado (no verde).
- Sobre la agenda, resumen en vivo en texto chico tipo ficha: "X cumplido · Y caído · Z sin marcar" (+ "· W cambió" solo si W > 0), recalculado solo.

## ETAPA 1 (lo que se programa ahora)
1. Agenda hora a hora 6:00–24:00 (inicio/fin configurables), un renglón por hora, texto libre. Flechas angulosas día anterior/siguiente, botón "Hoy", selector de fecha. Días futuros y pasados editables. Abre siempre en HOY con la hora actual resaltada.
2. Cumplimiento: 4 estados (cumplido / no cumplido / cambió / sin registrar). "No cumplido" → un toque más para el motivo: impulso, cansancio, imprevisto, procrastiné, otro. Máximo 2 toques por marca. "Sin registrar" no cuenta como fallo.
3. 3 prioridades del día ("LO QUE HOY NO SE NEGOCIA") sobre la agenda.
4. Resumen en vivo.
5. Exportar / Importar `.json` (la app no lo manda a ningún lado sola) + pantalla de ayuda: qué acciones borran los datos (borrar datos del navegador, desinstalar, cambiar de celu) y por qué el export es el único respaldo.
6. Pedir almacenamiento persistente al primer arranque y contar la verdad de qué tan confiable es.
7. Ícono de la app y splash con la misma estética.
8. Instalable como PWA y funcional offline.

Sub-etapas: **1A** base + agenda + PWA + publicación en Pages · **1B** cumplimiento + resumen · **1C** prioridades · **1D** ajustes + export/import + ayuda + persistencia · **1E** cierre (prueba offline real, guía "cambié de celu / se borraron los datos").

### Estado actual (actualizar al avanzar)
- **1A, 1B, 1C, 1D, 1E: TERMINADAS y publicadas** en https://ackerman-33.github.io/app-disciplina/ (repo `Ackerman-33/app-disciplina`, rama `main`, Pages desde la raíz).
- **ETAPA 1 COMPLETA y confirmada por Simon en su Android (2026-09-21):** 1A a 1E funcionan en su celu (prioridades, Ajustes, exportar/importar, modo avión). 1C-1E las construyó Claude de noche y se verificaron con tests y en el navegador de la PC antes.
- **Etapa 2A en curso** (hábitos con frecuencia propia, marcas y racha). Diseño: `docs/superpowers/specs/2026-09-21-habitos-con-racha-design.md`; plan: `docs/superpowers/plans/2026-09-21-habitos-con-racha.md`. Entrega 1 (hábitos y marcas) publicada como `disciplina-v8`, pendiente de prueba en el celu; Entrega 2 (racha) pendiente. Base IndexedDB en versión 2 (store `habits`); export en `schemaVersion` 2 (los `.json` de la versión 1 se siguen pudiendo importar). Los hábitos se muestran ordenados por fecha de creación y luego por nombre (`sortHabits`).
- Siguientes piezas de la Etapa 2: 2B (cierre nocturno de 2 minutos) y 2C (días tipo), cada una con su propio diseño y plan. Pendiente menor: decidir si HOY abre mostrando las prioridades primero.
- Guía de respaldo para Simon: `GUIA-RESPALDO.md`.
- Al publicar cualquier cambio: correr `node --test`, subir `CACHE_VERSION` en `sw.js` (hoy `disciplina-v8`), commit y `git push`. Si se agrega un archivo a `js/`, `fonts/` o `icons/`, agregarlo a `ASSETS` en `sw.js` (un test lo verifica).
- Pendiente de decidir con Simon: al abrir HOY la agenda se centra en la hora actual y las prioridades quedan arriba (hay que subir el scroll).
- Para probar en la PC: `.claude/launch.json` (en la carpeta padre `PROYECTO SIMON`, fuera del repo) arranca `dev-server.py` (también en la carpeta padre): sirve `app-disciplina/` en el puerto 8080 con `Cache-Control: no-store`. Aun así el service worker cachea agresivo: para ver cambios locales hay que desregistrarlo, borrar las cachés y **cargar la página dos veces** (la primera vuelve a registrar el SW; la segunda ya usa el código nuevo). Usar `?r=N` distinto en cada carga.

Entregable final Etapa 1: app instalada en el Android de Simon, en GitHub Pages, más guía corta de "qué hago si cambio de celu o se me borran los datos".

## PARA DESPUÉS (NO programar todavía)
- Swipe sobre el renglón para marcar, en vez de tocar los iconitos.
- Botón "copiar agenda de ayer" y plantillas de "día tipo" (piletas, ventas, sonido, domingo) sugeridas según el día de la semana.
- Tick de color angosto al lado de cada hora según tipo de bloque (pileta/ventas/sonido/personal).
- Vibración distinta al marcar cumplido vs no cumplido.
- Número visible tipo "14 días sin fallar lo no negociable" — dato seco, no gamificación.
- **Etapa 2:** hábitos diarios con racha, cierre nocturno de 2 minutos, días tipo.
- **Etapa 3:** estadísticas semanales, recordatorios locales al inicio de cada bloque (decirle la verdad de qué funciona en una PWA: las notificaciones locales programadas fiables en PWA son limitadas).
- **Ideas más lejanas:** modo enfoque con timer; botón "estoy por caer en un impulso" con pausa de 10 min y frase propia; sección "mis reglas" visible.
