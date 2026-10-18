/**
 * Omple la foscor del cel (`sqm`) de tots els punts del GeoJSON a partir del GeoTIFF del mapa de
 * contaminació lumínica (TG-97). Abans cal haver-lo generat amb build-mapa-foscor.ts.
 *
 *   node data/scripts/fill-sqm.ts                    # llegeix data/raw/mapa-sqm-2024.tif
 *   node data/scripts/fill-sqm.ts <ruta del GeoTIFF>
 *
 * El mapa és estàtic: es recalculen tots els punts cada vegada, i el script diu quins canvien.
 * Si un punt cau en un forat de la malla (la font només té cel·les sobre terra: un far o una barra
 * de sorra en poden quedar fora) s'agafa la cel·la més propera fins a 2 km i s'avisa; si no n'hi
 * ha cap, queda `null` i la fórmula de l'índex fa servir la foscor estimada (ADR-0018).
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GEOTIFF_PER_DEFECTE } from './build-mapa-foscor.ts';
import { llegirMallaFitxer, sqmProper } from './mapa-foscor.ts';
import { llegirPunts, serialitzarPunts, type PuntProps } from './punts.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FITXER = resolve(ARREL, 'data/punts_observacio.geojson');

const dosDecimals = (x: number): number => Math.round(x * 100) / 100;

/** Les mateixes propietats amb l'`sqm` just després de l'`altitud`, perquè el GeoJSON es llegeixi bé. */
function ambSqm(p: PuntProps, sqm: number | null): PuntProps {
  const entrades = Object.entries(p).filter(([clau]) => clau !== 'sqm');
  entrades.splice(entrades.findIndex(([clau]) => clau === 'altitud') + 1, 0, ['sqm', sqm]);
  return Object.fromEntries(entrades) as PuntProps;
}

async function main(): Promise<void> {
  const malla = await llegirMallaFitxer(resolve(process.argv[2] ?? GEOTIFF_PER_DEFECTE));
  const fc = llegirPunts(FITXER);
  let canvis = 0;
  for (const f of fc.features) {
    const [lon, lat] = f.geometry.coordinates;
    const proper = sqmProper(malla, lat, lon);
    const sqm = proper ? dosDecimals(proper.sqm) : null;
    if (sqm !== f.properties.sqm) canvis++;
    f.properties = ambSqm(f.properties, sqm);
    const nota =
      proper === null
        ? '\tsense cel·la a menys de 2 km: queda null'
        : proper.distancia > 0
          ? `\tcel·la més propera, a ${Math.round(proper.distancia)} m`
          : '';
    console.log(`${sqm ?? '—'}\t${f.properties.nom}${nota}`);
  }
  writeFileSync(FITXER, serialitzarPunts(fc));
  console.log(
    `\nSQM calculat per a ${fc.features.length} punts (${canvis} canvis). Torna a generar el seed.`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
