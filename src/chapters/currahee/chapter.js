// Capítulo I · Currahee (Toccoa, julio–diciembre de 1942). Ronda 1: la llegada y las dos subidas.
// Fuente: Ambrose, cap. «Queremos esas alas». Lo inventado está en docs/inventado.md.
import { T, damp } from "../../engine/util.js";
import { buildToccoa, W, ANG_RIGHT } from "./places.js";
import { currahee } from "./run.js";
import { cast } from "../../core/roster.js";

const FORMATION = ["lipton", "guarnere", "malarkey", "toye", "muck", "tipper", "christenson", "gordon", "wynn", "martin", "talbert"];

// men standing in ranks on the parade ground, Sobel in front
function muster(G, roster, kit = "hbt") {
  G.soldiers.slice().forEach((s) => s.remove());
  G.soldiers = [];
  const ids = FORMATION.concat(roster.activeRecruits().map((r) => r.id));
  const face = ANG_RIGHT + Math.PI / 2; // facing screen-down, toward the camera
  ids.forEach((id, i) => {
    const c = cast(id) || roster.get(id);
    const row = Math.floor(i / 8), colI = i % 8;
    const [x, z] = W(-82 + colI * 1.9, 3 - row * 1.9);
    const s = G.add({ id, name: c.name, short: c.short, side: "us", kit, weapon: "none", skin: c.skin, mustache: c.mustache, seed: 200 + i, x, z, ry: face });
    s.st.phase = Math.random() * 6;
  });
  const sc = cast("sobel");
  const [sx, sz] = W(-75.5, 8.2);
  G.add({ id: "sobel", name: sc.name, short: "Sobel", side: "us", kit: "hbt", rankKey: "lt", weapon: "none", skin: sc.skin, seed: 7, x: sx, z: sz, ry: face + Math.PI });
  const wc = cast("winters");
  const [wx, wz] = W(-68.5, 6.4);
  G.add({ id: "winters", name: wc.name, short: "Winters", side: "us", kit: "hbt", rankKey: "lt", weapon: "none", skin: wc.skin, seed: 1, x: wx, z: wz, ry: face + Math.PI });
}

// slow camera drift for narrative moments (no player)
function drift(ctx, from, to, secs) {
  const { G, shell } = ctx;
  G.player = null;
  G.cam.x = from[0];
  G.cam.z = from[1];
  let t = 0;
  const off = shell.hook((dt, rdt) => {
    t += rdt;
    const k = Math.min(1, t / secs);
    const e = k * k * (3 - 2 * k);
    G.cam.x = from[0] + (to[0] - from[0]) * e;
    G.cam.z = from[1] + (to[1] - from[1]) * e;
  });
  return off;
}

