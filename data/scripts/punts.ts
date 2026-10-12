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

export function llegirPunts(path: string): PuntsFC {
  return JSON.parse(readFileSync(path, 'utf8')) as PuntsFC;
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
    if (p.altitud === null || p.altitud === undefined) {
      if (exigirAltitud) errors.push(`${id}: falta l'altitud (executa fill-altitudes)`);
    } else if (!Number.isFinite(p.altitud) || p.altitud < -10 || p.altitud > 3200) {
      errors.push(`${id}: altitud fora de rang (${p.altitud})`);
    }
    if (p.horitzo_obert !== null && p.horitzo_obert !== undefined) {
      const dolentes = p.horitzo_obert.filter(
        (d) => !(DIRECCIONS as readonly string[]).includes(d),
      );
      if (dolentes.length)
        errors.push(`${id}: direccions d'horitzó invàlides: ${dolentes.join(', ')}`);
    }
  });
  return errors;
}
