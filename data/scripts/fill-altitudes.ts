/**
 * Omple l'altitud dels punts del GeoJSON que encara no en tenen (TG-87).
 *
 *   node data/scripts/fill-altitudes.ts           # només els punts amb altitud null
 *   node data/scripts/fill-altitudes.ts --force   # recalcula-les totes
 *
 * Font: API d'elevació d'Open-Meteo (model Copernicus DEM, 90 m), una sola petició
 * per a tots els punts. És prou precisa per a la fitxa del punt; el perfil d'horitzó
 * fi (TG-116) farà servir el model d'elevacions de 5 m de l'ICGC.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llegirPunts, serialitzarPunts } from './punts.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FITXER = resolve(ARREL, 'data/punts_observacio.geojson');
const API = 'https://api.open-meteo.com/v1/elevation';
const MAX_PER_PETICIO = 100;

async function main(): Promise<void> {
  const fc = llegirPunts(FITXER);
  const force = process.argv.includes('--force');
  const pendents = fc.features.filter((f) => force || f.properties.altitud === null);
  if (!pendents.length) {
    console.log('Tots els punts ja tenen altitud.');
    return;
  }
  for (let i = 0; i < pendents.length; i += MAX_PER_PETICIO) {
    const lot = pendents.slice(i, i + MAX_PER_PETICIO);
    const url = new URL(API);
    url.searchParams.set('latitude', lot.map((f) => f.geometry.coordinates[1]).join(','));
    url.searchParams.set('longitude', lot.map((f) => f.geometry.coordinates[0]).join(','));
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Open-Meteo ha respost ${resposta.status}`);
    const { elevation } = (await resposta.json()) as { elevation: number[] };
    if (elevation?.length !== lot.length) throw new Error("Resposta inesperada d'Open-Meteo");
    lot.forEach((f, j) => {
      const metres = elevation[j];
      if (typeof metres !== 'number')
        throw new Error(`Open-Meteo no ha tornat l'altitud del punt ${j}`);
      f.properties.altitud = Math.round(metres);
    });
  }
  writeFileSync(FITXER, serialitzarPunts(fc));
  for (const f of pendents) console.log(`${f.properties.altitud} m\t${f.properties.nom}`);
  console.log(`\nAltitud omplerta per a ${pendents.length} punts. Revisa que siguin raonables.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