export const CURRAHEE = {
  id: "currahee",
  title: "Currahee",
  kicker: "Capítulo I · Toccoa, Georgia · 1942",
  places: { toccoa: buildToccoa },
  moments: [
    {
      id: "llegada",
      mode: "narrative",
      place: "toccoa",
      music: { theme: "calm", level: 0.35 },
      async run(ctx) {
        const { G, ui, audio, music, roster } = ctx;
        muster(G, roster, "hbt");
        G.camSpan = 15;
        G.cam.span = 15;
        const off = drift(ctx, W(-92, 6), W(-74, 3), 30);
        audio.startBed("georgia");
        music.sting("arrival");
        await ui.card({
          kicker: "Toccoa, Georgia · Julio de 1942",
          title: "Queremos esas alas",
          text: [
            "Son voluntarios. Hijos de la Depresión: granjeros, mineros, estudiantes, muchachos que nunca han salido de su condado. El ejército les ha prometido el entrenamiento más duro que existe, y la paga extra de cincuenta dólares al mes por saltar desde un avión.",
            "El campamento es un puñado de barracones de papel alquitranado sobre arcilla roja, una torre de saltos de diez metros y, encima de todo, una colina de casi trescientos metros. Se llama Currahee.",
            "Ciento cuarenta hombres forman la Compañía E, 2.º Batallón, 506.º Regimiento de Infantería Paracaidista. Su jefe es el teniente Herbert Sobel.",
          ],
          next: "Formar",
        });
        audio.paper();
        await G.wait(0.5);
        await G.lines([
          ["Sobel", "Compañía E. Aquí no se viene a pasear. Aquí se viene a ganarse las alas.", 3.2],
          ["Sobel", "El que no quiera estar, que lo diga ahora. Nadie se lo va a reprochar.", 3],
        ]);
        await G.wait(0.6);
        await G.lines([["Tipper", "(en voz baja) Apuesto a que cuando hayamos acabado el entrenamiento, lo último que nos harán hacer será subir a la cima de esa montaña.", 3.8]]);
        await G.wait(0.4);
        audio.whistle(...W(-75.5, 8.2), true);
        await G.lines([["Sobel", "¡Botas y pantalones cortos! ¡Formados en cinco minutos!", 2.4]]);
        off();
        return {};
      },
    },
    {
      id: "subida-1",
      mode: "action",
      place: "toccoa",
      music: { theme: "drive", level: 0.4 },
      async run(ctx) {
        const res = await currahee(ctx, { variant: "first", pace: 3.0, drain: 0.9 });
        if (res.retry) return res;
        ctx.flags.run1 = { lost: res.lost.length, helped: res.helped.length };
        return res;
      },
    },
    {
      id: "semanas",
      mode: "narrative",
      place: "toccoa",
      music: { theme: "camp", level: 0.3 },
      async run(ctx) {
        const { G, ui, roster, flags, audio } = ctx;
        muster(G, roster, "hbt");
        const off = drift(ctx, W(-66, 4), W(-58, 2), 14);
        G.camSpan = 17;
        const r1 = flags.run1 || { lost: 0, helped: 0 };
        const left = roster.activeRecruits().length;
        await ui.card({
          kicker: "Toccoa · Agosto de 1942",
          title: "Tres millas arriba, tres abajo",
          text: [
            `Aquel primer día la compañía perdió a varios hombres. ${r1.lost ? `De los reclutas que corrían contigo, ${r1.lost} ${r1.lost === 1 ? "subió" : "subieron"} a la ambulancia.` : "De los que corrían contigo, ninguno subió a la ambulancia."} ${r1.helped ? `Volviste por ${r1.helped} ${r1.helped === 1 ? "hombre" : "hombres"}; ellos no lo olvidarán.` : ""}`,
            "Una semana más tarde ya corrían todo el camino de ida y vuelta. Después, tres o cuatro veces por semana, hasta cubrir los nueve kilómetros en cincuenta minutos. Y cada día la pista de obstáculos, las flexiones, las marchas nocturnas sin agua ni cigarrillos, con Sobel comprobando al final que las cantimploras siguieran llenas.",
            `Quedan ${left} de los reclutas sin nombre de tu pelotón. A los hombres les dijeron que Currahee era una palabra india que significaba «estar solo». Se convirtió en el grito de guerra del 506.º.`,
          ],
          next: "Seguir",
        });
        audio.paper();
        off();
        return {};
      },
    },
    {
      id: "espaguetis",
      mode: "narrative",
      place: "toccoa",
      music: { theme: "camp", level: 0.35 },
      async run(ctx) {
        const { G, ui, audio, flags } = ctx;
        const off = drift(ctx, W(-56, -22), W(-50, -28), 10);
        G.camSpan = 15;
        const v = await ui.card({
          kicker: "Final de la segunda semana",
          title: "«Tranquilos. Hoy no correremos»",
          text: "Los llevan al comedor y les sirven unos espaguetis estupendos para el almuerzo. Hay pan, hay más fuentes en camino. Nadie se fía de Sobel, pero la comida está caliente y llevan dos semanas corriendo.",
          choices: [
            { label: "Repetir plato", sub: "Te lo has ganado. Y quién sabe cuándo vuelve a haber.", value: "ate" },
            { label: "Comer poco", sub: "Algo huele raro en tanta generosidad.", value: "little" },
          ],
        });
        flags.ate = v === "ate";
        audio.pencil();
        off();
        G.lines([[flags.ate ? "Guarnere" : "Lipton", flags.ate ? "Si esto es el ejército, me quedo a vivir aquí." : "Mi teniente, ¿no le parece demasiado bonito?", 2.6]]);
        await G.wait(2.8);
        audio.whistle(...W(-50, -28), true);
        return {};
      },
    },
    {
      id: "subida-2",
      mode: "action",
      place: "toccoa",
      music: { theme: "drive", level: 0.55 },
      async run(ctx) {
        const res = await currahee(ctx, { variant: "spaghetti", pace: 3.35, drain: 1.15, ate: ctx.flags.ate });
        if (res.retry) return res;
        ctx.flags.run2 = { lost: res.lost.length, helped: res.helped.length };
        return res;
      },
    },
    {
      id: "cierre",
      mode: "narrative",
      place: "toccoa",
      music: { theme: "calm", level: 0.3 },
      async run(ctx) {
        const { G, ui, roster, flags, music } = ctx;
        muster(G, roster, "pt");
        G.camSpan = 22;
        const off = drift(ctx, W(-70, 2), W(40, 4), 30);
        const r2 = flags.run2 || { lost: 0, helped: 0 };
        const left = roster.activeRecruits().length;
        music.sting("summit");
        await ui.card({
          kicker: "Toccoa · Otoño de 1942",
          title: "Sobrevivir a Sobel",
          text: [
            `Subieron y bajaron Currahee con un par de ambulancias detrás y los hombres vomitando espaguetis por todo el camino. Los que aceptaron la invitación de los médicos fueron expulsados aquel mismo día. ${r2.lost ? `De tu pelotón, ${r2.lost} más.` : "De tu pelotón, nadie."}`,
            "Sobel quería que su compañía fuese la mejor del regimiento, y para eso le exigía más que nadie. Negaba los permisos por «orejas sucias». Los hombres lo odiaban, y ese odio común los unió. Sobrevivir a Sobel fue la primera prueba de la Compañía E.",
            `Siguen en pie ${left} reclutas de los doce con los que empezaste. Lo que entrenaste aquí se notará en Normandía.`,
          ],
          next: "Seguir",
        });
        await ui.card({
          kicker: "Fin de la ronda 1",
          title: "Continuará en Toccoa",
          text: "Lo que viene en este capítulo: el horario de la semana y los permisos de Sobel, la pista de obstáculos y el campo de tiro, las maniobras nocturnas, la casa de prácticas, los ejercicios de defensa, la marcha a Atlanta y el salto de Fort Benning.",
          next: "Volver al título",
        });
        off();
        return {};
      },
    },
  ],
};
