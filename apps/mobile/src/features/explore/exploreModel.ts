import type { ObjectiuObservacio } from '@talaia/shared';

/** Els sis de la graella (mockup 02), en ordre. Constel·lacions va a part, en una fila ampla. */
export const GRID_GOALS = [
  'pluja_estels',
  'eclipsi',
  'via_lactia',
  'posta_sol',
  'sortida_sol',
  'cel_estrellat',
] as const satisfies readonly ObjectiuObservacio[];

/** Encara «Aviat»: l'índex v1 no hi val (a la posta i a l'eclipsi solar dona 0) fins a l'ADR-0027. */
export const SOON_GOALS: readonly ObjectiuObservacio[] = ['eclipsi', 'posta_sol', 'sortida_sol'];

/** Temps màxim en cotxe, en minuts: de 30 min a 4 h, de 15 en 15. Per defecte, 2 h 30 min. */
export const TRAVEL = { min: 30, max: 240, step: 15, initial: 150 } as const;

/** Franja per defecte: de 22:00 a 06:00, el gruix de la nit fosca a la tardor. */
export const DEFAULT_RANGE = { from: 22, to: 6 } as const;

/** Fins on arriba el calendari de «Tria el dia»: un any (els eclipsis s'anuncien amb mesos). */
export const CALENDAR_DAYS = 365;

/** Les hores de les rodes de la franja horària. */
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Abans d'aquesta hora, «aquesta nit» és la que va començar ahir al vespre. */
const NIGHT_ENDS_AT = 6;

export const DAY_CHOICES = ['tonight', 'tomorrow', 'pick'] as const;
export type DayChoice = (typeof DAY_CHOICES)[number];
export type Greeting = 'morning' | 'afternoon' | 'night';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local (`YYYY-MM-DD`) de la nit en curs o de la que ve. */
export function nightOf(now: Date): string {
  const day = new Date(now);
  if (day.getHours() < NIGHT_ENDS_AT) day.setDate(day.getDate() - 1);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Suma dies a una data `YYYY-MM-DD` (amb aritmètica UTC: cap canvi d'hora no hi interfereix). */
export function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T12:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Dia de la setmana d'una data `YYYY-MM-DD` (0 = diumenge) i el dia del mes. */
export function dayParts(date: string): { weekday: number; day: number } {
  const utc = new Date(`${date}T12:00:00Z`);
  return { weekday: utc.getUTCDay(), day: utc.getUTCDate() };
}

export function greetingFor(now: Date): Greeting {
  const hour = now.getHours();
  if (hour >= NIGHT_ENDS_AT && hour < 14) return 'morning';
  if (hour >= 14 && hour < 21) return 'afternoon';
  return 'night';
}

export const formatHour = (hour: number) => `${pad(hour)}:00`;

/** Mou una hora endavant o enrere, donant la volta a mitjanit. */
export const stepHour = (hour: number, delta: number) => (((hour + delta) % 24) + 24) % 24;

/** Hores que dura la franja (si acaba l'endemà, passa de mitjanit). */
export const rangeHours = (from: number, to: number) => (to - from + 24) % 24;

export function travelParts(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/**
 * Coordenada amb 3 decimals (~100 m): per triar punts a hores de cotxe n'hi ha prou, i la posició
 * exacta de l'usuari no acaba a la URL ni als logs de l'API.
 */
export const roundCoord = (degrees: number) => Math.round(degrees * 1000) / 1000;
