// La Compañía E en Toccoa (verano de 1942). Solo datos.
// fate: "book" = el libro decide qué le pasa; el juego nunca lo mata antes de tiempo.
// stats de partida (0-100): fit (forma física), aim (puntería), stealth (sigilo), lead (mando), nerve (temple).
// Hechos del libro en `note`. Lo inventado se marca con `invented: true` (ver docs/inventado.md).

export const COMPANY = [
  { id: "winters", name: "Tte. Richard Winters", short: "Winters", rank: "Teniente · 2.º pelotón", rankKey: "lt", skin: 0xdba886,
    stats: { fit: 78, aim: 70, stealth: 60, lead: 85, nerve: 82 }, note: "Cuáquero de Pensilvania. No bebe ni fuma. Los hombres confían en él desde el primer día." },
  { id: "nixon", name: "Tte. Lewis Nixon", short: "Nixon", rank: "Teniente", rankKey: "lt", skin: 0xd8a888,
    stats: { fit: 58, aim: 55, stealth: 45, lead: 70, nerve: 66 }, note: "Amigo íntimo de Winters. Hijo de una familia rica de Nueva York; brillante y bebedor." },
  { id: "sobel", name: "Cap. Herbert Sobel", short: "Sobel", rank: "Capitán · jefe de la compañía", rankKey: "cpt", skin: 0xd2a080, mustache: false,
    stats: { fit: 70, aim: 40, stealth: 30, lead: 35, nerve: 60 }, note: "Exige más que nadie. Niega permisos por «orejas sucias». Corre con los brazos como aspas." },
  { id: "lipton", name: "Carwood Lipton", short: "Lipton", rank: "Soldado", skin: 0xd39f7d, mustache: true,
    stats: { fit: 72, aim: 66, stealth: 62, lead: 74, nerve: 78 }, note: "De Virginia Occidental. Hijo de minero; perdió a su padre de niño." },
  { id: "guarnere", name: "Bill Guarnere", short: "Guarnere", rank: "Soldado", skin: 0xcf9874,
    stats: { fit: 74, aim: 72, stealth: 50, lead: 55, nerve: 80 }, note: "Del sur de Filadelfia. «Wild Bill»." },
  { id: "malarkey", name: "Don Malarkey", short: "Malarkey", rank: "Soldado", skin: 0xe0b08f,
    stats: { fit: 66, aim: 64, stealth: 58, lead: 45, nerve: 62 }, note: "De Astoria, Oregón. En la marcha a Atlanta casi no llega; llegó." },
  { id: "toye", name: "Joe Toye", short: "Toye", rank: "Soldado", skin: 0xd7a483,
    stats: { fit: 76, aim: 66, stealth: 52, lead: 48, nerve: 76 }, note: "De Pensilvania. Duro como una piedra." },
  { id: "muck", name: "Warren «Skip» Muck", short: "Muck", rank: "Soldado", skin: 0xe2b292,
    stats: { fit: 68, aim: 62, stealth: 56, lead: 42, nerve: 64 }, note: "De Tonawanda, Nueva York. Compañero de tienda de Malarkey." },
  { id: "tipper", name: "Ed Tipper", short: "Tipper", rank: "Soldado", skin: 0xd9a77f,
    stats: { fit: 64, aim: 60, stealth: 55, lead: 40, nerve: 60 }, note: "El primer día apostó que lo último sería subir esa montaña. Se equivocaba: fue lo primero." },
  { id: "christenson", name: "Burton «Pat» Christenson", short: "Christenson", rank: "Soldado", skin: 0xdcae8c,
    stats: { fit: 66, aim: 58, stealth: 60, lead: 40, nerve: 58 }, note: "Dibujaba a sus compañeros. Recordaba la sed de las marchas nocturnas." },
  { id: "gordon", name: "Walter Gordon", short: "Gordon", rank: "Soldado", skin: 0xd6a280,
    stats: { fit: 62, aim: 64, stealth: 54, lead: 38, nerve: 62 }, note: "De Misisipi. «Hasta el Día D, mi guerra era con este hombre» (Sobel)." },
  { id: "wynn", name: "Robert «Popeye» Wynn", short: "Wynn", rank: "Soldado", skin: 0xd9a07a,
    stats: { fit: 60, aim: 56, stealth: 64, lead: 34, nerve: 52 }, note: "Más tarde, mensajero de Sobel; se las ingeniaba para «perderse»." },
  { id: "martin", name: "John Martin", short: "Martin", rank: "Soldado", skin: 0xd4a282,
    stats: { fit: 70, aim: 62, stealth: 58, lead: 52, nerve: 70 }, note: "De Oregón. Seco y directo." },
  { id: "talbert", name: "Floyd Talbert", short: "Talbert", rank: "Soldado", skin: 0xd0a07e,
    stats: { fit: 72, aim: 64, stealth: 60, lead: 60, nerve: 70 }, note: "De Indiana. Uno de los suboficiales que mantendrán unida a la compañía." },
];

// Reclutas sin nombre: el desempeño del jugador decide cuántos aguantan Toccoa (invented: true).
export const RECRUIT_NAMES = ["Hale", "Purdy", "Osborne", "Kessler", "Dukeman", "Ramírez", "Whitlock", "Barrow", "Sisk", "Nolan", "Pryor", "Haddad"];

export const CHAPTER_ORDER = ["currahee", "aldbourne", "dia-d", "carentan", "holanda", "mourmelon", "bastogne", "haguenau", "kaufering", "berchtesgaden"];
