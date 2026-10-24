// Genera los juegos de un solo archivo en la raíz del repo:
//   dia-d.html            ← src/chapters/dia-d (módulos ES, empaquetados con esbuild) + lib/three-runtime.js
//   hermanos-de-sangre.html ← src/chapters/bastogne/{head.html, game.js, tail.html}
// Uso: npm run build   (una vez)
//      npm run dev     (reconstruye el Día D al guardar cambios en src/)
import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const write = (p, s) => {
  writeFileSync(join(root, p), s);
  console.log(`${p}  ${(s.length / 1024).toFixed(0)} KB`);
};

// Three.js no se importa como módulo: va como script global antes del juego.
function writeDiaD(js) {
  const page = read("src/chapters/dia-d/index.html")
    .replace('<script src="lib/three-runtime.js"></script>', () => `<script>\n${read("lib/three-runtime.js")}\n</script>`)
    .replace('<script src="dia-d.js"></script>', () => `<script>\n${js}\n</script>`);
  write("dia-d.html", page);
}

function writeBastogne() {
  const dir = "src/chapters/bastogne/";
  write("hermanos-de-sangre.html", ["head.html", "game.js", "tail.html"].map((f) => read(dir + f)).join(""));
}

const options = {
  absWorkingDir: root,
  entryPoints: ["src/chapters/dia-d/main.js"],
  bundle: true,
  format: "iife",
  write: false,
  logLevel: "warning",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [
      {
        name: "html",
        setup(b) {
          b.onEnd((r) => r.outputFiles && writeDiaD(r.outputFiles[0].text));
        },
      },
    ],
  });
  await ctx.watch();
  console.log("Vigilando src/ … (Ctrl+C para salir)");
} else {
  const r = await esbuild.build(options);
  writeDiaD(r.outputFiles[0].text);
  writeBastogne();
}
