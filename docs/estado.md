# Hermanos de Sangre · estado

## Las carreras a Currahee, rehechas tras la prueba en teléfono
El jugador sentía que no pasaba nada si no ayudaba, que costaba ir al paso y que cortar camino no tenía consecuencias. Ahora (`core/column.js` modo `tail`, `chapters/currahee/run.js`):
- **Winters cierra la columna.** Sin tocar el stick va al paso; adelante sube por la columna, atrás se deja caer, de lado cruza el camino.
- **Los rezagados** se quedan atrás tropezando hacia el borde del camino. Si Winters los toca, se rehacen (más fuerza y 25 s sin volver a flaquear) y vuelven a su sitio. Si se le pasan tres (cuatro en la de los espaguetis), Sobel manda a la compañía abajo, a empezar otra vez. Como mucho flaquean dos a la vez (tres en la segunda carrera).
- **Esprint** (se mantiene pulsado): más velocidad a cambio de aliento.
- **El camino:** fuera del sendero aparece «¡Al camino!»; a los 1,6 s Sobel pone una falta y quita aliento. Tres faltas y se vuelve a empezar.
- **La ambulancia** tiene más hueco detrás de Winters; si lo alcanza, también se vuelve a empezar.
- Bot de prueba: el que juega bien termina las dos carreras (5 a 8 rezagados atajados); el que no se mueve pierde por tres que se le pasan.

## Juego unificado · Capítulo I, Currahee (ronda 2: el modo base)
**La semana en Toccoa** (`core/week.js`, `core/weekui.js`, `chapters/currahee/semana*.js`; diseño en `docs/diseno-semana.md`). Entre la primera carrera y los espaguetis hay dos semanas de campamento:
- **Planificar:** Sobel fija las mañanas (Currahee, calistenia, pista, inspección) y tú eliges las tardes del pelotón: calistenia, armas y táctica, preparar la inspección, descanso o pasar la tarde con los hombres. Cinco medidores (Forma, Fatiga, Moral, Orden, Sobel) con una raya que marca cómo acabará la semana si nada se tuerce.
- **Vivir la semana:** la cámara recorre el campamento y el pelotón hace lo que elegiste (calistenia al unísono, sentados con las armas, sacando brillo frente al barracón, a la sombra, en corro con Winters). ⏩ acelera ×3.
- **Sucesos del libro:** Sink mira la calistenia de Winters y lo asciende sin consultar a Sobel; desde entonces, órdenes escritas a máquina mandan a Winters a las letrinas o al comedor y esa tarde el pelotón rinde menos; veinte flexiones; la inspección del sábado con «orejas sucias» y «taquillas sucias» (puedes interceder; Sobel no cede); los pases; el hoyo de 6 × 6 × 6 pies del que volvió tarde; la primera marcha nocturna sin agua y la revisión de cantimploras (decides si haces la vista gorda); las treinta flexiones de Sobel.
- **Lo que pasa a la carrera:** la forma de cada hombre menos su fatiga, más su moral, decide quién flaquea en la carrera de los espaguetis. En la simulación, un plan equilibrado deja al pelotón en 75,7 de forma efectiva; solo calistenia, en 61 (llegan reventados); solo descanso, en 72.
- **Sonido nuevo** (`engine/camp-audio.js`): toques de corneta de armónicos naturales (diana, retreta), sello de goma de Sobel, máquina de escribir de las órdenes, pala, conteo coral de la calistenia; la inspección casi en silencio.
- **Poses nuevas** de los soldados: saltos de tijera, flexiones, saludo, cavar, sentado.
- **Decisiones durante la semana:** a quién le pides que tire de los hombres cuando Sobel manda a Winters a las letrinas (Lipton o Guarnere); qué hace Winters después de la inspección (hablar con Sobel en privado, ayudar al castigado, dejarlo estar); la marcha nocturna (cumplir la orden o hacer la vista gorda); las treinta flexiones de Winters, que se juegan con los dos pulgares; y la revista de barracones del jueves de la semana 2.
- **Pausa y guardado:** la pausa funciona en todo el modo; si guardas o sales a mitad de semana, se conserva la semana tal como empezó (nunca a medias).
- Capturas apaisadas: `docs/capturas/currahee-ronda-2/`.

**Crítica (subagentes, Playwright apaisado 844×390 táctil):**
| Crítico | Ronda 1 | Ronda 2 | Ronda 3 | Ronda 4 |
|---|---|---|---|---|
| Diseño y jugabilidad móvil | 5 | 7 | 7,5 | **8** |
| Música y sonido | 5 | 7 | **8** | |
| Fidelidad histórica | 7,5 | **9** | | |
Sin errores de consola en el capítulo completo (llegada → dos semanas → espaguetis → segunda carrera → cierre).

**Pendiente del modo base:** calibrar con el bot el umbral de «hombres en riesgo»; bus de interfaz seco para el papel y los sellos; llamada y respuesta de Winters en el conteo; un evento de aborto común para quitar escuchas de teclado; comparar la marca de Sobel de la semana 2 con el valor del miércoles. Probar en un teléfono real.

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

**Segunda prueba en teléfono:** (1) en la columna los hombres miraban al punto exacto al que iban, y cuando ese punto quedaba al lado o detrás corrían de lado o de espaldas; ahora miran a lo largo del camino (`faceAlong`). (2) En las escenas narrativas la interfaz se oculta y los subtítulos vivían dentro de ella: se oía la voz sin texto. Ahora los subtítulos están fuera de la interfaz. (3) Frases de cansancio en las carreras: el hombre más cansado cerca de Winters jadea una frase entre los gritos de Sobel (subida, bajada, espaguetis), y el que se queda atrás dice la suya.

**Pendiente menor:** el balbuceo de las voces sigue sonando sintético; el título podría mostrar a la compañía formada; probar en un teléfono real (las pruebas usan Chromium sin GPU a ~4 fps).

**Cambio de regla en el Día D:** Winters sobrevive a la guerra en el libro, así que si cae en Brécourt se vuelve al punto de control. Se quitó la rama «Lipton toma el mando».

**Pendiente en el Capítulo I (rondas siguientes):** pista de obstáculos y campo de tiro, maniobras nocturnas (sigilo), casa de prácticas (asalto), ejercicios de defensa (línea), marcha a Atlanta y salto en Fort Benning.

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
