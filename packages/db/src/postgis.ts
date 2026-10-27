/**
 * Helpers de PostGIS. Kysely no entén PostGIS: tot l'SQL espacial viu aquí (ADR-0013).
 * Les columnes són `geography(Point, 4326)`: graus WGS84 i distàncies en metres.
 * Les funcions de PostGIS són a l'esquema `extensions`, que és al `search_path` per defecte.
 */
import { sql, type Expression, type RawBuilder } from 'kysely';

/** Caixa en graus WGS84. */
export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** Valor `geography` a partir de la longitud i la latitud, per inserir o comparar. */
export function puntDesDeLonLat(lon: number, lat: number): RawBuilder<string> {
  return sql<string>`st_setsrid(st_makepoint(${lon}, ${lat}), 4326)::geography`;
}

/** Longitud (graus) d'una columna o expressió `geography`. */
export function lon(ubicacio: Expression<string>): RawBuilder<number> {
  return sql<number>`st_x(${ubicacio}::geometry)`;
}

/** Latitud (graus) d'una columna o expressió `geography`. */
export function lat(ubicacio: Expression<string>): RawBuilder<number> {
  return sql<number>`st_y(${ubicacio}::geometry)`;
}

/**
 * Cert si el punt és dins de la caixa. Compara com a `geometry`, que per a punts és exacte:
 * amb `geography`, `&&` compara caixes geocèntriques i accepta punts de fora.
 * No fa servir l'índex GIST de la columna (el catàleg és petit, ADR-0012).
 */
export function dinsBbox(ubicacio: Expression<string>, bbox: Bbox): RawBuilder<boolean> {
  const { minLon, minLat, maxLon, maxLat } = bbox;
  return sql<boolean>`${ubicacio}::geometry && st_makeenvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)`;
}

/** Distància en metres entre dues expressions `geography`. */
export function distancia(a: Expression<string>, b: Expression<string>): RawBuilder<number> {
  return sql<number>`st_distance(${a}, ${b})`;
}

/**
 * Cert si `a` és a `metres` o menys de `b`. `st_dwithin` sobre `geography` mesura sobre
 * l'esferoide i fa servir l'índex GIST de la columna.
 */
export function dinsRadi(
  a: Expression<string>,
  b: Expression<string>,
  metres: number,
): RawBuilder<boolean> {
  return sql<boolean>`st_dwithin(${a}, ${b}, ${metres})`;
}
