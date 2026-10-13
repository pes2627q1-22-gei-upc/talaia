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
 * Les columnes han de coincidir amb la migració de TG-86 (taula punts_observacio).
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

function fila(f: PuntFeature): string {
  const p = f.properties;
  const geom = JSON.stringify({ type: 'Point', coordinates: f.geometry.coordinates });
  return `  (${[
    text(p.slug),
    text(p.nom),
    text(p.municipi),
    text(p.descripcio),
    num(p.altitud),
    array(p.horitzo_obert),
    text(p.accessibilitat),
    `'OFICIAL'`,
    `'PUBLICAT'`,
    `st_setsrid(st_geomfromgeojson(${text(geom)}), 4326)::geography`,
  ].join(', ')})`;
}

export function generarSql(features: PuntFeature[]): string {
  return `-- Generat per data/scripts/build-seed-punts.ts a partir de data/punts_observacio.geojson.
-- No l'editis a mà: canvia el GeoJSON i torna a executar el script. (TG-87)
-- Coordenades: geocodificador de l'ICGC. Punts oficials (sense creador) i publicats.

insert into punts_observacio
  (slug, nom, municipi, descripcio, altitud, horitzo_obert, accessibilitat, origen, estat, ubicacio)
values
${features.map(fila).join(',\n')}
on conflict (slug) do update set
  nom = excluded.nom,
  municipi = excluded.municipi,
  descripcio = excluded.descripcio,
  altitud = excluded.altitud,
  horitzo_obert = excluded.horitzo_obert,
  accessibilitat = excluded.accessibilitat,
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
