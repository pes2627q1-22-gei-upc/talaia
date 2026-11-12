/**
 * Genera el contorn de Catalunya de l'API a partir del límit oficial de l'ICGC (TG-130, ADR-0031).
 *
 *   node data/scripts/build-contorn-catalunya.ts              # descarrega i escriu el mòdul de l'API
 *   node data/scripts/build-contorn-catalunya.ts <font.json>  # a partir d'una descàrrega desada
 *
 * Descarrega les províncies del WFS de l'ICGC (uns 3 MB, es desen a `data/raw/`, no versionat),
 * en fa la unió, la simplifica i escriu `services/api/src/visibilitat/contornCatalunya.ts`, que sí
 * que es versiona: el diff de la PR ensenya què ha canviat.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FONT_CONTORN,
  OPCIONS_PER_DEFECTE,
  aModul,
  areaKm2,
  contornCatalunya,
  descarregaProvincies,
} from './contorn-catalunya.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FONT_PER_DEFECTE = resolve(ARREL, 'data/raw/provincies-icgc-50000.json');
export const MODUL_API = resolve(ARREL, 'services/api/src/visibilitat/contornCatalunya.ts');

async function main(): Promise<void> {
  let geojson: unknown;
  if (process.argv[2]) {
    geojson = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
  } else {
    console.log(`Descarregant ${FONT_CONTORN.capa} de ${FONT_CONTORN.wfs}…`);
    geojson = await descarregaProvincies();
    await mkdir(dirname(FONT_PER_DEFECTE), { recursive: true });
    await writeFile(FONT_PER_DEFECTE, JSON.stringify(geojson));
    console.log(`Desat a ${FONT_PER_DEFECTE}.`);
  }
  const contorn = contornCatalunya(geojson);
  const consulta = new Date().toISOString().slice(0, 10);
  await writeFile(
    MODUL_API,
    aModul(contorn, { consulta, toleranciaM: OPCIONS_PER_DEFECTE.toleranciaM }),
  );
  console.log(
    [
      `Escrit ${MODUL_API}:`,
      ...contorn.map(
        (p, i) =>
          `  polígon ${i + 1}: ${areaKm2(p[0]!).toFixed(2)} km², ${p[0]!.length} vèrtexs` +
          (p.length > 1 ? `, ${p.length - 1} forats` : ''),
      ),
    ].join('\n'),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
