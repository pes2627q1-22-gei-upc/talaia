import type { Esdeveniment, Pla, PlaNou } from '@talaia/shared';

import { ACCOUNT_BLOCKED } from '@/core/api/accountBlocked';
import { ApiError } from '@/core/api/httpClient';
import { cataloniaDate } from '@/features/calendar/calendarModel';
import { addDays } from '@/features/explore/exploreModel';

/** Sortida per defecte quan la fitxa no proposa cap franja: a les 22:00, com «Què vols veure?». */
export const DEFAULT_DEPARTURE_HOUR = 22;

/** Les rodes de l'hora de sortida: hores senceres i minuts de 5 en 5. */
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

/** Límit de les notes, el mateix que valida l'API (TG-156). */
export const NOTES_MAX = 1000;

/** El selector de fenòmens ensenya els del dia triat, el d'abans i el de després. */
export const EVENT_WINDOW_DAYS = 1;

export type Departure = { date: string; hour: number; minute: number };

const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

/** Data local (`YYYY-MM-DD`) d'un instant, a la zona del mòbil. */
export function localDate(instant: Date): string {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

/**
 * Dia i hora que l'usuari tria (hora del mòbil, com la resta de l'app: `exploreModel.ts`) en ISO
 * 8601 UTC, el format que espera `POST /plans`. Fa servir la zona del dispositiu, de manera que
 * un mòbil a Catalunya passa 23:15 a 22:15Z a l'hivern i a 21:15Z a l'estiu.
 */
export function localToIso(date: string, hour: number, minute = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute).toISOString();
}

export const departureIso = ({ date, hour, minute }: Departure) => localToIso(date, hour, minute);

export function isFuture(iso: string, now: number = Date.now()): boolean {
  return Date.parse(iso) > now;
}

/** Arrodoneix cap amunt als 5 minuts de les rodes. */
function roundUpToStep(instant: Date): Date {
  const rounded = new Date(instant);
  rounded.setSeconds(0, 0);
  const extra = rounded.getMinutes() % 5;
  if (extra || instant.getSeconds() || instant.getMilliseconds()) {
    rounded.setMinutes(rounded.getMinutes() - extra + 5);
  }
  return rounded;
}

const toDeparture = (instant: Date): Departure => ({
  date: localDate(instant),
  hour: instant.getHours(),
  minute: instant.getMinutes(),
});

/**
 * Sortida per defecte: el començament de la millor franja de la fitxa (`inici`, en ISO) si encara
 * no ha passat; si no, avui a les 22:00; i si ja són més de les 22:00, la propera hora en punt.
 */
export function initialDeparture(inici: string | undefined, now: Date = new Date()): Departure {
  if (inici && Number.isFinite(Date.parse(inici)) && isFuture(inici, now.getTime())) {
    return toDeparture(roundUpToStep(new Date(inici)));
  }
  const tonight = new Date(now);
  tonight.setHours(DEFAULT_DEPARTURE_HOUR, 0, 0, 0);
  if (tonight.getTime() > now.getTime()) return toDeparture(tonight);
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return toDeparture(nextHour);
}

/** Una sortida arrodonida cap amunt queda menys d'un pas (5 minuts) després de l'`inici` original. */
const STEP_MS = 5 * 60 * 1000;

/**
 * Durada de la franja que la fitxa proposa (de la sortida inicial a `fi`), perquè el pla conservi
 * el final encara que l'usuari mogui la sortida. `null` si no hi ha `fi`, si la sortida no surt de
 * la franja (l'`inici` ja havia passat) o si el final no queda després de la sortida.
 */
export function initialDuration(
  departure: Departure,
  inici: string | undefined,
  fi: string | undefined,
): number | null {
  if (!inici || !fi) return null;
  const start = Date.parse(departureIso(departure));
  const from = Date.parse(inici);
  const end = Date.parse(fi);
  if (!Number.isFinite(from) || !Number.isFinite(end)) return null;
  if (start < from || start - from >= STEP_MS) return null;
  return end > start ? end - start : null;
}

/** Dies (`YYYY-MM-DD`, hora de Catalunya, com `/esdeveniments`) que es demanen per a una data. */
export function eventWindow(date: string) {
  return { from: addDays(date, -EVENT_WINDOW_DAYS), to: addDays(date, EVENT_WINDOW_DAYS) };
}

/**
 * Un fenomen val per a un dia si el seu interval toca la finestra d'aquell dia. Quan l'usuari
 * canvia el dia, un fenomen que hi queda fora es treu: no té sentit desar «Oriònides» al gener.
 */
export function eventFitsDay(event: Pick<Esdeveniment, 'inici' | 'fi'>, date: string): boolean {
  const { from, to } = eventWindow(date);
  return cataloniaDate(event.inici) <= to && cataloniaDate(event.fi) >= from;
}

