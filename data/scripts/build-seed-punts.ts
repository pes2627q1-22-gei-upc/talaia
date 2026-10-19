/**
 * Genera el seed SQL dels punts d'observació a partir del GeoJSON (TG-87).
 *
 *   node data/scripts/build-seed-punts.ts            # escriu supabase/seeds/01_punts_observacio.sql
 *   node data/scripts/build-seed-punts.ts --check    # valida i comprova que el seed versionat està al dia
 *
 * Node 22 executa TypeScript directament (type stripping), sense dependències.
 * El seed és idempotent: `on conflict (slug) do update`, així `supabase db reset`
 * i un `db push --include-seed` repetit no dupliquen punts.
 *
 * Les columnes han de coincidir amb la taula punts_observacio (migracions de TG-86, TG-97 i TG-116).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llegirPunts, validarPunts, type PuntFeature } from './punts.ts';

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRADA = resolve(ARREL, 'data/punts_observacio.geojson');
const SORTIDA = resolve(ARREL, 'supabase/seeds/01_punts_observacio.sql');

/** Literal SQL de text amb les cometes escapades. */
const text = (v: string | null | undefined): string =>
  v === null || v === undefined ? 'null' : `'${v.replaceAll("'", "''")}'`;

const num = (v: number | null): string => (v === null ? 'null' : String(v));

const array = (v: string[] | null): string =>
  v === null || v.length === 0 ? 'null' : `array[${v.map(text).join(', ')}]::text[]`;

const reals = (v: number[] | null): string =>
  v === null ? 'null' : `array[${v.join(', ')}]::real[]`;

function fila(f: PuntFeature): string {
  const p = f.properties;
  const geom = JSON.stringify({ type: 'Point', coordinates: f.geometry.coordinates });
  return `  (${[
    text(p.slug),
    text(p.nom),
    text(p.municipi),
    text(p.descripcio),
    num(p.altitud),
    num(p.sqm),
    array(p.horitzo_obert),
    text(p.accessibilitat),
    reals(p.horitzo),
    `'OFICIAL'`,
    `'PUBLICAT'`,
    `st_setsrid(st_geomfromgeojson(${text(geom)}), 4326)::geography`,
  ].join(', ')})`;
}

export function generarSql(features: PuntFeature[]): string {
  return `-- Generat per data/scripts/build-seed-punts.ts a partir de data/punts_observacio.geojson.
-- No l'editis a mà: canvia el GeoJSON i torna a executar el script. (TG-87)
-- Coordenades: geocodificador de l'ICGC. Punts oficials (sense creador) i publicats.
-- sqm: brillantor del cel (mag/arcsec²) del mapa de contaminació lumínica de la Generalitat (TG-97).
-- horitzo: alçada aparent de l'horitzó per grau d'azimut, del model d'elevacions de l'ICGC (TG-116).

insert into punts_observacio
  (slug, nom, municipi, descripcio, altitud, sqm, horitzo_obert, accessibilitat, horitzo, origen, estat, ubicacio)
values
${features.map(fila).join(',\n')}
on conflict (slug) do update set
  nom = excluded.nom,
  municipi = excluded.municipi,
  descripcio = excluded.descripcio,
  altitud = excluded.altitud,
  sqm = excluded.sqm,
  horitzo_obert = excluded.horitzo_obert,
  accessibilitat = excluded.accessibilitat,
  horitzo = excluded.horitzo,
  ubicacio = excluded.ubicacio
-- Un punt de la comunitat amb el mateix slug no se sobreescriu.
where punts_observacio.origen = 'OFICIAL';
`;
}

function main(): void {
  const fc = llegirPunts(ENTRADA);
  const errors = validarPunts(fc);
  if (errors.length) {
    console.error(`El catàleg té ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const senseAltitud = fc.features.filter((f) => f.properties.altitud === null).length;
  if (senseAltitud) {
    console.warn(
      `Avís: ${senseAltitud} punts sense altitud. Executa data/scripts/fill-altitudes.ts.`,
    );
  }
  const senseSqm = fc.features.filter((f) => f.properties.sqm === null).length;
  if (senseSqm) {
    console.warn(`Avís: ${senseSqm} punts sense sqm (fora del mapa de contaminació lumínica).`);
  }
  const senseHoritzo = fc.features.filter((f) => f.properties.horitzo === null).length;
  if (senseHoritzo) {
    console.warn(
      `Avís: ${senseHoritzo} punts sense horitzo. Executa data/scripts/fill-horitzo.ts.`,
    );
  }
  const sql = generarSql(fc.features);
  if (process.argv.includes('--check')) {
    if (!existsSync(SORTIDA) || readFileSync(SORTIDA, 'utf8') !== sql) {
      console.error(
        `${SORTIDA} no coincideix amb el GeoJSON. Torna a executar el script sense --check.`,
      );
      process.exit(1);
    }
    console.log(`OK: ${fc.features.length} punts vàlids i el seed està al dia.`);
    return;
  }
  mkdirSync(dirname(SORTIDA), { recursive: true });
  writeFileSync(SORTIDA, sql);
  console.log(`Escrit ${SORTIDA} amb ${fc.features.length} punts.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
