/**
 * Calcula el perfil d'horitzó dels punts del GeoJSON amb el model d'elevacions de l'ICGC (TG-116).
 *
 *   node data/scripts/fill-horitzo.ts            # tots els punts
 *   node data/scripts/fill-horitzo.ts <slug>…    # només aquests
 *
 * Per a cada punt baixa tres finestres del WCS de l'ICGC (prop d'un minut per punt) i les desa a
 * data/raw/met/ com a GeoTIFF (no versionat): la segona vegada el càlcul és instantani, i si una
 * descàrrega falla (el WCS de vegades no respon), n'hi ha prou de tornar-lo a executar. Escriu
 * `horitzo` (360 alçades en graus) a cada punt i diu quins azimuts són un mínim perquè el raig
 * surt de Catalunya per terra. També avisa si `horitzo_obert` diu obert on el relleu tapa i si la
 * cota del model s'allunya de l'`altitud` del catàleg (coordenades sospitoses).
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NIVELLS,
  descarregaFinestra,
  esFinestra,
  finestra,
  perfilHoritzo,
  rangsAzimut,
  type Malla,
} from './horitzo.ts';
import { aGeoTiff, llegirMallaFitxer, utm31 } from './mapa-foscor.ts';
import { DIRECCIONS, llegirPunts, serialitzarPunts, type PuntFeature } from './punts.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FITXER = resolve(ARREL, 'data/punts_observacio.geojson');
const MEMORIA = resolve(ARREL, 'data/raw/met');
/** Alçada mitjana a partir de la qual una direcció d'`horitzo_obert` no sembla oberta. */
const LLINDAR_OBERT = 3;
/** Diferència entre la cota del model i l'`altitud` del catàleg (90 m) que fa sospitar del punt. */
const LLINDAR_COTA = 50;

async function malles(f: PuntFeature): Promise<Malla[]> {
  const [lon, lat] = f.geometry.coordinates;
  const { x, y } = utm31(lat, lon);
  return Promise.all(
    NIVELLS.map(async (nivell) => {
      const esperada = finestra(x, y, nivell);
      const ruta = resolve(MEMORIA, `${f.properties.slug}-${nivell.cela}m.tif`);
      if (existsSync(ruta)) {
        const malla = await llegirMallaFitxer(ruta);
        if (esFinestra(malla, esperada)) return malla;
      }
      const malla = await descarregaFinestra(esperada);
      await writeFile(ruta, Buffer.from(aGeoTiff(malla)));
      return malla;
    }),
  );
}

/** Alçada mitjana de l'horitzó en cada direcció d'`horitzo_obert` que no sembla oberta. */
function obertesTapades(f: PuntFeature, alcades: number[]): string[] {
  return (f.properties.horitzo_obert ?? []).flatMap((direccio) => {
    const centre = DIRECCIONS.indexOf(direccio) * 45;
    const sector = Array.from({ length: 45 }, (_, i) => alcades[(centre - 22 + i + 360) % 360]!);
    const mitjana = sector.reduce((s, v) => s + v, 0) / sector.length;
    return mitjana > LLINDAR_OBERT ? [`${direccio} ${mitjana.toFixed(1)}°`] : [];
  });
}

async function main(): Promise<void> {
  const fc = llegirPunts(FITXER);
  const slugs = process.argv.slice(2);
  const triats = slugs.length
    ? fc.features.filter((f) => slugs.includes(f.properties.slug))
    : fc.features;
  if (triats.length !== (slugs.length || fc.features.length)) {
    throw new Error(`Algun slug no és al catàleg: ${slugs.join(', ')}`);
  }
  await mkdir(MEMORIA, { recursive: true });
  for (const f of triats) {
    const [lon, lat] = f.geometry.coordinates;
    const { alcades, incomplets, cota } = perfilHoritzo(lat, lon, await malles(f));
    f.properties = { ...f.properties, horitzo: alcades };
    const maxim = Math.max(...alcades);
    const { altitud } = f.properties;
    const tapades = obertesTapades(f, alcades);
    const avisos = [
      altitud !== null &&
        Math.abs(cota - altitud) > LLINDAR_COTA &&
        `la cota del model i l'altitud difereixen més de ${LLINDAR_COTA} m: revisa les coordenades`,
      incomplets.length && `mínim cap a ${rangsAzimut(incomplets)} (fora de Catalunya)`,
      tapades.length && `horitzo_obert diu obert però hi ha relleu: ${tapades.join(', ')}`,
    ].filter(Boolean);
    console.log(
      [
        f.properties.nom,
        `cota ${Math.round(cota)} m (altitud ${altitud ?? '—'} m)`,
        `màx ${maxim}° a ${alcades.indexOf(maxim)}°`,
        `mitjana ${(alcades.reduce((s, v) => s + v, 0) / 360).toFixed(1)}°`,
        ...avisos,
      ].join('\t'),
    );
  }
  await writeFile(FITXER, serialitzarPunts(fc));
  console.log(`\nPerfil d'horitzó calculat per a ${triats.length} punts. Torna a generar el seed.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
