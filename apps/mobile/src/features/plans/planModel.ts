import type { Esdeveniment, Pla, PlaCanvis, PlaNou } from '@talaia/shared';

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
 * l'usuari mou la sortida, el final es mou igual. La relació amb el calendari natiu es desa després
 * amb `PUT /plans/{id}/calendari` (ADR-0036).
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

/** El formulari d'un pla desat (HU14, TG-161): el que l'usuari pot canviar a l'edició. */
export type PlanForm = {
  puntId: string;
  esdevenimentId: string | null;
  departure: Departure;
  /** Del final menys l'inici; `null` si el pla no té final. Moure la sortida el conserva. */
  durationMs: number | null;
  notes: string;
};

export function planForm(plan: Pla): PlanForm {
  const start = Date.parse(plan.dataHoraInici);
  return {
    puntId: plan.punt.id,
    esdevenimentId: plan.esdevenimentId,
    departure: toDeparture(new Date(start)),
    durationMs: plan.dataHoraFi ? Date.parse(plan.dataHoraFi) - start : null,
    notes: plan.notes ?? '',
  };
}

/** Les rodes van de minut en minut com a molt: els segons d'un pla no són un canvi. */
const sameMinute = (a: string | null, b: string | null) =>
  a === null || b === null
    ? a === b
    : Math.floor(Date.parse(a) / 60_000) === Math.floor(Date.parse(b) / 60_000);

/**
 * Cos de `PATCH /plans/{id}`: només els camps que han canviat respecte al pla desat; `null` si no
 * n'ha canviat cap. Si la sortida es mou, el final es mou igual (es conserva la durada).
 */
export function planChanges(plan: Pla, form: PlanForm): PlaCanvis | null {
  const next = buildNewPlan(form);
  const changes: PlaCanvis = {};
  if (form.puntId !== plan.punt.id) changes.puntId = form.puntId;
  if (form.esdevenimentId !== plan.esdevenimentId) changes.esdevenimentId = form.esdevenimentId;
  if (!sameMinute(next.dataHoraInici, plan.dataHoraInici)) {
    changes.dataHoraInici = next.dataHoraInici;
  }
  if (!sameMinute(next.dataHoraFi ?? null, plan.dataHoraFi)) {
    changes.dataHoraFi = next.dataHoraFi ?? null;
  }
  if (next.notes !== plan.notes) changes.notes = next.notes ?? null;
  return Object.keys(changes).length > 0 ? changes : null;
}

/** La sortida del formulari és la del pla desat (un pla començat es pot desar sense moure-la). */
export const sameDeparture = (plan: Pla, departure: Departure) =>
  sameMinute(departureIso(departure), plan.dataHoraInici);

/**
 * Si el pla ja s'ha acabat, com `fiEfectiu` de l'API: a `dataHoraFi` o, si no en té, a les 12:00 de
 * l'endemà de la seva nit (la nit d'un inici és el dia de `inici − 12 h`). Hora del mòbil.
 */
export function isPlanFinished(plan: Pla, now: Date = new Date()): boolean {
  if (plan.dataHoraFi) return Date.parse(plan.dataHoraFi) < now.getTime();
  const night = new Date(Date.parse(plan.dataHoraInici) - 12 * 60 * 60 * 1000);
  const end = new Date(night.getFullYear(), night.getMonth(), night.getDate() + 1, 12);
  return end.getTime() < now.getTime();
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

export type PlanUpdateErrorKey =
  'alreadyExists' | 'finished' | 'pointGone' | 'eventGone' | 'notFound' | 'past' | 'generic';

/**
 * Text de l'error del `PATCH /plans/{id}` (TG-161). Com `planErrorKey`, `account_blocked` el pinta
 * `AccountBlockedScreen`. Un `validation_error` amb el formulari validat només pot ser una sortida
 * que ha passat mentre la pantalla era oberta.
 */
export function planUpdateErrorKey(error: unknown): PlanUpdateErrorKey | null {
  if (!(error instanceof ApiError)) return 'generic';
  switch (error.code) {
    case ACCOUNT_BLOCKED:
      return null;
    case 'plan_already_exists':
      return 'alreadyExists';
    case 'plan_finished':
      return 'finished';
    case 'punt_not_found':
      return 'pointGone';
    case 'event_not_found':
      return 'eventGone';
    case 'plan_not_found':
      return 'notFound';
    case 'validation_error':
      return 'past';
    default:
      return 'generic';
  }
}

/**
 * `/esdeveniments` no admet més de 366 dies per consulta. Els plans es queden a 363 dies del primer
 * perquè, amb el dia de més a cada banda (`eventWindow`), la consulta no passi del màxim.
 */
const MAX_EVENT_RANGE_DAYS = 363;

/**
 * Dies (`YYYY-MM-DD`, hora de Catalunya) que cal demanar a `/esdeveniments` per posar nom als
 * fenòmens d'una llista de plans, en una sola crida. Com «Crea un pla», que ofereix els fenòmens
 * del dia ± 1, cada pla porta la seva finestra (`eventWindow`): una sortida a les 23:15 per a un
 * eclipsi de les 02:00 de l'endemà en troba el nom. La llista arriba de l'API amb el pla més
 * proper a avui primer (els futurs en ordre ascendent i els passats en descendent): si els plans
 * amb fenomen s'escampen més d'un any, es demana l'any que comença (o acaba) en aquest pla, i els
 * que en queden fora surten sense nom de fenomen. `null` si cap pla no va lligat a un fenomen.
 */
export function planEventsRange(plans: Pla[]): { from: string; to: string } | null {
  const days = plans
    .filter((plan) => plan.esdevenimentId !== null)
    .map((plan) => cataloniaDate(plan.dataHoraInici));
  const anchor = days[0];
  if (anchor === undefined) return null;
  const sorted = days
    .filter(
      (day) => Math.abs(Date.parse(day) - Date.parse(anchor)) <= MAX_EVENT_RANGE_DAYS * 86_400_000,
    )
    .sort((a, b) => a.localeCompare(b));
  return { from: eventWindow(sorted[0]!).from, to: eventWindow(sorted[sorted.length - 1]!).to };
}

/**
 * Article d'un municipi que el català contrau amb la preposició: «al Pont de Suert», «als
 * Hostalets», però «a Prades» o «a l'Escala».
 */
export type PlaceArticle = 'el' | 'els' | null;

export function splitPlaceArticle(municipi: string): { article: PlaceArticle; name: string } {
  const match = /^(els?)\s+(\S.*)$/i.exec(municipi.trim());
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
  /** El punt s'ha retirat: la fitxa ja no hi és, però el pla s'obre per triar-ne un altre. */
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

/** Un punt que es pot triar a l'edició: els publicats de `GET /punts` (TG-161). */
export type PointOption = { id: string; nom: string; municipi: string };

/** Minúscules i sense accents: «montsec» troba «Montsec» i «agér» troba «Àger». */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Els punts que contenen la cerca al nom o al municipi, per ordre alfabètic del nom. */
export function searchPoints(points: readonly PointOption[], query: string): PointOption[] {
  const needle = fold(query);
  return points
    .filter((point) => !needle || fold(`${point.nom} ${point.municipi}`).includes(needle))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
}
