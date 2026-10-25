# Modo base · «La semana en Toccoa» (ronda 2)

Sobel manda la compañía; Winters solo manda su pelotón. El modo base es la semana vista desde ahí: **las mañanas las fija Sobel, las tardes son tuyas**, y el sábado llega la inspección.

## Bucle (3–5 min por semana)
1. **Planificar** (pantalla apaisada, dos pulgares): tablero de lunes a sábado con dos filas.
   - *Mañana* (sello rojo de Sobel, no se toca): Currahee, calistenia, pista de obstáculos, inspección…
   - *Tarde* (tuya): eliges una actividad para el pelotón. El pulgar izquierdo toca el día y el derecho la actividad. Tocar una actividad rellena la siguiente tarde vacía.
   - Arriba, cinco medidores del pelotón: **Forma**, **Fatiga**, **Moral**, **Orden** (cómo están las taquillas para el sábado) y **Sobel** (su tensión con Winters). Al elegir, el medidor muestra la flecha de lo que va a cambiar.
2. **Vivir la semana**: la cámara recorre el campamento y el pelotón hace lo que elegiste (calistenia en el campo de revista, armas en los bancos, taquillas frente al barracón, descanso a la sombra). Cada bloque dura unos segundos y puede acelerarse (⏩). Los cambios saltan sobre los medidores.
3. **Sucesos** (tarjetas con decisión o viñetas cortas) interrumpen la semana.
4. **Inspección del sábado**: Sobel recorre la fila y apunta hombres. Puedes interceder por uno.
5. **Fin de semana**: quién sale de pase y quién se queda en el barracón. Resumen.

## Actividades de la tarde
| Actividad | Efecto | Coste |
|---|---|---|
| Calistenia | Forma ↑↑ | Fatiga ↑↑, Moral ↓ |
| Armas y táctica (desmontar el fusil con los ojos vendados, mapa y brújula) | Puntería y mando ↑ (no cuentan en Currahee; se notarán en Normandía) | Fatiga ↑ |
| Preparar la inspección | Orden ↑↑, Sobel ↓ | Moral ↓ |
| Descanso | Fatiga ↓↓, Moral ↑ | Orden ↓, Sobel ↑ |
| Con los hombres | Moral ↑, lazos con Winters | — |

Cada noche se recupera algo de fatiga y el orden se deteriora un poco; el fin de semana solo descansa a medias. **La semana pasa a las carreras**: la forma de cada hombre, menos su fatiga y más su moral (`runFit` en `semana-data.js`), decide quién flaquea en Currahee. En simulación: plan equilibrado 75,6 de forma efectiva y nadie en riesgo; solo descanso 73; solo calistenia 53 y 14 hombres en riesgo; solo taquillas 55. Descansar pone a Sobel de malas; preparar la inspección lo calma.

## Sucesos (del libro, salvo los marcados)
- **Sink mira la calistenia de Winters** (toda la compañía; Winters en la tarima): «¿Cuántas veces ha hecho calistenia esta compañía?» «Tres veces, señor.» Unos días después lo asciende a teniente primero sin consultar a Sobel. Ocurre siempre: es historia. Sube mucho el roce con Sobel.
- **Trabajos sucios** desde el ascenso: inspección de letrinas y oficial de comedor. Llegan como órdenes escritas a máquina; esa tarde el pelotón entrena sin Winters. *Inventado:* eliges quién se queda al frente (Lipton: rinde casi igual; Guarnere: más moral y riesgo de pelea). Si el roce sigue creciendo en la semana 2, llegan más.
- **Veinte flexiones** por una falta menor.
- **Orejas sucias / taquillas sucias** en la inspección: tres o cuatro pases negados por «orejas sucias» siempre, y hasta media docena más por «taquillas sucias» según el **Orden**. *Inventado:* después, fuera de la vista de la compañía, Winters puede hablar con Sobel en privado, ayudar al castigado con la taquilla o dejarlo estar. Winters nunca le lleva la contraria a Sobel en público.
- **Los pases**: no hay pueblo cerca; cerveza en la cantina.
- **El hoyo de 6 × 6 × 6 pies**: el que vuelve tarde el domingo cava después de una jornada entera, y después lo rellena.
- **La prueba física de Sobel** (segunda semana): treinta flexiones; nadie sonrió. Cita literal de Tipper.
- **La primera marcha nocturna** (segunda semana): dieciocho kilómetros sin agua; al llegar, Sobel revisa las cantimploras. *Inventado:* la decisión de Winters (cumplir la orden o hacer la vista gorda).
- *Inventado:* **revista de barracones** el jueves de la semana 2, para que el Orden vuelva a contar; el castigo (marchar con la mochila cargada) es del libro.
- *Inventado:* las frases de cada hombre en «Con los hombres».

## Estructura del capítulo
llegada → subida 1 → **semana 1** (lunes a sábado + fin de semana) → **semana 2** (lunes a jueves; el viernes son los espaguetis) → espaguetis → subida 2 → cierre.

Durante la semana: pausa arriba a la derecha (el guardado de pausa guarda la semana como empezó, nunca a medias); ⏩ ×1 → ×3 → ⏭ ×8 hasta la siguiente decisión.

## Sonido
Toque de diana por la mañana y retreta al anochecer (corneta de armónicos naturales). Sello de goma en los bloques de Sobel, lápiz al elegir, máquina de escribir de la oficina de la compañía en las órdenes de Sobel. Conteo coral de la calistenia. Lecho de chicharras de Georgia por la tarde y grillos de noche. El tema «camp» sube y baja según el ánimo del pelotón. La inspección es casi en silencio: botas sobre la arcilla y la voz de Sobel.