/** Notes sense espais als extrems; buides, `null`. */
export function cleanNotes(notes: string): string | null {
  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

/**
 * Cos de `POST /plans`. El final és la sortida més la durada de la franja (`initialDuration`): si
 * l'usuari mou la sortida, el final es mou igual. El calendari del mòbil és la TG-158: de moment,
 * sempre `null`.
 */
export function buildNewPlan(input: {
  puntId: string;
  esdevenimentId: string | null;
  departure: Departure;
  durationMs: number | null;
  notes: string;
}): PlaNou {
  const dataHoraInici = departureIso(input.departure);
  const dataHoraFi =
    input.durationMs !== null && input.durationMs > 0
      ? new Date(Date.parse(dataHoraInici) + input.durationMs).toISOString()
      : null;
  return {
    puntId: input.puntId,
    esdevenimentId: input.esdevenimentId,
    dataHoraInici,
    dataHoraFi,
    calendariEventId: null,
    notes: cleanNotes(input.notes),
  };
}

export type PlanErrorKey = 'alreadyExists' | 'limitReached' | 'pointGone' | 'generic';

/**
 * Text de l'error del `POST /plans`. `account_blocked` el pinta `AccountBlockedScreen` (TG-179);
 * `validation_error`, `event_not_found`, `profile_not_found` i els errors de xarxa no haurien de
 * passar amb el formulari validat, i surten amb el text genèric.
 */
export function planErrorKey(error: unknown): PlanErrorKey | null {
  if (!(error instanceof ApiError)) return 'generic';
  switch (error.code) {
    case ACCOUNT_BLOCKED:
      return null;
    case 'plan_already_exists':
      return 'alreadyExists';
    case 'plan_limit_reached':
      return 'limitReached';
    case 'punt_not_found':
      return 'pointGone';
    default:
      return 'generic';
  }
}

/** `/esdeveniments` no admet més de 366 dies per consulta. */
const MAX_EVENT_RANGE_DAYS = 365;

/**
 * Dies (`YYYY-MM-DD`, hora de Catalunya) que cal demanar a `/esdeveniments` per posar nom als
 * fenòmens d'una llista de plans, en una sola crida. La llista arriba de l'API amb el pla més
 * proper a avui primer: si els plans amb fenomen s'escampen més d'un any, es demana l'any que
 * comença (o acaba) en aquest pla, i els que en queden fora surten sense nom de fenomen.
 * `null` si cap pla no va lligat a un fenomen.
 */
export function planEventsRange(plans: Pla[]): { from: string; to: string } | null {
  const days = plans
    .filter((plan) => plan.esdevenimentId !== null)
    .map((plan) => cataloniaDate(plan.dataHoraInici));
  const anchor = days[0];
  if (anchor === undefined) return null;
  const inRange = days.filter(
    (day) => Math.abs(Date.parse(day) - Date.parse(anchor)) <= MAX_EVENT_RANGE_DAYS * 86_400_000,
  );
  const sorted = [...inRange].sort();
  return { from: sorted[0]!, to: sorted[sorted.length - 1]! };
}

/**
 * Article d'un municipi que el català contrau amb la preposició: «al Pont de Suert», «als
 * Hostalets», però «a Prades» o «a l'Escala».
 */
export type PlaceArticle = 'el' | 'els' | null;

export function splitPlaceArticle(municipi: string): { article: PlaceArticle; name: string } {
  const match = /^(els?)\s+(.+)$/i.exec(municipi.trim());
  if (!match) return { article: null, name: municipi.trim() };
  return { article: match[1]!.toLowerCase() as 'el' | 'els', name: match[2]! };
}

/** Una fila d'«Els meus plans» (mockup 13), sense textos: els posa el ViewModel amb l'i18n. */
export type PlanRow = {
  id: string;
  puntId: string;
  /** Dia del mes de la sortida, amb dues xifres («02»), a la zona del mòbil. */
  day: string;
  /** Mes de la sortida (0–11), a la zona del mòbil. */
  month: number;
  /** Hora de sortida «HH:MM», a la zona del mòbil, i l'hora sola (per a «a la 01:00»). */
  time: string;
  hour: number;
  /** Nom del fenomen (`/esdeveniments`); `null` si el pla no en té o no s'ha trobat. */
  phenomenon: string | null;
  place: { article: PlaceArticle; name: string };
  pointName: string;
  /** El punt s'ha retirat: la fitxa ja no hi és i la fila no es pot obrir. */
  retired: boolean;
};

/**
 * Dades d'una fila: el dia i l'hora de sortida en hora del mòbil (com «Crea un pla», que les
 * desa amb `localToIso`), el fenomen pel seu `codi` i el municipi del punt.
 */
export function planRow(plan: Pla, eventNames: ReadonlyMap<string, string>): PlanRow {
  const start = new Date(plan.dataHoraInici);
  return {
    id: plan.id,
    puntId: plan.punt.id,
    day: pad(start.getDate()),
    month: start.getMonth(),
    time: formatTime(start.getHours(), start.getMinutes()),
    hour: start.getHours(),
    phenomenon: plan.esdevenimentId ? (eventNames.get(plan.esdevenimentId) ?? null) : null,
    place: splitPlaceArticle(plan.punt.municipi),
    pointName: plan.punt.nom,
    retired: !plan.punt.publicat,
  };
}
