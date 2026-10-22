import type { ConsultaRecomanacions, ObjectiuObservacio, Recomanacio } from '@talaia/shared';

import { GRID_GOALS } from '../explore/exploreModel';
import type { MapPoints } from '../map/pointMarkers';

/** Paràmetres de `/recomanacions` tal com els deixa «Què vols veure?»: tot és text a la ruta. */
export type RecommendationParams = Partial<
  Record<'objectiu' | 'lat' | 'lon' | 'data' | 'desDe' | 'finsA' | 'tempsMaxim' | 'lloc', string>
>;

/** Files del full abans de «Veure'ls tots» (mockup 03). */
export const VISIBLE_ROWS = 3;

const GOALS: readonly ObjectiuObservacio[] = [...GRID_GOALS, 'constellacions'];

const isGoal = (value: string | undefined): value is ObjectiuObservacio =>
  GOALS.includes(value as ObjectiuObservacio);

/**
 * La consulta de la ruta, o `null` si no n'hi ha cap («Veure el mapa») o li falta alguna cosa.
 * Els rangs i la franja els valida l'API: aquí només es comprova que hi siguin.
 */
export function parseQuery(params: RecommendationParams): ConsultaRecomanacions | null {
  const { objectiu, data } = params;
  if (!isGoal(objectiu) || !data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const number = (value?: string) => (value ? Number(value) : NaN);
  const query: ConsultaRecomanacions = {
    objectiu,
    origen: { lat: number(params.lat), lon: number(params.lon) },
    data,
    desDe: number(params.desDe),
    finsA: number(params.finsA),
    tempsMaxim: number(params.tempsMaxim),
  };
  const { origen, desDe, finsA, tempsMaxim } = query;
  return [origen.lat, origen.lon, desDe, finsA, tempsMaxim].every(Number.isFinite) ? query : null;
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

const pad = (n: number) => String(n).padStart(2, '0');

/** Hora local d'un instant ISO (com `ConsultaRecomanacions`, el mòbil és a `Europe/Madrid`). */
export function localTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
