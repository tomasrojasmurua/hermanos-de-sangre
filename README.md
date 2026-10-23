# Hermanos de Sangre

Juego para navegador inspirado en *Hermanos de sangre* de Stephen E. Ambrose. Pensado para jugarse en el celular (pantalla vertical, controles táctiles), aunque también funciona en el escritorio.

## Cómo abrirlo

- **Bastogne (juego principal):** abre `hermanos-de-sangre.html` en el navegador. Es un único archivo autocontenido; solo necesita internet para las fuentes de Google.
- **Día D, modo soldado (prototipo):** abre `dia-d.html`. También es un único archivo autocontenido, así que se puede descargar y abrir en el celular. (`dia-d/index.html` es la versión de desarrollo y necesita los archivos de su carpeta al lado.)

Si el repositorio tiene GitHub Pages activado, `index.html` en la raíz enlaza a ambos.

Añade `?fps=1` a la URL para ver los fps.

## Reconstruir el Día D

El código fuente modular está en `dia-d/src/` (punto de entrada `main.js`). Tras modificarlo, vuelve a generar el paquete con [esbuild](https://esbuild.github.io/):

```sh
cd dia-d
npx esbuild src/main.js --bundle --format=iife --outfile=dia-d.js
```

Después regenera `dia-d.html` (un solo archivo) incrustando `lib/three-runtime.js` y `dia-d.js` en lugar de sus etiquetas `<script src>` de `dia-d/index.html`.

Three.js no se importa como módulo: lo carga `lib/three-runtime.js` como script global antes de `dia-d.js`.

## Herramientas de prueba

`dia-d/tools/` contiene scripts de Playwright (`run.py`, `auto_night.py`, `auto_bre.py`, `gallery.py`) y sondas JS para recorrer el juego automáticamente y sacar capturas. Las rutas en `run.py` apuntan al entorno donde se escribieron; ajústalas antes de usarlas.

## Estado

Ver [`estado-dia-d.md`](estado-dia-d.md).
