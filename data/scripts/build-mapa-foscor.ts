/**
 * Descarrega el mapa de contaminació lumínica de la Generalitat i el desa com a GeoTIFF (TG-97).
 *
 *   node data/scripts/build-mapa-foscor.ts            # escriu data/raw/mapa-sqm-2024.tif
 *   node data/scripts/build-mapa-foscor.ts <sortida>  # a un altre lloc
 *
 * La font és la capa WFS `ATMOSFERA_MAPA_SQM_2024` (malla d'1 km amb la brillantor del cel al
 * zenit en mag/arcsec²); el GeoTIFF resultant (una banda Float32, EPSG:25831, ~270 KB) no es
 * versiona (`data/raw/` és al .gitignore): es regenera amb aquest script. Després,
 * fill-sqm.ts el consulta per omplir l'`sqm` de cada punt del catàleg.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_SQM, SENSE_DADA, aGeoTiff, descarregaCeles, rasteritza } from './mapa-foscor.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const GEOTIFF_PER_DEFECTE = resolve(ARREL, 'data/raw/mapa-sqm-2024.tif');

async function main(): Promise<void> {
  const sortida = resolve(process.argv[2] ?? GEOTIFF_PER_DEFECTE);
  console.log(`Descarregant ${FONT_SQM.capa} de ${FONT_SQM.wfs}…`);
  const celes = await descarregaCeles();
  const malla = rasteritza(celes);
  const sqms = celes.map((c) => c.sqm);
  const geotiff = aGeoTiff(malla);
  await mkdir(dirname(sortida), { recursive: true });
  await writeFile(sortida, Buffer.from(geotiff));
  const plenes = malla.valors.filter((v) => v !== SENSE_DADA).length;
  console.log(
    [
      `Escrit ${sortida} (${(geotiff.byteLength / 1024).toFixed(0)} KB).`,
      `Malla de ${malla.columnes} × ${malla.files} cel·les d'${malla.costat} m en EPSG:${FONT_SQM.epsg};`,
      `origen (${malla.x0}, ${malla.y0}); ${plenes} cel·les amb dada.`,
      `SQM de ${Math.min(...sqms).toFixed(2)} a ${Math.max(...sqms).toFixed(2)} mag/arcsec².`,
    ].join('\n'),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
