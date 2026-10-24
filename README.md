# Hermanos de Sangre

Juego para navegador inspirado en *Hermanos de sangre* de Stephen E. Ambrose. Pensado para jugarse en el celular **en horizontal, con los dos pulgares**, y también con ratón y teclado en el escritorio.

## Cómo jugar

- `index.html`: portada con el menú de capítulos.
- `juego.html`: **el juego unificado** (director de escenas, plantilla persistente, guardado general). Hoy trae el Capítulo I, Currahee.
- `hermanos-de-sangre.html`: **Bastogne**.
- `dia-d.html`: **Día D, modo soldado** (prototipo vertical; se pasará al juego unificado).

Controles en `juego.html`: arrastra a la izquierda para moverte; botón derecho para la acción del momento (en Currahee, «Respirar» al compás). Teclado: WASD/flechas, B o Espacio para respirar, E para ayudar.

Los dos juegos son archivos únicos autocontenidos, así que se pueden descargar y abrir en el celular. Solo necesitan internet para las fuentes de Google. Añade `?fps=1` a la URL para ver los fps.

**No edites estos `.html` a mano:** se generan desde `src/` con `npm run build` (ver abajo). Se guardan en git para que GitHub Pages y la descarga directa sigan funcionando.

## Estructura

```
src/
  main.js            entrada del juego unificado: título, capítulos, pausa
  shell/index.html   plantilla HTML y CSS apaisada del juego unificado
  engine/            motor compartido: render, geometría, efectos, audio (buses, voces, ambientes), música adaptativa, controles, UI, escenario
  core/              juego: soldados y combate (game), modelos (actors), terreno (world), objetos (props),
                     caparazón y bucle (shell), director de escenas (director), modos (modes),
                     plantilla persistente (roster), guardado versionado (save), columnas en marcha (column)
  data/              solo datos: armas, la compañía (company), reparto del Día D
  chapters/
    currahee/        Capítulo I: momentos (chapter), mapa de Toccoa (places), objetos (props), la carrera (run)
    dia-d/           arranque y guardado (main), mapas (dday), guion (story), plantilla HTML
    bastogne/        head.html + game.js (incluye Three.js) + tail.html
lib/three-runtime.js Three.js r170 como script global (lo usa el Día D)
scripts/build.mjs    genera juego.html, dia-d.html y hermanos-de-sangre.html
tools/               pruebas con Playwright y sondas, por capítulo
docs/estado.md       estado y pendientes
docs/inventado.md    lo que el juego inventa respecto al libro
docs/creditos.md     licencias y autores
```

Bastogne nació como un solo archivo y todavía no usa `src/engine` ni `src/core`; pasarlo al motor común es un paso posterior.

## Reglas del código

- Ningún capítulo importa a otro: lo compartido va a `engine/`, `core/` o `data/`.
- Un capítulo es datos: lugares y una lista de momentos, cada uno con su modo. El director los encadena sin pantallas de carga.
- La historia no se cambia en lo grande: quien sobrevive en el libro, si cae, vuelve al último punto de control.

## Compilar

Requiere Node 18 o superior.

```sh
npm install
npm run build   # genera juego.html, dia-d.html y hermanos-de-sangre.html
npm run dev     # reconstruye dia-d.html cada vez que cambias algo en src/
```

## Herramientas de prueba

`tools/currahee/` (apaisado 844×390 táctil, con un piloto automático: `tools/currahee/full.sh` juega el capítulo entero), `tools/dia-d/` y `tools/bastogne/` tienen scripts de Playwright (Python) para recorrer el juego sin pantalla y sacar capturas en `shots/`. Abren los `.html` de la raíz, así que corre `npm run build` antes.

## Estado

Ver [`docs/estado.md`](docs/estado.md).
