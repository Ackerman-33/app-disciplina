# Guía corta: cambié de celu / se me borraron los datos

La app guarda todo **solo en tu celular**. No hay nube ni cuenta. Por eso, el archivo de respaldo (`.json`) es tu **única** copia.

Dirección de la app: **https://ackerman-33.github.io/app-disciplina/**

---

## 1. Hacer el respaldo (una vez por semana)

1. Abrí la app → tocá **AJUSTES** (arriba a la derecha).
2. En **Tus datos**, tocá **Guardar archivo**. Se genera `disciplina-AAAA-MM-DD.json`.
   - Si aparece el botón **Compartir**, sirve para mandarlo directo a WhatsApp (a vos mismo), Drive o el mail.
3. **Guardalo fuera del celular.** Un archivo que queda solo en Descargas se pierde con el celu.
   - Opción fácil: mandátelo por WhatsApp a tu propio número o subilo a Google Drive.
4. Arriba de los botones dice la fecha del último archivo guardado. Si dice "todavía no guardaste ningún archivo", hacelo ya.

> Regla: **lo que no exportaste no se puede recuperar.**

## 2. Qué borra tus datos

- Borrar los datos de navegación / del sitio en Chrome.
- Borrar los datos de la app en Ajustes del celular → Aplicaciones.
- Desinstalar la app.
- Cambiar de celular o restaurarlo de fábrica.
- Usar la app en una ventana de incógnito.

Cerrar la app, apagar el celu o quedarte sin internet **no** borra nada.

## 3. Recuperar los datos en un celu nuevo (o después de un borrado)

1. En el celu nuevo abrí **Chrome** y entrá a `https://ackerman-33.github.io/app-disciplina/`.
2. Menú ⋮ → **Instalar app**. Abrila desde el ícono nuevo.
3. Traé el archivo `.json` al celu (desde WhatsApp, Drive o tu mail) y guardalo en el celu.
4. En la app: **AJUSTES → Importar archivo** y elegí ese `.json`.
5. Vas a ver un cartel: *"Este archivo tiene N días (del … al …). Importarlo REEMPLAZA todo lo que hay ahora."* Revisá que las fechas tengan sentido y tocá **Reemplazar todo**.
6. Debería decir *"Listo: se importaron N días."* Volvé a la agenda y revisá algún día pasado.

## 4. Si algo sale mal

| Qué pasa | Qué hacer |
|---|---|
| "Ese archivo no se pudo leer" | El archivo se dañó o no es el `.json` de la app. Probá con otro respaldo más viejo. |
| "Este archivo no es un export de esta app" | Elegiste otro archivo. Buscá uno que se llame `disciplina-….json`. |
| "El archivo viene de una versión más nueva" | Abrí la app con internet una vez para que se actualice, y probá de nuevo. |
| No encuentro el archivo al importar | Buscalo en Descargas o en Documentos, o volvé a bajarlo de WhatsApp / Drive. |
| La app se ve vieja tras una actualización | Cerrala del todo (deslizala fuera de las apps recientes) y abrila de nuevo, una o dos veces. |

Si el importado falla, **tus datos actuales no se tocan**: la importación es "todo o nada".
