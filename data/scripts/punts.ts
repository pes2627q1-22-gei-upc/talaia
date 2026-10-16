/**
 * Lectura i validació del catàleg de punts d'observació (TG-87, P13).
 * Font de veritat: data/punts_observacio.geojson (WGS84, [lon, lat]).
 */
import { readFileSync } from 'node:fs';

export const DIRECCIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Direccio = (typeof DIRECCIONS)[number];

export type PuntProps = {
  slug: string;
  nom: string;
  municipi: string;
  descripcio: string;
  /** Metres sobre el nivell del mar. `null` fins que s'executa fill-altitudes. */
  altitud: number | null;
  /** Direccions amb l'horitzó obert (aproximat). El perfil real el calcula TG-116. */
  horitzo_obert: Direccio[] | null;
  /**
   * Brillantor del cel al zenit en mag/arcsec² (SQM) segons el mapa de contaminació lumínica de la
   * Generalitat, amb 2 decimals; com més alt, més fosc. `null` si el punt és fora del mapa.
   * S'omple amb fill-sqm.ts (TG-97).
   */
  sqm: number | null;
  accessibilitat: string | null;
  /** Traçabilitat de les coordenades. No va a la base de dades. */
  font_coordenades?: string;
};

export type PuntFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: PuntProps;
};

export type PuntsFC = { type: 'FeatureCollection'; features: PuntFeature[] };

/** Caixa que conté Catalunya amb marge. Detecta lon/lat intercanviades. */
const CATALUNYA = { minLon: 0.15, maxLon: 3.35, minLat: 40.5, maxLat: 42.9 };
export const MINIM_PUNTS = 30;
/** Rang plausible de l'SQM al mapa de la Generalitat (de 14 a 21,7 el 2024). */
export const SQM = { min: 10, max: 23 };

export function llegirPunts(path: string): PuntsFC {
  return JSON.parse(readFileSync(path, 'utf8')) as PuntsFC;
}

/** Text del GeoJSON tal com el deixa Prettier: les llistes de valors simples en una sola línia. */
export function serialitzarPunts(fc: PuntsFC): string {
  const text = JSON.stringify(fc, null, 2).replace(
    /\[\n\s+([^[\]{}]*?)\n\s+\]/g,
    (_, dins: string) => {
      return `[${dins.split(/,\n\s+/).join(', ')}]`;
    },
  );
  return `${text}\n`;
}

/** Retorna la llista d'errors (buida si el catàleg és vàlid). */
export function validarPunts(fc: PuntsFC, { exigirAltitud = false } = {}): string[] {
  const errors: string[] = [];
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    return ['El fitxer no és un FeatureCollection'];
  }
  if (fc.features.length < MINIM_PUNTS) {
    errors.push(`Calen com a mínim ${MINIM_PUNTS} punts i n'hi ha ${fc.features.length}`);
  }
  const slugs = new Set<string>();
  fc.features.forEach((f, i) => {
    const p = f.properties ?? ({} as PuntProps);
    const id = p.slug ?? `#${i}`;
    if (f.geometry?.type !== 'Point') errors.push(`${id}: la geometria ha de ser un Point`);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      errors.push(`${id}: coordenades no numèriques`);
    } else if (
      lon < CATALUNYA.minLon ||
      lon > CATALUNYA.maxLon ||
      lat < CATALUNYA.minLat ||
      lat > CATALUNYA.maxLat
    ) {
      errors.push(`${id}: [${lon}, ${lat}] és fora de Catalunya (lon i lat intercanviades?)`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug ?? '')) errors.push(`${id}: slug invàlid`);
    if (slugs.has(p.slug)) errors.push(`${id}: slug repetit`);
    slugs.add(p.slug);
    for (const camp of ['nom', 'municipi', 'descripcio'] as const) {
      if (!p[camp]?.trim()) errors.push(`${id}: falta ${camp}`);
    }
    if (p.altitud === undefined) {
      errors.push(`${id}: falta la propietat altitud (null si encara no se sap)`);
    } else if (p.altitud === null) {
      if (exigirAltitud) errors.push(`${id}: falta l'altitud (executa fill-altitudes)`);
    } else if (!Number.isInteger(p.altitud) || p.altitud < -10 || p.altitud > 3200) {
      errors.push(`${id}: l'altitud ha de ser un enter entre -10 i 3200 (${p.altitud})`);
    }
    if (p.sqm === undefined) {
      errors.push(
        `${id}: falta la propietat sqm (null si és fora del mapa de contaminació lumínica)`,
      );
    } else if (p.sqm !== null) {
      if (typeof p.sqm !== 'number' || p.sqm < SQM.min || p.sqm > SQM.max) {
        errors.push(`${id}: l'sqm ha de ser un nombre entre ${SQM.min} i ${SQM.max} (${p.sqm})`);
      } else if (Math.round(p.sqm * 100) !== p.sqm * 100) {
        errors.push(`${id}: l'sqm ha de tenir com a màxim 2 decimals (${p.sqm})`);
      }
    }
    if (p.horitzo_obert === undefined) {
      errors.push(`${id}: falta la propietat horitzo_obert (null si no és clar)`);
    } else if (p.horitzo_obert !== null && !Array.isArray(p.horitzo_obert)) {
      errors.push(`${id}: horitzo_obert ha de ser una llista de direccions o null`);
    } else if (p.horitzo_obert !== null) {
      const dolentes = p.horitzo_obert.filter(
        (d) => !(DIRECCIONS as readonly string[]).includes(d),
      );
      if (dolentes.length)
        errors.push(`${id}: direccions d'horitzó invàlides: ${dolentes.join(', ')}`);
    }
  });
  return errors;
}
