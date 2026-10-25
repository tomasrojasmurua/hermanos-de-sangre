// La semana en Toccoa como datos: actividades, mañanas de Sobel y frases.
// Del libro: las carreras a Currahee tres o cuatro veces por semana, la pista de obstáculos diaria,
// la calistenia de Winters, la inspección del sábado, desmontar el fusil con los ojos vendados.
// Inventado (docs/inventado.md): los valores de cada actividad y las frases de los hombres.

export const ACTS = {
  // ---- Sobel's mornings
  currahee: { label: "Currahee", icon: "▲", fx: { fit: 0.9, fatigue: 12, morale: -1 }, line: "Tres millas arriba, tres abajo." },
  pista: { label: "Pista", long: "Pista de obstáculos", icon: "⊞", fx: { fit: 1.0, fatigue: 10, morale: -1 }, line: "Muros, cuerdas y alambre. Y otra vez." },
  calWin: { label: "Calistenia", icon: "✣", sub: "la dirige Winters", fx: { fit: 1.0, fatigue: 7 }, line: "Toda la compañía. La dirige el teniente Winters, desde la tarima." },
  inspeccion: { label: "Inspección", icon: "◉", fx: {}, line: "Sobel pasa revista." },
  pases: { label: "Pases", icon: "✉", fx: {}, line: "Fin de semana." },
  prueba: { label: "Prueba física", icon: "✣", fx: { fit: 0.4, fatigue: 5 }, line: "Treinta flexiones. Para todos." },
  // ---- the player's afternoons
  calistenia: { label: "Calistenia", icon: "✣", hint: "Forma ↑↑ · cansa mucho", fx: { fit: 2.8, fatigue: 10, morale: -1, tension: -1 } },
  armas: { label: "Armas y táctica", icon: "⌖", hint: "Puntería y mando ↑ · se notará en Normandía", fx: { aim: 2.2, lead: 1.2, fit: 0.2, fatigue: 4 } },
  taquillas: { label: "Preparar la inspección", icon: "▤", hint: "Orden ↑↑ · Sobel ↓ · los hombres refunfuñan", fx: { order: 24, fatigue: 3, morale: -2, tension: -2 } },
  descanso: { label: "Descanso", icon: "☾", hint: "Fatiga ↓↓ · Sobel ve al pelotón tumbado", fx: { fatigue: -16, morale: 3, order: -5, tension: 3 } },
  hombres: { label: "Con los hombres", icon: "⁂", hint: "Moral ↑ · lazos con Winters", fx: { morale: 5, fatigue: -4, tension: 1 } },
};
// how fit a man really is for a run: the week shows here (tiredness costs, spirit carries)
export const runFit = (m) => (m?.stats?.fit ?? 60) - (m?.fatigue ?? 0) * 0.3 + ((m?.morale ?? 60) - 60) * 0.12;

export const CHOICES = ["calistenia", "armas", "taquillas", "descanso", "hombres"];

const F = "free";
export const WEEK1 = [
  { key: "lun", label: "Lunes", short: "Lun", am: { act: "currahee", fixed: true }, pm: F },
  { key: "mar", label: "Martes", short: "Mar", am: { act: "calWin", fixed: true }, pm: F },
  { key: "mie", label: "Miércoles", short: "Mié", am: { act: "currahee", fixed: true }, pm: F },
  { key: "jue", label: "Jueves", short: "Jue", am: { act: "pista", fixed: true }, pm: F },
  { key: "vie", label: "Viernes", short: "Vie", am: { act: "currahee", fixed: true }, pm: F },
  { key: "sab", label: "Sábado", short: "Sáb", am: { act: "inspeccion", fixed: true }, pm: { act: "pases", fixed: true }, noNight: true, nightLabel: "Fin de semana" },
];
export const WEEK2 = [
  { key: "lun", label: "Lunes", short: "Lun", am: { act: "currahee", fixed: true }, pm: F },
  { key: "mar", label: "Martes", short: "Mar", am: { act: "pista", fixed: true }, pm: F },
  { key: "mie", label: "Miércoles", short: "Mié", am: { act: "currahee", fixed: true }, pm: F, night: "marcha", nightLabel: "☾ Marcha nocturna" },
  { key: "jue", label: "Jueves", short: "Jue", am: { act: "prueba", fixed: true }, pm: F, night: "revista", nightLabel: "☾ Revista de barracones" },
];

// what the men say while they work (said only at normal speed)
export const CHATTER = {
  calistenia: [["Winters", "¡Arriba esos brazos! ¡Otra serie!"], ["", "(un recluta) Me tiemblan hasta las orejas."], ["Winters", "Respirad. Cuatro más."]],
  armas: [["Winters", "Desmontad el fusil. Con los ojos vendados. Otra vez."], ["", "(un recluta) ¿Y este muelle de dónde ha salido?"], ["Winters", "Norte es donde apunta la aguja, no donde os apetece."]],
  taquillas: [["", "Sobel encontrará polvo hasta en el cielo."], ["", "Saca brillo a esa bota, que el sábado está cerca."], ["", "Las mantas tensas. Que rebote una moneda."]],
  descanso: [["", "Por fin, sombra."], ["", "Escríbele a tu madre, que lleva dos cartas sin respuesta."], ["", "Cinco minutos más. Solo cinco."]],
  hombres: [],
  away: [["", "(un recluta) ¿Y el teniente Winters?"], ["", "Sobel lo ha mandado a las letrinas. Otra vez."]],
};

// «Con los hombres»: what each man tells Winters (invented, grounded in the book's notes)
export const TALK = {
  lipton: "Mi padre murió cuando yo era un crío, mi teniente. Aquí siento que tengo familia otra vez.",
  guarnere: "En el sur de Filadelfia nadie me hablaba así y se iba de rositas. Pero me quedo. Quiero esas alas.",
  malarkey: "Astoria huele a salmón y a lluvia. Aquí todo huele a arcilla roja.",
  toye: "Que me ponga Sobel otra montaña. Me la subo.",
  muck: "Malarkey dice que la paga extra es para unas botas. Yo digo que para cerveza.",
  tipper: "Perdí la apuesta, mi teniente. Currahee no fue lo último. Fue lo primero.",
  christenson: "Le he hecho un dibujo a Sobel. No se lo enseñe a nadie.",
  gordon: "De momento, mi guerra es con ese hombre. Los alemanes pueden esperar.",
  wynn: "Si un día me pierdo en una marcha, no me busque muy deprisa.",
  martin: "Cumplo, mi teniente. No me pida que encima sonría.",
  talbert: "Los chicos le escuchan a usted, mi teniente. A él lo obedecen. No es lo mismo.",
};
