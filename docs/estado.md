# Hermanos de Sangre · estado

## Juego unificado · Capítulo I, Currahee (ronda 1)
`juego.html` es el comienzo del juego completo: un solo programa que recorre el libro y cambia de modo dentro de cada capítulo, con la misma cámara y sin pantallas de carga.

**Sistemas nuevos (comunes a todos los capítulos):**
- Caparazón (`core/shell.js`): renderer, cámara, controles, interfaz, audio y bucle; monta lugares a partir de datos.
- Director de escenas (`core/director.js`): un capítulo es una lista de momentos con su lugar y su modo; guarda al entrar en cada momento y permite reintentar.
- Modos (`core/modes.js`): narrativo, acción, sigilo, línea, base y asalto (hoy se usan narrativo y acción).
- Plantilla persistente (`core/roster.js`): estadísticas, moral, cansancio, heridas, cicatrices, relaciones y experiencia de cada hombre; los reclutas inventados son los únicos que pueden ser expulsados.
- Guardado general versionado (`core/save.js`, clave `hds_save`, versión 2) que migra el guardado antiguo del Día D (`hds_dia_d_v1`).
- Interfaz apaisada para dos pulgares; en vertical, el teléfono pide girarse.
- Audio por buses (música, efectos, voces, ambiente) con volúmenes separados y medidores; voces sintetizadas con formantes; ambiente de Georgia con cigarras; música adaptativa por capas (`engine/music.js`) con cadencia militar, que se desbloquea con el primer toque.
- Columnas en marcha (`core/column.js`), reutilizable para la marcha a Atlanta y las marchas nocturnas.

**Jugable:** llegada a Toccoa (narrativo) → primera subida a Currahee (acción) → las semanas de entrenamiento → la comida de espaguetis (decisión) → la carrera de los espaguetis con dos ambulancias → cierre.
- En la carrera eres Winters dentro de la columna de Sobel: respira al compás de la cadencia para recuperar aliento, no dejes que te alcance la ambulancia y vuelve por los hombres que flaquean.
- Los hombres con nombre nunca son expulsados (los lleva un compañero); los reclutas inventados que alcanza la ambulancia se van ese mismo día.

**Crítica (subagentes, Playwright apaisado 844×390 táctil):**
| Crítico | Ronda 1 | Ronda 2 | Ronda 3 |
|---|---|---|---|
| QA, arte y jugabilidad móvil | 5,5 | 7,8 | **8,2** |
| Música y sonido | 6 | 7 | **8** |
| Fidelidad histórica | 6,5 (correcciones aplicadas) | | |
Sin errores de consola en el capítulo completo.

**Primera prueba en teléfono (iPhone):** los pinos del cerro se movían como figuras sueltas. Dos causas: el balanceo del viento usaba la altura sobre el nivel del mar (en el cerro, decenas de metros) y no la altura del árbol, y el círculo de transparencia tramaba cualquier copa cercana aunque no tapara a nadie. Ahora los pinos fusionados usan el material `canopy`, que guarda por vértice la altura sobre su suelo (`aSway`) y se mece poco. La transparencia solo afecta lo que está entre la cámara y el soldado (`uFocusD`, profundidad) y el radio de la carrera bajó de 230 a 120 px.

**Pendiente menor:** el balbuceo de las voces sigue sonando sintético; el título podría mostrar a la compañía formada; probar en un teléfono real (las pruebas usan Chromium sin GPU a ~4 fps).

**Cambio de regla en el Día D:** Winters sobrevive a la guerra en el libro, así que si cae en Brécourt se vuelve al punto de control. Se quitó la rama «Lipton toma el mando».

**Pendiente en el Capítulo I (rondas siguientes):** base (horario semanal, permisos y tensión con Sobel), pista de obstáculos y campo de tiro, maniobras nocturnas (sigilo), casa de prácticas (asalto), ejercicios de defensa (línea), marcha a Atlanta y salto en Fort Benning.

---

## Antes del juego unificado

## Bastogne (ronda 4 cerrada · crítico 8,1/10)
- Cráter fantasma del día 1 eliminado (eran cráteres precargados delante de los pozos).
- Alemanes nocturnos en gris de campaña, con un contorno de luz fría.
- Destello de las explosiones cálido y contenido, sin quemar la imagen; bloom −25 %.
- La cámara se desliza al llegar la noche (velocidad máxima 9 u/s, antes ~120).
- El "+N" del pelotón tiene su propio hueco y ya no tapa a Compton.
- Textos flotantes agrupados ("Abatido ×3") y siempre dentro de la pantalla.
- Trazadoras más cortas.
- Resolución adaptativa; con ?fps=1 se ven los fps.
- Pendiente: probar en un teléfono real.

## Día D, modo soldado (prototipo)
- **Parte 1, salto nocturno.** Winters solo con la bayoneta: soltar el arnés, el paracaidista de la 82.ª y la granada, la MG junto a la bolsa ("A la mierda el equipo"), el huerto con la patrulla, la chicharra, Lipton en el camino hundido y el cartel de Sainte-Mère-Église.
- **Parte 2, Brécourt Manor.** Base de fuego en el seto, granada de Compton, Wynn herido, "¡Joe, cuidado!" (pulsación rápida), la funda de la Luger de Malarkey (decisión), prisioneros, la muerte de Hall, TNT en los cañones con Hester, Speirs y la retirada.
- **Muerte permanente desde el 2.º cañón:** si cae Winters, Lipton toma el mando y el epílogo cambia. Antes de ese punto la muerte devuelve al punto de control (escena garantizada).
- **Sistemas:**
  - Conos de visión limitados por los setos y ajustados a tu postura.
  - Sigilo de noche: luz, ruido y postura.
  - Apuntado asistido, vendas y sangrado, granadas, puntos de control con autoguardado.
  - Audio sintetizado y código modular (esbuild).
- **Crítico:** ronda 1 4,5 → ronda 3 6/10.
- **Pendientes:**
  - Más rango de valores de noche.
  - Densidad de objetos sueltos.
  - Retoques del cono.
  - Que el modo soldado alcance el 8+ de Bastogne.
