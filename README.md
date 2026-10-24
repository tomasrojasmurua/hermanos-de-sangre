# Hermanos de Sangre

Juego para navegador inspirado en *Hermanos de sangre* de Stephen E. Ambrose. Pensado para jugarse en el celular (pantalla vertical, controles táctiles), aunque también funciona en el escritorio.

## Cómo jugar

- `index.html`: portada con el menú de capítulos.
- `hermanos-de-sangre.html`: **Bastogne**.
- `dia-d.html`: **Día D, modo soldado** (prototipo).

Los dos juegos son archivos únicos autocontenidos, así que se pueden descargar y abrir en el celular. Solo necesitan internet para las fuentes de Google. Añade `?fps=1` a la URL para ver los fps.

**No edites estos `.html` a mano:** se generan desde `src/` con `npm run build` (ver abajo). Se guardan en git para que GitHub Pages y la descarga directa sigan funcionando.

## Estructura

```
src/
  engine/            motor compartido: render, geometría, efectos, audio, controles, UI, conos de visión
  core/              juego: soldados y combate (game), modelos (actors), terreno (world), objetos (props)
  data/              solo datos: armas, reparto del Día D
  chapters/
    dia-d/           arranque y guardado (main), mapas (dday), guion (story), plantilla HTML
    bastogne/        head.html + game.js (incluye Three.js) + tail.html
lib/three-runtime.js Three.js r170 como script global (lo usa el Día D)
scripts/build.mjs    genera dia-d.html y hermanos-de-sangre.html
tools/               pruebas con Playwright y sondas, por capítulo
docs/estado.md       estado y pendientes
```

Bastogne nació como un solo archivo y todavía no usa `src/engine` ni `src/core`; pasarlo al motor común es un paso posterior.

## Compilar

Requiere Node 18 o superior.

```sh
npm install
npm run build   # genera dia-d.html y hermanos-de-sangre.html
npm run dev     # reconstruye dia-d.html cada vez que cambias algo en src/
```

## Herramientas de prueba

`tools/dia-d/` y `tools/bastogne/` tienen scripts de Playwright (Python) para recorrer el juego sin pantalla y sacar capturas en `shots/`. Abren los `.html` de la raíz, así que corre `npm run build` antes.

## Estado

Ver [`docs/estado.md`](docs/estado.md).
