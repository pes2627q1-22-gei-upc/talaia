import type {
  ConsultaRecomanacions,
  ObjectiuObservacio,
  ParametresRecomanacions,
  Recomanacio,
} from '@talaia/shared';

import { GRID_GOALS } from '../explore/exploreModel';
import type { MapPoints } from '../map/pointMarkers';
import { twoDigitHours } from '../point/pointModel';

/**
 * Paràmetres de `/recomanacions` tal com els deixen «Què vols veure?» i «A prop meu»: tot és text
 * a la ruta. `aprop` diu d'on surt el rànquing «A prop meu» (HU02): `aqui`, la ubicació actual, o
 * `triat`, un lloc tocat al mapa.
 */
export type RecommendationParams = Partial<
  Record<
    'objectiu' | 'lat' | 'lon' | 'data' | 'desDe' | 'finsA' | 'tempsMaxim' | 'lloc' | 'aprop',
    string
  >
>;

export type NearbyOrigin = 'aqui' | 'triat';

/** Files del full abans de «Mostra'ls tots» (mockup 03). */
export const VISIBLE_ROWS = 3;

const GOALS: readonly ObjectiuObservacio[] = [...GRID_GOALS, 'constellacions'];

const isGoal = (value: string | undefined): value is ObjectiuObservacio =>
  GOALS.includes(value as ObjectiuObservacio);

/**
 * La consulta de la ruta, o `null` si no n'hi ha cap («Mostra el mapa») o li falta alguna cosa.
 * «A prop meu» només envia l'origen: la resta la tria l'API (TG-133). Els rangs i la franja els
 * valida l'API: aquí només es comprova que hi siguin.
 */
export function parseQuery(params: RecommendationParams): ParametresRecomanacions | null {
  const number = (value?: string) => (value ? Number(value) : Number.NaN);
  const origen = { lat: number(params.lat), lon: number(params.lon) };
  if (nearbyOrigin(params)) {
    return Number.isFinite(origen.lat) && Number.isFinite(origen.lon) ? { origen } : null;
  }
  const { objectiu, data } = params;
  if (!isGoal(objectiu) || !data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const query: ConsultaRecomanacions = {
    objectiu,
    origen,
    data,
    desDe: number(params.desDe),
    finsA: number(params.finsA),
    tempsMaxim: number(params.tempsMaxim),
  };
  const { desDe, finsA, tempsMaxim } = query;
  return [origen.lat, origen.lon, desDe, finsA, tempsMaxim].every(Number.isFinite) ? query : null;
}

/**
 * Context de i18next per a la «de» catalana: s'apostrofa davant de vocal o hac (Igualada, Horta) i
 * de l'u i l'onze («a menys d'1 h»). Els altres idiomes no tenen la variant i fan servir la base.
 */
export function elision(text: string): 'vowel' | undefined {
  return /^(h?[aeiouàèéíïòóúü]|11?(?!\d))/i.test(text) ? 'vowel' : undefined;
}

/** D'on surt un rànquing «A prop meu», o `null` si la ruta és una cerca de «Què vols veure?». */
export function nearbyOrigin(params: RecommendationParams): NearbyOrigin | null {
  return params.aprop === 'aqui' || params.aprop === 'triat' ? params.aprop : null;
}

/** Els punts del rànquing com a marcadors: el número del mapa és el de la fila (la millor hora). */
export function toMapPoints(punts: Recomanacio[]): MapPoints {
  return {
    type: 'FeatureCollection',
    features: punts.map(({ id, nom, municipi, lat, lon, millorHora }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id,
        nom,
        municipi,
        index: millorHora ? { valor: millorHora.valor, franja: millorHora.franja } : null,
      },
    })),
  };
}

const catalanTime = new Intl.DateTimeFormat('ca', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Hora de Catalunya d'un instant ISO, com la fitxa del punt, sigui on sigui el mòbil. */
export function localTime(iso: string): string {
  return twoDigitHours(catalanTime.format(new Date(iso)));
}

/** Posició del rànquing en cada idioma: 1r, 2n, 3r, 4t, 5è · 1.º · 1st, 2nd, 3rd, 4th. */
export function ordinal(position: number, language: string): string {
  if (language.startsWith('es')) return `${position}.º`;
  if (language.startsWith('en')) {
    const tens = position % 100;
    const suffix =
      tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][position % 10] ?? 'th');
    return `${position}${suffix}`;
  }
  const catalan: Record<number, string> = { 1: 'r', 2: 'n', 3: 'r', 4: 't' };
  return `${position}${catalan[position] ?? 'è'}`;
}

/** La zona que conté els punts i l'origen: `[[oest, sud], [est, nord]]`, per enquadrar-hi el mapa. */
export function boundsOf(
  places: { lat: number; lon: number }[],
): [[number, number], [number, number]] | null {
  if (places.length === 0) return null;
  const lons = places.map((place) => place.lon);
  const lats = places.map((place) => place.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
